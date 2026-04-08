/**
 * Hide Tools Extension
 *
 * Toggles tool result visibility in the UI via `/hide-tools`.
 *
 * When hidden, built-in tool calls (read, bash, edit, write, grep, find, ls)
 * show only the one-line call header with no result output. The built-in
 * renderCall is preserved via the fallback chain; only renderResult is
 * overridden to return empty when the hidden flag is active.
 *
 * Toggling forces a re-render of existing tool components by calling
 * setToolsExpanded() with the current value, which triggers updateDisplay()
 * on all ToolExecutionComponents without changing the expand/collapse state.
 *
 * State is stored on the process object to survive /reload.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	createBashToolDefinition,
	createEditToolDefinition,
	createFindToolDefinition,
	createGrepToolDefinition,
	createLsToolDefinition,
	createReadToolDefinition,
	createWriteToolDefinition,
} from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";

const STATUS_KEY = "hide-tools";
const STATE_KEY = "__piHideToolsHidden";

function getHidden(): boolean {
	return (process as any)[STATE_KEY] ?? false;
}

function setHidden(v: boolean): void {
	(process as any)[STATE_KEY] = v;
}

const EMPTY = new Text("", 0, 0);

export default function hideToolsExtension(pi: ExtensionAPI) {
	const cwd = process.cwd();
	const defs = {
		read: createReadToolDefinition(cwd),
		bash: createBashToolDefinition(cwd),
		edit: createEditToolDefinition(cwd),
		write: createWriteToolDefinition(cwd),
		grep: createGrepToolDefinition(cwd),
		find: createFindToolDefinition(cwd),
		ls: createLsToolDefinition(cwd),
	};

	for (const [name, def] of Object.entries(defs)) {
		const originalRenderResult = def.renderResult;
		pi.registerTool({
			...def,
			name,
			renderResult(result, options, theme, context) {
				if (getHidden()) return EMPTY;
				return originalRenderResult?.call(def, result, options, theme, context) ?? EMPTY;
			},
		});
	}

	pi.registerCommand("hide-tools", {
		description: "Toggle tool result visibility",
		handler: async (_args, ctx) => {
			setHidden(!getHidden());
			if (ctx.hasUI) {
				// Force existing ToolExecutionComponents to re-render with the new hidden state.
				// setToolsExpanded iterates all components and calls setExpanded → updateDisplay → renderResult.
				ctx.ui.setToolsExpanded(ctx.ui.getToolsExpanded());
				ctx.ui.setStatus(STATUS_KEY, getHidden() ? ctx.ui.theme.fg("muted", "tools hidden") : undefined);
				ctx.ui.notify(`Tool results are now ${getHidden() ? "hidden" : "visible"}`, "info");
			}
		},
	});

	pi.on("session_start", async (_event, ctx) => {
		if (ctx.hasUI && getHidden()) {
			ctx.ui.setStatus(STATUS_KEY, ctx.ui.theme.fg("muted", "tools hidden"));
		}
	});
}
