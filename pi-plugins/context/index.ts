/**
 * Context Usage Extension
 *
 * Shows a breakdown of what's consuming the model's context window.
 *
 * `/context` renders a visual grid and per-category token estimates:
 * - System prompt (base prompt, project context files, skills, date/cwd footer)
 * - Tool schemas (all active tools, sorted by size)
 * - Messages (with breakdown: tool calls, tool results, assistant text, user text)
 *
 * Token counts are estimates (chars / 4). The actual token count from the API
 * is shown alongside when available via getContextUsage().
 */

import type { ExtensionAPI, ToolInfo } from "@mariozechner/pi-coding-agent";
import { buildSessionContext, convertToLlm, estimateTokens } from "@mariozechner/pi-coding-agent";
import { Box, Text } from "@mariozechner/pi-tui";

const REPORT_TYPE = "context-report";
const GRID_CELLS = 60;
const GRID_COLS = 15;

// ============================================================================
// Types
// ============================================================================

type Category = {
	name: string;
	tokens: number;
	color: "accent" | "warning" | "success" | "error" | "muted" | "mdLink";
	icon: string;
	detail?: string[];
};

type MessageBreakdown = {
	toolCallTokens: number;
	toolResultTokens: number;
	assistantTextTokens: number;
	userTextTokens: number;
	toolCallsByName: Map<string, { calls: number; resultTokens: number }>;
};

type ReportDetails = {
	model: string;
	totalTokens: number;
	estimatedTokens: number;
	contextWindow: number;
	percentage: number | null;
	categories: Category[];
	freeSpace: number;
};

// ============================================================================
// Token estimation
// ============================================================================

function charsToTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

function estimateToolTokens(tool: ToolInfo): number {
	return charsToTokens(JSON.stringify({ name: tool.name, description: tool.description, parameters: tool.parameters }));
}

// ============================================================================
// System prompt parsing
// ============================================================================

function parseSystemPrompt(systemPrompt: string): Category[] {
	if (!systemPrompt) return [];

	const categories: Category[] = [];
	let remaining = systemPrompt;

	// Extract project context: "# Project Context" until next major section or end
	const projectCtxStart = remaining.indexOf("\n# Project Context\n");
	if (projectCtxStart !== -1) {
		// Ends at <available_skills> or footer
		const afterCtx = remaining.slice(projectCtxStart);
		const skillsIdx = afterCtx.indexOf("\n<available_skills>");
		const footerIdx = afterCtx.search(/\nCurrent date: /);
		const endIdx = [skillsIdx, footerIdx].filter((i) => i > 0).sort((a, b) => a - b)[0] ?? afterCtx.length;
		const block = afterCtx.slice(0, endIdx);
		const files = Array.from(block.matchAll(/^## (.+)$/gm)).map((m) => m[1]);
		categories.push({ name: "Project context", tokens: charsToTokens(block), detail: files, color: "success", icon: "⛁" });
		remaining = remaining.slice(0, projectCtxStart) + remaining.slice(projectCtxStart + endIdx);
	}

	// Extract skills block
	const skillsStart = remaining.indexOf("<available_skills>");
	const skillsEnd = remaining.indexOf("</available_skills>");
	if (skillsStart !== -1 && skillsEnd !== -1) {
		const block = remaining.slice(skillsStart, skillsEnd + "</available_skills>".length);
		// Include the preamble text before <available_skills> that belongs to skills section
		const preambleStart = remaining.lastIndexOf("\n\nThe following skills", skillsStart);
		const fullStart = preambleStart !== -1 ? preambleStart : skillsStart;
		const fullBlock = remaining.slice(fullStart, skillsEnd + "</available_skills>".length);
		const skills = Array.from(fullBlock.matchAll(/<name>([^<]+)<\/name>/g)).map((m) => m[1]);
		categories.push({ name: "Skills", tokens: charsToTokens(fullBlock), detail: skills, color: "warning", icon: "⛁" });
		remaining = remaining.slice(0, fullStart) + remaining.slice(skillsEnd + "</available_skills>".length);
	}

	// Extract footer (date + cwd)
	const footerMatch = remaining.match(/\nCurrent date: [\s\S]*$/);
	if (footerMatch) {
		const footer = footerMatch[0].trim();
		categories.push({ name: "Date/CWD footer", tokens: charsToTokens(footer), color: "muted", icon: "⛁" });
		remaining = remaining.slice(0, remaining.length - footerMatch[0].length);
	}

	// Whatever is left is the base system prompt
	remaining = remaining.trim();
	if (remaining) {
		categories.push({ name: "System prompt", tokens: charsToTokens(remaining), color: "accent", icon: "⛁" });
	}

	// Sort: system prompt first, then the rest
	categories.sort((a, b) => {
		if (a.name === "System prompt") return -1;
		if (b.name === "System prompt") return 1;
		return b.tokens - a.tokens;
	});

	return categories;
}

// ============================================================================
// Tool categorization
// ============================================================================

function buildToolCategory(pi: ExtensionAPI): Category {
	const activeNames = new Set(pi.getActiveTools());
	const activeTools = pi.getAllTools().filter((tool) => activeNames.has(tool.name));
	const toolDetails = activeTools
		.map((tool) => ({ tool, tokens: estimateToolTokens(tool) }))
		.sort((a, b) => b.tokens - a.tokens);

	const sourceLabel = (tool: ToolInfo): string => {
		const source = tool.sourceInfo?.source ?? "unknown";
		const scope = tool.sourceInfo?.scope ?? "project";
		return source === "local" ? `builtin/${scope}` : `${source}/${scope}`;
	};

	return {
		name: "Tool schemas",
		tokens: toolDetails.reduce((sum, item) => sum + item.tokens, 0),
		detail: toolDetails.map((item) => `${item.tool.name} (${sourceLabel(item.tool)}) ~${item.tokens}t`),
		color: "success",
		icon: "⛁",
	};
}

// ============================================================================
// Message analysis
// ============================================================================

function analyzeMessages(ctx: {
	sessionManager: { getBranch(): any[]; getLeafId(): string | null | undefined };
}): { category: Category; breakdown: MessageBreakdown } {
	const entries = ctx.sessionManager.getBranch();
	const sessionContext = buildSessionContext(entries as any[], ctx.sessionManager.getLeafId());
	const llmMessages = convertToLlm(sessionContext.messages);

	const breakdown: MessageBreakdown = {
		toolCallTokens: 0,
		toolResultTokens: 0,
		assistantTextTokens: 0,
		userTextTokens: 0,
		toolCallsByName: new Map(),
	};

	let totalTokens = 0;
	const detail: string[] = [];

	for (const message of sessionContext.messages) {
		const tokens = estimateTokens(message as any);
		totalTokens += tokens;
	}

	// Break down LLM messages for detail and categorization
	for (const message of llmMessages) {
		if (message.role === "assistant") {
			const content = Array.isArray(message.content) ? message.content : [{ type: "text", text: message.content }];
			for (const block of content as any[]) {
				const blockTokens = charsToTokens(JSON.stringify(block));
				if (block.type === "toolCall" || block.type === "tool_use") {
					breakdown.toolCallTokens += blockTokens;
					const name = block.name ?? "unknown";
					const entry = breakdown.toolCallsByName.get(name) ?? { calls: 0, resultTokens: 0 };
					entry.calls++;
					breakdown.toolCallsByName.set(name, entry);
				} else {
					breakdown.assistantTextTokens += blockTokens;
				}
			}
		} else {
			const content = typeof message.content === "string" ? [{ type: "text", text: message.content }] : message.content;
			for (const block of content as any[]) {
				const blockTokens = charsToTokens(JSON.stringify(block));
				if (block.type === "tool_result" || block.type === "toolResult") {
					breakdown.toolResultTokens += blockTokens;
					const name = block.tool_use_id ?? block.toolCallId ?? "unknown";
					// Accumulate result tokens — we can't easily map tool_use_id back to name here
				} else {
					breakdown.userTextTokens += blockTokens;
				}
			}
		}
	}

	// Build per-message summary for detail view
	for (let i = 0; i < llmMessages.length; i++) {
		const msg = llmMessages[i];
		const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
		const tokens = charsToTokens(content.slice(0, 8000));
		detail.push(`${i + 1}. ${msg.role} ~${tokens}t`);
	}

	return {
		category: { name: "Messages", tokens: totalTokens, detail, color: "mdLink", icon: "⛁" },
		breakdown,
	};
}

// ============================================================================
// Rendering
// ============================================================================

function renderGrid(categories: Category[], freeSpace: number, contextWindow: number, theme: any): string {
	const buckets = [...categories, { name: "Free space", tokens: freeSpace, color: "muted" as const, icon: "□" }].filter(
		(c) => c.tokens > 0,
	);
	const cells: string[] = [];
	let assigned = 0;
	for (const bucket of buckets) {
		const count = Math.max(1, Math.round((bucket.tokens / contextWindow) * GRID_CELLS));
		for (let i = 0; i < count && assigned < GRID_CELLS; i++) {
			cells.push(theme.fg(bucket.color, bucket.icon));
			assigned++;
		}
	}
	while (cells.length < GRID_CELLS) cells.push(theme.fg("muted", "□"));
	const rows: string[] = [];
	for (let i = 0; i < GRID_CELLS; i += GRID_COLS) rows.push(cells.slice(i, i + GRID_COLS).join(" "));
	return rows.join("\n");
}

function formatPct(tokens: number, window: number): string {
	return `${((tokens / window) * 100).toFixed(1)}%`;
}

function formatTokens(n: number): string {
	return n.toLocaleString();
}

// ============================================================================
// Extension
// ============================================================================

export default function contextExtension(pi: ExtensionAPI) {
	pi.registerMessageRenderer(REPORT_TYPE, (message, _render, theme) => {
		const d = message.details as ReportDetails;
		const box = new Box(1, 1, (t) => theme.bg("customMessageBg", t));
		const lines: string[] = [];

		lines.push(theme.bold("Context Usage"));
		lines.push("");
		lines.push(renderGrid(d.categories, d.freeSpace, d.contextWindow, theme));
		lines.push("");

		// Summary line
		const pct = d.percentage?.toFixed(1) ?? "?";
		lines.push(theme.fg("muted", `${d.model} · ${formatTokens(d.totalTokens)}/${formatTokens(d.contextWindow)} tokens (${pct}%)`));
		if (d.estimatedTokens !== d.totalTokens) {
			lines.push(theme.fg("muted", `estimated breakdown total: ${formatTokens(d.estimatedTokens)} tokens`));
		}

		// Category breakdown
		lines.push("");
		lines.push(theme.fg("muted", "Estimated usage by category"));
		for (const cat of d.categories) {
			lines.push(
				`${theme.fg(cat.color, cat.icon)} ${cat.name} ${theme.fg("muted", `${formatTokens(cat.tokens)} · ${formatPct(cat.tokens, d.contextWindow)}`)}`,
			);
		}
		if (d.freeSpace > 0) {
			lines.push(`${theme.fg("muted", "□")} Free space ${theme.fg("muted", `${formatTokens(d.freeSpace)} · ${formatPct(d.freeSpace, d.contextWindow)}`)}`);
		}

		// Detail sections
		for (const cat of d.categories) {
			if (!cat.detail?.length) continue;
			lines.push("");
			lines.push(theme.bold(cat.name));
			for (const line of cat.detail.slice(0, 30)) lines.push(theme.fg("muted", `  ${line}`));
			if (cat.detail.length > 30) lines.push(theme.fg("muted", `  ... and ${cat.detail.length - 30} more`));
		}

		box.addChild(new Text(lines.join("\n"), 0, 0));
		return box;
	});

	pi.registerCommand("context", {
		description: "Show current context usage",
		handler: async (_args, ctx) => {
			const usage = ctx.getContextUsage();
			const contextWindow = usage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
			if (!contextWindow) {
				ctx.ui.notify("No context window available for current model", "warning");
				return;
			}

			const systemPrompt = ctx.getSystemPrompt() || "";
			const systemCategories = parseSystemPrompt(systemPrompt);
			const toolCategory = buildToolCategory(pi);
			const { category: messageCategory, breakdown } = analyzeMessages(ctx as any);

			const categories = [...systemCategories, toolCategory, messageCategory].filter((c) => c.tokens > 0);
			const estimatedTokens = categories.reduce((sum, c) => sum + c.tokens, 0);
			const totalTokens = usage?.tokens ?? estimatedTokens;
			const freeSpace = Math.max(0, contextWindow - totalTokens);
			const model = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "unknown";

			// Add message breakdown as detail on the Messages category
			if (messageCategory.tokens > 0) {
				const bd = breakdown;
				const breakdownLines = [
					`Tool calls: ~${formatTokens(bd.toolCallTokens)}t`,
					`Tool results: ~${formatTokens(bd.toolResultTokens)}t`,
					`Assistant text: ~${formatTokens(bd.assistantTextTokens)}t`,
					`User text: ~${formatTokens(bd.userTextTokens)}t`,
				];
				if (bd.toolCallsByName.size > 0) {
					breakdownLines.push("");
					breakdownLines.push("Tool usage:");
					for (const [name, info] of [...bd.toolCallsByName.entries()].sort((a, b) => b[1].calls - a[1].calls)) {
						breakdownLines.push(`  ${name}: ${info.calls} call${info.calls > 1 ? "s" : ""}`);
					}
				}
				// Prepend breakdown to message detail
				messageCategory.detail = [...breakdownLines, "", ...(messageCategory.detail ?? [])];
			}

			pi.sendMessage({
				customType: REPORT_TYPE,
				display: true,
				content: "",
				details: {
					model,
					totalTokens,
					estimatedTokens,
					contextWindow,
					percentage: usage?.percent ?? (totalTokens / contextWindow) * 100,
					categories,
					freeSpace,
				} satisfies ReportDetails,
			});
		},
	});
}
