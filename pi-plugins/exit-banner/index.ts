/**
 * Exit Banner Extension
 *
 * Prints a branded banner with the session name and resume command when pi exits.
 *
 * On session_shutdown, captures the session ID and builds a resume command
 * (e.g. `pi --session <id>`). A process "exit" hook then prints the banner
 * to stdout, so the user sees it after the TUI clears.
 *
 * The exit hook and print state are stored on the process object to ensure
 * the message prints exactly once, even if /reload re-registers the extension.
 */

import path from "node:path";

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const STYLE = {
	reset: "\x1b[0m",
	dim: "\x1b[90m",
	bold: "\x1b[1m",
};

const WORDMARK = [
	"  ██████    ",
	"  ██  ██    ",
	"  ████  ██  ",
	"  ██    ██  ",
];
const STATE_KEY = "__piExitBannerState";

type ExitBannerState = {
	// /reload can load this extension multiple times in one process.
	// Keep exit hook registration process-global so the message prints once.
	exitHookInstalled: boolean;
	printed: boolean;
	exitMessage?: string;
};

function getState(): ExitBannerState {
	const processWithState = process as NodeJS.Process & {
		[STATE_KEY]?: ExitBannerState;
	};
	const existing = processWithState[STATE_KEY];
	if (existing) return existing;
	const created: ExitBannerState = { exitHookInstalled: false, printed: false };
	processWithState[STATE_KEY] = created;
	return created;
}

function installExitHook(state: ExitBannerState): void {
	if (state.exitHookInstalled) return;
	state.exitHookInstalled = true;

	process.once("exit", () => {
		if (state.printed || !state.exitMessage) return;
		state.printed = true;
		process.stdout.write(`\x1b[0m\n${state.exitMessage}`);
	});
}

export function padLabel(label: string): string {
	return label.padEnd(10, " ");
}

export function getSessionTitle(sessionName: string | undefined, cwd: string): string {
	return sessionName && sessionName.trim().length > 0 ? sessionName : path.basename(cwd);
}

export function buildExitBanner(sessionTitle: string, resumeCommand: string): string {
	const weak = (text: string) => `${STYLE.dim}${padLabel(text)}${STYLE.reset}`;
	const strong = (text: string) => `${STYLE.bold}${text}${STYLE.reset}`;
	return [
		...WORDMARK,
		"",
		`  ${weak("Session")}${strong(sessionTitle)}`,
		`  ${weak("Continue")}${strong(resumeCommand)}`,
		"",
		"",
	].join("\n");
}

export default function exitBanner(pi: ExtensionAPI) {
	const state = getState();
	installExitHook(state);

	pi.on("session_shutdown", async (_event, ctx) => {
		const sessionFile = ctx.sessionManager.getSessionFile();
		if (!sessionFile) return;

		const sessionId = ctx.sessionManager.getSessionId();
		const title = getSessionTitle(ctx.sessionManager.getSessionName(), ctx.cwd);
		const resumeCommand = `pi --session ${sessionId}`;

		state.exitMessage = buildExitBanner(title, resumeCommand);
	});
}
