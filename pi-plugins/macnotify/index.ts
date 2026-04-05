import { constants } from "node:fs";
import { execFile } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

type NotifyOnConfig = {
	agentComplete: boolean;
	toolError: boolean;
	compaction: boolean;
};

type SoundsConfig = {
	agentComplete: string;
	toolError: string;
	compaction: string;
};

type MacnotifyConfig = {
	enabled: boolean;
	titlePrefix: string;
	includeProjectName: boolean;
	cooldownMs: number;
	notifyOn: NotifyOnConfig;
	sounds: SoundsConfig;
};

type ConfigOverride = Partial<Omit<MacnotifyConfig, "notifyOn" | "sounds">> & {
	notifyOn?: Partial<NotifyOnConfig>;
	sounds?: Partial<SoundsConfig>;
};

type EventType = keyof NotifyOnConfig;

type CommandScope = "global" | "project";

const execFileAsync = promisify(execFile);

const DEFAULT_CONFIG: MacnotifyConfig = {
	enabled: true,
	titlePrefix: "pi",
	includeProjectName: true,
	cooldownMs: 5000,
	notifyOn: {
		agentComplete: true,
		toolError: true,
		compaction: false,
	},
	sounds: {
		agentComplete: "Glass",
		toolError: "Basso",
		compaction: "Hero",
	},
};

function mergeConfig(base: MacnotifyConfig, override: ConfigOverride | null): MacnotifyConfig {
	return {
		...base,
		...(override || {}),
		notifyOn: {
			...base.notifyOn,
			...(override?.notifyOn || {}),
		},
		sounds: {
			...base.sounds,
			...(override?.sounds || {}),
		},
	};
}

function configPaths(directory: string) {
	return {
		globalPath: join(homedir(), ".pi", "agent", "macnotify.json"),
		projectPath: join(directory, ".pi", "macnotify.json"),
	};
}

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

async function readJson(path: string): Promise<ConfigOverride> {
	const text = await readFile(path, "utf8");
	return JSON.parse(text) as ConfigOverride;
}

async function readOverride(path: string): Promise<ConfigOverride | null> {
	if (!(await fileExists(path))) {
		return null;
	}

	try {
		return await readJson(path);
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		console.warn(`[macnotify] Failed to read config ${path}: ${reason}`);
		return null;
	}
}

async function writeOverride(path: string, config: ConfigOverride): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

async function loadConfig(directory: string): Promise<{
	globalPath: string;
	projectPath: string;
	globalOverride: ConfigOverride | null;
	projectOverride: ConfigOverride | null;
	globalConfig: MacnotifyConfig;
	projectConfig: MacnotifyConfig | null;
	effectiveConfig: MacnotifyConfig;
}> {
	const { globalPath, projectPath } = configPaths(directory);
	const globalOverride = await readOverride(globalPath);
	const projectOverride = await readOverride(projectPath);
	const globalConfig = mergeConfig(DEFAULT_CONFIG, globalOverride);
	const projectConfig = projectOverride ? mergeConfig(DEFAULT_CONFIG, projectOverride) : null;
	const effectiveConfig = projectOverride ? mergeConfig(globalConfig, projectOverride) : globalConfig;

	return {
		globalPath,
		projectPath,
		globalOverride,
		projectOverride,
		globalConfig,
		projectConfig,
		effectiveConfig,
	};
}

function projectNameFrom(directory: string): string {
	return basename(directory);
}

function notificationTitle(config: MacnotifyConfig, directory: string): string {
	if (!config.includeProjectName) {
		return config.titlePrefix;
	}
	return `${config.titlePrefix} - ${projectNameFrom(directory)}`;
}

async function notify(title: string, message: string, sound: string): Promise<void> {
	const script = sound.trim().length > 0
		? `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)} sound name ${JSON.stringify(sound)}`
		: `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}`;
	await execFileAsync("osascript", ["-e", script]);
}

function summarizeConfig(config: MacnotifyConfig): string {
	return [
		`enabled=${config.enabled}`,
		`titlePrefix=${JSON.stringify(config.titlePrefix)}`,
		`includeProjectName=${config.includeProjectName}`,
		`cooldownMs=${config.cooldownMs}`,
		`agentComplete=${config.notifyOn.agentComplete} (${JSON.stringify(config.sounds.agentComplete)})`,
		`toolError=${config.notifyOn.toolError} (${JSON.stringify(config.sounds.toolError)})`,
		`compaction=${config.notifyOn.compaction} (${JSON.stringify(config.sounds.compaction)})`,
	].join(" | ");
}

function parseScope(args: string | undefined): CommandScope {
	return args?.trim() === "project" ? "project" : "global";
}

function extractToolErrorText(result: unknown): string | undefined {
	if (!result || typeof result !== "object") {
		return undefined;
	}

	const maybeContent = (result as { content?: unknown }).content;
	if (!Array.isArray(maybeContent)) {
		return undefined;
	}

	const text = maybeContent
		.filter((item): item is { type: string; text?: string } => typeof item === "object" && item !== null && "type" in item)
		.filter((item) => item.type === "text" && typeof item.text === "string")
		.map((item) => item.text?.trim() || "")
		.filter((item) => item.length > 0)
		.join(" ");

	return text.length > 0 ? text : undefined;
}

export default function (pi: ExtensionAPI) {
	const lastSent = new Map<EventType, number>();

	async function sendEventNotification(eventType: EventType, cwd: string, message: string): Promise<void> {
		if (process.platform !== "darwin") {
			return;
		}

		const { effectiveConfig } = await loadConfig(cwd);
		if (!effectiveConfig.enabled || !effectiveConfig.notifyOn[eventType]) {
			return;
		}

		const now = Date.now();
		const previous = lastSent.get(eventType) ?? 0;
		if (now - previous < effectiveConfig.cooldownMs) {
			return;
		}
		lastSent.set(eventType, now);

		try {
			await notify(
				notificationTitle(effectiveConfig, cwd),
				message,
				effectiveConfig.sounds[eventType],
			);
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			console.warn(`[macnotify] Failed to send notification: ${reason}`);
		}
	}

	pi.registerCommand("macnotify-toggle", {
		description: "Toggle macnotify notifications on or off (optionally pass: project)",
		handler: async (args, ctx) => {
			const scope = parseScope(args);
			const { globalPath, projectPath, globalOverride, projectOverride, effectiveConfig } = await loadConfig(ctx.cwd);
			const targetPath = scope === "project" ? projectPath : globalPath;
			const currentOverride = scope === "project" ? projectOverride : globalOverride;
			const currentEnabled = scope === "project"
				? effectiveConfig.enabled
				: (currentOverride?.enabled ?? DEFAULT_CONFIG.enabled);
			const nextOverride: ConfigOverride = {
				...(currentOverride || {}),
				enabled: !currentEnabled,
			};

			await writeOverride(targetPath, nextOverride);
			await loadConfig(ctx.cwd);
			ctx.ui.notify(
				`macnotify ${nextOverride.enabled ? "enabled" : "disabled"} (${scope})`,
				"info",
			);
		},
	});

	pi.registerCommand("macnotify-status", {
		description: "Show effective macnotify settings",
		handler: async (_args, ctx) => {
			const { effectiveConfig, globalPath, projectPath } = await loadConfig(ctx.cwd);
			ctx.ui.notify(`macnotify: ${summarizeConfig(effectiveConfig)} | global=${globalPath} | project=${projectPath}`, "info");
		},
	});

	pi.registerCommand("macnotify-test", {
		description: "Send a test notification (agentComplete, toolError, or compaction)",
		handler: async (args, ctx) => {
			const eventType = (args?.trim() || "agentComplete") as EventType;
			if (eventType !== "agentComplete" && eventType !== "toolError" && eventType !== "compaction") {
				ctx.ui.notify("Usage: /macnotify-test [agentComplete|toolError|compaction]", "warning");
				return;
			}

			const messages: Record<EventType, string> = {
				agentComplete: "✅ Task complete",
				toolError: "🔴 Tool error",
				compaction: "🗜️ Context compacted",
			};
			await sendEventNotification(eventType, ctx.cwd, messages[eventType]);
			ctx.ui.notify(`Sent ${eventType} test notification`, "info");
		},
	});

	pi.on("agent_end", async (_event, ctx) => {
		if (ctx.hasPendingMessages()) {
			return;
		}
		await sendEventNotification("agentComplete", ctx.cwd, "✅ Task complete");
	});

	pi.on("tool_execution_end", async (event, ctx) => {
		if (!event.isError) {
			return;
		}

		const errorText = extractToolErrorText(event.result);
		const suffix = errorText ? `: ${errorText}` : `: ${event.toolName}`;
		await sendEventNotification("toolError", ctx.cwd, `🔴 Tool error${suffix}`);
	});

	pi.on("session_compact", async (_event, ctx) => {
		await sendEventNotification("compaction", ctx.cwd, "🗜️ Context compacted");
	});
}
