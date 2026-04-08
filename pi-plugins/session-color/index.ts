import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

type ThemeLike = {
  fg?: (color: string, text: string) => string;
  getFgAnsi?: (color: string) => string;
  sourcePath?: string;
  bold?: (text: string) => string;
};

type FooterDataLike = {
  getGitBranch: () => string | null;
  getExtensionStatuses: () => ReadonlyMap<string, string>;
  getAvailableProviderCount: () => number;
};

type AccentChoice = {
  value: string;
  label: string;
};

type SessionCustomEntryLike = {
  type: string;
  customType?: string;
  data?: { accent?: unknown };
};

type AssistantUsageLike = {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  cost?: {
    total?: number;
  };
};

type AssistantMessageEntryLike = {
  type: string;
  message?: {
    role?: string;
    usage?: AssistantUsageLike;
  };
};

type UsageTotals = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
};

const SESSION_STATE_TYPE = "session-color";
const LEGACY_SESSION_STATE_TYPES = ["session-color-state", "claude-session-ui-state"] as const;
const ALL_SESSION_STATE_TYPES = new Set<string>([SESSION_STATE_TYPE, ...LEGACY_SESSION_STATE_TYPES]);
const DEFAULT_ACCENT = "accent";
const ACCENT_CHOICES: AccentChoice[] = [
  { value: "accent", label: "Accent" },
  { value: "borderAccent", label: "Border Accent" },
  { value: "success", label: "Success" },
  { value: "warning", label: "Warning" },
  { value: "error", label: "Error" },
  { value: "bashMode", label: "Bash Mode" },
  { value: "thinkingMedium", label: "Thinking Medium" },
  { value: "thinkingHigh", label: "Thinking High" },
];

async function loadModule(candidates: string[]) {
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return await import(candidate);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

function isWideCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    codePoint === 0x2329 ||
    codePoint === 0x232a ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1faff)
  );
}

function visibleWidth(text: string): number {
  let width = 0;
  for (const char of stripAnsi(text)) {
    const codePoint = char.codePointAt(0) ?? 0;
    width += isWideCodePoint(codePoint) ? 2 : 1;
  }
  return width;
}

function parseHexColor(spec: string) {
  const match = spec.match(/^#([0-9a-f]{6})$/i);
  if (!match) return undefined;
  return {
    r: Number.parseInt(match[1].slice(0, 2), 16),
    g: Number.parseInt(match[1].slice(2, 4), 16),
    b: Number.parseInt(match[1].slice(4, 6), 16),
  };
}

function colorSpecToAnsi(spec: string, mode: "fg" | "bg"): string | undefined {
  const value = spec.trim();
  const prefix = mode === "bg" ? "48" : "38";
  const hex = parseHexColor(value);
  if (hex) return `\x1b[${prefix};2;${hex.r};${hex.g};${hex.b}m`;
  if (/^\d{1,3}$/.test(value)) {
    const color = Number.parseInt(value, 10);
    if (color >= 0 && color <= 255) return `\x1b[${prefix};5;${color}m`;
  }
  return undefined;
}

function fgAnsiToBgAnsi(ansi: string): string {
  return ansi.replace("[38;", "[48;").replace("[39m", "[49m");
}

function sanitizeStatusText(text: string): string {
  return text.replace(/[\r\n\t]/g, " ").replace(/ +/g, " ").trim();
}

function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
  return `${Math.round(count / 1000000)}M`;
}

function resolveThemeBackgroundColor(theme?: ThemeLike): string | undefined {
  const sourcePath = theme?.sourcePath;
  if (!sourcePath) return undefined;

  try {
    const json = JSON.parse(readFileSync(sourcePath, "utf8"));
    const vars = typeof json?.vars === "object" && json.vars ? json.vars : {};
    const exportColors = typeof json?.export === "object" && json.export ? json.export : {};
    const candidates = [vars.bg0, vars.background, vars.bg, exportColors.cardBg, exportColors.pageBg, vars.selectedBg, vars.userMsgBg];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) return candidate;
    }
  } catch {}

  return undefined;
}

function resolveForegroundAnsi(spec: string, theme?: ThemeLike): string | undefined {
  const value = spec.trim();
  if (value === "themeBackground") {
    const derived = resolveThemeBackgroundColor(theme);
    return derived ? colorSpecToAnsi(derived, "fg") : undefined;
  }
  if (theme?.getFgAnsi) {
    try {
      return theme.getFgAnsi(value);
    } catch {}
  }
  return colorSpecToAnsi(value, "fg");
}

function resolveBackgroundAnsi(spec: string, theme?: ThemeLike): string | undefined {
  const value = spec.trim();
  if (theme?.getFgAnsi) {
    try {
      return fgAnsiToBgAnsi(theme.getFgAnsi(value));
    } catch {}
  }
  return colorSpecToAnsi(value, "bg");
}

function resolveForegroundStyler(spec: string, theme: ThemeLike | undefined, fallback: (text: string) => string) {
  const ansi = resolveForegroundAnsi(spec, theme);
  if (ansi) return (text: string) => `${ansi}${text}\x1b[39m`;
  return fallback;
}

function styleSessionName(text: string, accent: string, theme?: ThemeLike): string {
  const fgAnsi = resolveForegroundAnsi("themeBackground", theme) ?? "";
  const bgAnsi = resolveBackgroundAnsi(accent, theme) ?? "";
  return `${bgAnsi}${fgAnsi}${text}\x1b[0m`;
}

export function isSessionAccentCustomType(customType: string | undefined): boolean {
  return typeof customType === "string" && ALL_SESSION_STATE_TYPES.has(customType);
}

export function getSessionAccentFromEntries(entries: readonly SessionCustomEntryLike[]): string {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.type !== "custom" || !isSessionAccentCustomType(entry.customType)) continue;
    const accent = entry.data?.accent;
    if (typeof accent === "string" && accent.trim()) return accent.trim();
  }
  return DEFAULT_ACCENT;
}

export function collectUsageTotals(entries: readonly AssistantMessageEntryLike[]): UsageTotals {
  const totals: UsageTotals = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    cost: 0,
  };

  for (const entry of entries) {
    if (entry.type !== "message" || entry.message?.role !== "assistant") continue;
    const usage = entry.message.usage;
    totals.input += usage?.input ?? 0;
    totals.output += usage?.output ?? 0;
    totals.cacheRead += usage?.cacheRead ?? 0;
    totals.cacheWrite += usage?.cacheWrite ?? 0;
    totals.cost += usage?.cost?.total ?? 0;
  }

  return totals;
}

function previewChoiceLabel(theme: ThemeLike, choice: AccentChoice): string {
  const colorize = resolveForegroundStyler(choice.value, theme, (text) => text);
  return `${colorize("■")} ${choice.label}`;
}

export default async function sessionColor(pi: any) {
  const { CustomEditor, DynamicBorder } = await loadModule([
    "@mariozechner/pi-coding-agent",
    pathToFileURL("/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/dist/index.js").href,
  ]);
  const { Container, Text, SelectList, truncateToWidth } = await loadModule([
    "@mariozechner/pi-tui",
    pathToFileURL("/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/node_modules/@mariozechner/pi-tui/dist/index.js").href,
  ]);

  let appTheme: ThemeLike | undefined;
  let sessionAccent = DEFAULT_ACCENT;

  class SessionBorderEditor extends CustomEditor {
    private defaultBorderColor: (text: string) => string;
    private readTheme: () => ThemeLike | undefined;

    constructor(tui: any, theme: any, keybindings: any, readTheme: () => ThemeLike | undefined) {
      super(tui, theme, keybindings);
      this.defaultBorderColor = theme.borderColor;
      this.readTheme = readTheme;
    }

    render(width: number) {
      this.borderColor = resolveForegroundStyler(sessionAccent, this.readTheme(), this.defaultBorderColor);
      return super.render(width);
    }
  }

  function installUi(ctx: any) {
    if (!ctx.hasUI) return;
    appTheme = ctx.ui.theme;

    ctx.ui.setEditorComponent((tui: any, theme: any, keybindings: any) =>
      new SessionBorderEditor(tui, theme, keybindings, () => appTheme),
    );

    ctx.ui.setFooter((_tui: any, theme: any, footerData: FooterDataLike) => ({
      invalidate() {},
      render(width: number) {
        const totals = collectUsageTotals(ctx.sessionManager.getEntries());
        const contextUsage = ctx.getContextUsage?.();
        const contextWindow = contextUsage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
        const contextPercentValue = contextUsage?.percent ?? 0;
        const contextPercent = contextUsage?.percent !== null ? contextPercentValue.toFixed(1) : "?";

        let pwd = ctx.sessionManager.getCwd();
        const home = process.env.HOME || process.env.USERPROFILE;
        if (home && pwd.startsWith(home)) pwd = `~${pwd.slice(home.length)}`;

        const branch = footerData.getGitBranch();
        if (branch) pwd = `${pwd} (${branch})`;

        const sessionName = pi.getSessionName?.()?.trim();
        if (sessionName) pwd = `${pwd} • ${styleSessionName(` ${sessionName} `, sessionAccent, theme)}`;

        const statsParts = [];
        if (totals.input) statsParts.push(`↑${formatTokens(totals.input)}`);
        if (totals.output) statsParts.push(`↓${formatTokens(totals.output)}`);
        if (totals.cacheRead) statsParts.push(`R${formatTokens(totals.cacheRead)}`);
        if (totals.cacheWrite) statsParts.push(`W${formatTokens(totals.cacheWrite)}`);
        if (totals.cost || ctx.model) statsParts.push(`$${totals.cost.toFixed(3)}${ctx.model ? " (sub)" : ""}`);

        const autoIndicator = " (auto)";
        const contextPercentDisplay =
          contextPercent === "?"
            ? `?/${formatTokens(contextWindow)}${autoIndicator}`
            : `${contextPercent}%/${formatTokens(contextWindow)}${autoIndicator}`;
        if (contextPercentValue > 90) statsParts.push(theme.fg("error", contextPercentDisplay));
        else if (contextPercentValue > 70) statsParts.push(theme.fg("warning", contextPercentDisplay));
        else statsParts.push(contextPercentDisplay);

        let statsLeft = statsParts.join(" ");
        let statsLeftWidth = visibleWidth(statsLeft);
        if (statsLeftWidth > width) {
          statsLeft = truncateToWidth(statsLeft, width, "...");
          statsLeftWidth = visibleWidth(statsLeft);
        }

        const modelName = ctx.model?.id || "no-model";
        let rightSide = modelName;
        if (ctx.model?.reasoning) rightSide = `${modelName} • ${ctx.sessionManager.getState?.()?.thinkingLevel || "off"}`;
        if (footerData.getAvailableProviderCount() > 1 && ctx.model?.provider) {
          const withProvider = `(${ctx.model.provider}) ${rightSide}`;
          if (statsLeftWidth + 2 + visibleWidth(withProvider) <= width) rightSide = withProvider;
        }

        const rightSideWidth = visibleWidth(rightSide);
        const statsLine =
          statsLeftWidth + 2 + rightSideWidth <= width
            ? statsLeft + " ".repeat(width - statsLeftWidth - rightSideWidth) + rightSide
            : statsLeft;

        const lines = [
          truncateToWidth(theme.fg("dim", pwd), width, theme.fg("dim", "...")),
          theme.fg("dim", statsLine),
        ];

        const extensionStatuses = footerData.getExtensionStatuses();
        if (extensionStatuses.size > 0) {
          const statusLine = Array.from(extensionStatuses.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, text]) => sanitizeStatusText(text))
            .join(" ");
          lines.push(truncateToWidth(statusLine, width, theme.fg("dim", "...")));
        }

        return lines;
      },
    }));
  }

  function persistAccent(accent: string) {
    sessionAccent = accent;
    pi.appendEntry(SESSION_STATE_TYPE, { accent });
  }

  async function showAccentPicker(ctx: any): Promise<string | undefined> {
    const items = ACCENT_CHOICES.map((choice) => ({
      value: choice.value,
      label: previewChoiceLabel(ctx.ui.theme, choice),
      description: choice.value,
    }));
    const currentIndex = Math.max(0, ACCENT_CHOICES.findIndex((choice) => choice.value === sessionAccent));

    return ctx.ui.custom(
      (tui: any, theme: ThemeLike, _kb: any, done: (result: string | undefined) => void) => {
        const container = new Container();
        const borderColor = (text: string) => theme.fg?.("accent", text) ?? text;
        container.addChild(new DynamicBorder(borderColor));
        container.addChild(new Text(theme.fg?.("accent", theme.bold?.("Pick session accent") ?? "Pick session accent") ?? "Pick session accent", 1, 0));

        const selectList = new SelectList(items, Math.min(items.length, 10), {
          selectedPrefix: (text: string) => theme.fg?.("accent", text) ?? text,
          selectedText: (text: string) => theme.fg?.("accent", text) ?? text,
          description: (text: string) => theme.fg?.("muted", text) ?? text,
          scrollInfo: (text: string) => theme.fg?.("dim", text) ?? text,
          noMatch: (text: string) => theme.fg?.("warning", text) ?? text,
        });
        selectList.setSelectedIndex(currentIndex);
        selectList.onSelectionChange = (item: { value: string }) => {
          sessionAccent = item.value;
          tui.requestRender();
        };
        selectList.onSelect = (item: { value: string }) => done(item.value);
        selectList.onCancel = () => done(undefined);
        container.addChild(selectList);

        const previewName = pi.getSessionName?.()?.trim() || "Session name";
        container.addChild(new Text(theme.fg?.("dim", "Preview") ?? "Preview", 1, 0));
        container.addChild(new Text(styleSessionName(` ${previewName} `, sessionAccent, theme), 1, 0));
        container.addChild(new DynamicBorder(borderColor));

        return {
          render(width: number) {
            return container.render(width);
          },
          invalidate() {
            container.invalidate();
          },
          handleInput(data: string) {
            selectList.handleInput(data);
            tui.requestRender();
          },
        };
      },
      { overlay: true },
    );
  }

  pi.on("session_start", async (_event: any, ctx: any) => {
    sessionAccent = getSessionAccentFromEntries(ctx.sessionManager.getEntries());
    installUi(ctx);
  });

  pi.registerCommand("session-color", {
    description: "Pick one accent color for this session",
    handler: async (_args: string, ctx: any) => {
      const previousAccent = sessionAccent;
      const picked = await showAccentPicker(ctx);
      if (!picked) {
        sessionAccent = previousAccent;
        installUi(ctx);
        return;
      }
      persistAccent(picked);
      installUi(ctx);
      ctx.ui.notify(`Session accent set to ${picked}`, "success");
    },
  });

  pi.registerCommand("session-color-reset", {
    description: "Reset this session's accent color",
    handler: async (_args: string, ctx: any) => {
      persistAccent(DEFAULT_ACCENT);
      installUi(ctx);
      ctx.ui.notify("Session accent reset", "success");
    },
  });
}
