# The C-Suite

The **C**laude Code, Open**C**ode, and **C**odex suite — skills and
plugins for your AI agents, and you, a C-Suite level engineer.

## 🚀 Setup

If you're an AI agent, read `commands/setup.md` and follow it.

## 🔄 Updating

After `git pull`, read `commands/sync.md` and follow it.

## 🗑️ Uninstalling

Read `commands/uninstall.md` and follow it.

## ⚙️ How It Works

Each skill directory is **symlinked** individually into each agent's
skills directory (e.g. `~/.claude/skills/pdf` -> `the-c-suite/skills/pdf`).
The skills directories themselves are regular directories, not symlinks.

Claude Code plugins are installed through a **local marketplace**
registered via `claude plugin marketplace add`. OpenCode `.ts` plugins
are copied (not symlinked — imports break with symlinks). OpenCode `.md`
commands are symlinked.

Skills update instantly on `git pull` (symlinks). Claude Code plugins
need to be upgraded inside Claude Code after pulling. OpenCode `.ts`
plugins need to be re-synced after pulling.

## 🧠 Skills

Reusable agent workflows. Each skill lives in `skills/<name>/SKILL.md`.

| Skill | Agents | Description |
|---|---|---|
| 🔀 batch | codex, opencode | Parallel work orchestration for large-scale refactors |
| 💾 commit | codex, opencode | Safe git commit creation with style matching |
| 🔍 review | codex, opencode | Code review for PRs (correctness, conventions, security) |
| ✨ simplify | codex, opencode | Code cleanup pass with parallel review agents |
| 🛠️ skillify | codex, opencode | Capture a repeatable process as a reusable skill |
| ✅ verify | codex, opencode | Verify code changes by actually running them |
| 🔎 elisp-nav | all | Fast Emacs Lisp navigation (definitions, references, forms) |
| 📦 elisp-pkg-audit | all | Audit and selectively upgrade Emacs packages |
| 🖥️ emacsclient | all | Always use emacsclient for Emacs operations |
| 📚 epub-cleanup | all | Clean and normalize EPUB/KEPUB files |
| 🗂️ index-codebase | all | Generate structured feature specs for a codebase |
| 📄 pdf | all | Read, merge, split, rotate, watermark, fill forms, OCR PDFs |

## 🔌 Plugins

### Claude Code

Installed via local marketplace (`claude plugin marketplace add`).

| Plugin | Description |
|---|---|
| 🔔 macnotify | macOS notifications for Claude Code events |
| 🔊 cc-tts | Text-to-speech for assistant responses (edge-tts) |
| 📊 claude-hud | Real-time statusline: context health, tools, agents, todos |

### OpenCode

`.ts` files are copied (not symlinked — imports break with symlinks).
`.md` commands are symlinked into `~/.config/opencode/commands/`.

| Plugin | Description |
|---|---|
| 🔔 macnotify | macOS notifications for OpenCode events |

## 📁 Directory Layout

```
the-c-suite/
├── skills/               # 🧠 Agent skills (SKILL.md per skill)
│   └── config.json       # Skill → agent mapping and target paths
├── marketplace/plugins/  # 🔌 Claude Code plugins
├── oc-plugins/           # 🔌 OpenCode plugins (read each README)
├── commands/             # 📋 Agent commands (setup, sync, uninstall)
├── tests/                # 🧪 Global tests
└── setup.py              # ⚙️ Bootstrap and sync script
```

## 🧑‍💻 Contributing

### Adding a skill

1. Create `skills/<name>/SKILL.md` with YAML frontmatter following the
   [agentskills.io spec](https://agentskills.io/specification) (`name`,
   `description` required, `name` must match directory name).
2. Register it in `skills/config.json` with the target agents.
3. Tests in `tests/test_skills.py` will automatically validate it.

### Adding a Claude Code plugin

1. Create `marketplace/plugins/<name>/` with `.claude-plugin/plugin.json`,
   `hooks/hooks.json`, and any commands/scripts.
2. Add it to `marketplace/.claude-plugin/marketplace.json`.
3. If the plugin has its own tests, add a `ci.sh` script at the plugin
   root that runs them. CI auto-discovers and runs every `ci.sh` found
   under `marketplace/plugins/`.
4. Tests in `tests/test_plugins.py` will automatically validate plugin
   manifest integrity (JSON, referenced files exist, scripts executable).

### Adding an OpenCode plugin

1. Create `oc-plugins/<name>/` with the `.ts` plugin file, any `.md`
   command files, and a `README.md` with setup/uninstall instructions.
2. `setup.py` will auto-discover it. `.ts` files are copied (not
   symlinked), `.md` commands are symlinked.
