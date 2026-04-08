/**
 * Session Role Extension
 *
 * Lets users define complete system prompts per session role using markdown files:
 * - ~/.pi/agent/roles/*.md
 * - <cwd>/.pi/roles/*.md
 *
 * File name = role name. File contents = full replacement system prompt.
 * Project-local roles override global roles with the same name.
 *
 * Behavior:
 * - New sessions default to the built-in `code` role
 * - The built-in `code` role uses pi's default system prompt unchanged
 * - Custom role files still fully replace the system prompt when selected
 * - `/role` opens a picker before the first message and reports the locked role afterwards
 * - Once the conversation starts, the role is locked for that session
 * - Switching roles mid-session is rejected
 * - The selected role is persisted in the session via a custom entry
 *
 * Usage:
 * 1. Create role files, for example ~/.pi/agent/roles/chat.md
 * 2. Load this extension
 * 3. Start a new empty session; it defaults to `code`
 * 4. Use /role, /role list, /role status before the first message if you want to change it
 * 5. After the conversation starts, /role only reports the active locked role
 *
 * Non-interactive usage:
 * - pi --extension ~/.pi/agent/extensions/role.ts --role chat
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { getAgentDir } from "@mariozechner/pi-coding-agent";

interface RoleDefinition {
	name: string;
	prompt?: string;
	path: string;
	scope: "builtin" | "global" | "project";
}

interface RoleStateEntry {
	name: string;
}

const ROLE_STATE_ENTRY = "session-role";
const DEFAULT_STATUS_KEY = "role";
const DEFAULT_ROLE_NAME = "code";
const DEFAULT_ROLE_PATH = "pi default system prompt";

function loadRoles(cwd: string): Map<string, RoleDefinition> {
	const roles = new Map<string, RoleDefinition>();
	const globalDir = join(getAgentDir(), "roles");
	const projectDir = join(cwd, ".pi", "roles");

	loadRolesFromDir(globalDir, "global", roles);
	loadRolesFromDir(projectDir, "project", roles);
	roles.set(DEFAULT_ROLE_NAME, {
		name: DEFAULT_ROLE_NAME,
		path: DEFAULT_ROLE_PATH,
		scope: "builtin",
	});

	return roles;
}

function loadRolesFromDir(
	dir: string,
	scope: "global" | "project",
	roles: Map<string, RoleDefinition>,
): void {
	if (!existsSync(dir)) return;

	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (!entry.isFile()) continue;
		if (extname(entry.name) !== ".md") continue;

		const path = join(dir, entry.name);
		const name = basename(entry.name, ".md");
		const prompt = readFileSync(path, "utf-8").trim();
		if (!prompt) continue;

		roles.set(name, {
			name,
			prompt,
			path,
			scope,
		});
	}
}

function hasConversationStarted(ctx: ExtensionContext): boolean {
	return ctx.sessionManager.getBranch().some((entry) => entry.type === "message");
}

function getSavedRoleName(ctx: ExtensionContext): string | undefined {
	const entries = ctx.sessionManager.getBranch();
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry.type === "custom" && entry.customType === ROLE_STATE_ENTRY) {
			return (entry.data as RoleStateEntry | undefined)?.name;
		}
	}
	return undefined;
}

function buildRoleListMessage(roles: Map<string, RoleDefinition>): string {
	const items = Array.from(roles.values())
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((role) => `${role.name} (${role.scope})`);
	return items.length > 0 ? items.join(", ") : "(none)";
}

function getDefaultRole(roles: Map<string, RoleDefinition>): RoleDefinition {
	return (
		roles.get(DEFAULT_ROLE_NAME) ?? {
			name: DEFAULT_ROLE_NAME,
			path: DEFAULT_ROLE_PATH,
			scope: "builtin",
		}
	);
}

export default function roleExtension(pi: ExtensionAPI) {
	let roles = new Map<string, RoleDefinition>();
	let activeRole: RoleDefinition | undefined;

	pi.registerFlag("role", {
		description: "Session role to use for empty sessions",
		type: "string",
	});

	function updateStatus(ctx: ExtensionContext): void {
		if (activeRole) {
			ctx.ui.setStatus(DEFAULT_STATUS_KEY, ctx.ui.theme.fg("accent", `role:${activeRole.name}`));
		} else {
			ctx.ui.setStatus(DEFAULT_STATUS_KEY, undefined);
		}
	}

	function setActiveRole(role: RoleDefinition | undefined, ctx: ExtensionContext, persist = false): void {
		activeRole = role;
		if (persist && role) {
			pi.appendEntry<RoleStateEntry>(ROLE_STATE_ENTRY, { name: role.name });
		}
		updateStatus(ctx);
	}

	async function selectRole(ctx: ExtensionContext, title = "Select session role"): Promise<RoleDefinition | undefined> {
		const names = Array.from(roles.keys()).sort((a, b) => a.localeCompare(b));
		if (names.length === 0) {
			ctx.ui.notify("No roles found. Add .md files under ~/.pi/agent/roles or .pi/roles", "warning");
			return undefined;
		}

		if (names.length === 1) {
			return roles.get(names[0]);
		}

		const selected = await ctx.ui.select(title, names);
		return selected ? roles.get(selected) : undefined;
	}

	async function assignRoleByName(name: string, ctx: ExtensionContext): Promise<boolean> {
		const role = roles.get(name);
		if (!role) {
			ctx.ui.notify(`Unknown role \"${name}\". Available: ${buildRoleListMessage(roles)}`, "error");
			return false;
		}
		setActiveRole(role, ctx, true);
		ctx.ui.notify(`Role \"${name}\" selected`, "info");
		return true;
	}

	function showLockedMessage(ctx: ExtensionContext): void {
		const current = activeRole ? `${activeRole.name} (${activeRole.path})` : "(none)";
		ctx.ui.notify(
			`Role is locked after the conversation starts. Current role: ${current}. Start a new session to use another role.`,
			"warning",
		);
	}

	pi.registerCommand("role", {
		description: "Select or inspect the current session role",
		handler: async (args, ctx) => {
			const input = args.trim();
			const locked = hasConversationStarted(ctx);

			if (input === "status") {
				if (activeRole) {
					ctx.ui.notify(`Current role: ${activeRole.name} (${activeRole.path})`, "info");
				} else {
					ctx.ui.notify("Current role: (none)", "info");
				}
				return;
			}

			if (input === "list") {
				ctx.ui.notify(`Available roles: ${buildRoleListMessage(roles)}`, "info");
				return;
			}

			if (locked) {
				showLockedMessage(ctx);
				return;
			}

			if (input) {
				await assignRoleByName(input, ctx);
				return;
			}

			const selectedRole = await selectRole(ctx);
			if (!selectedRole) return;
			setActiveRole(selectedRole, ctx, true);
			ctx.ui.notify(`Role \"${selectedRole.name}\" selected`, "info");
		},
	});

	pi.on("before_agent_start", async () => {
		if (!activeRole?.prompt) return undefined;
		return { systemPrompt: activeRole.prompt };
	});

	pi.on("session_start", async (_event, ctx) => {
		roles = loadRoles(ctx.cwd);
		activeRole = getDefaultRole(roles);

		const savedRoleName = getSavedRoleName(ctx);
		if (savedRoleName) {
			const savedRole = roles.get(savedRoleName);
			if (savedRole) {
				setActiveRole(savedRole, ctx, false);
			} else {
				ctx.ui.notify(`Saved role \"${savedRoleName}\" no longer exists`, "warning");
				setActiveRole(getDefaultRole(roles), ctx, false);
			}
			return;
		}

		if (hasConversationStarted(ctx)) {
			setActiveRole(getDefaultRole(roles), ctx, false);
			const requestedRole = pi.getFlag("role");
			if (typeof requestedRole === "string" && requestedRole) {
				ctx.ui.notify("Ignoring --role because this session already has conversation history", "warning");
			}
			return;
		}

		const requestedRole = pi.getFlag("role");
		if (typeof requestedRole === "string" && requestedRole) {
			await assignRoleByName(requestedRole, ctx);
			return;
		}

		setActiveRole(getDefaultRole(roles), ctx, false);
	});

	pi.on("session_shutdown", (_event, ctx) => {
		ctx.ui.setStatus(DEFAULT_STATUS_KEY, undefined);
	});
}
