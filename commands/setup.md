---
description: Bootstrap the-c-suite on a new machine
allowed-tools: Bash, Read, AskUserQuestion
---

Set up the-c-suite repository from scratch.

## Steps

1. **Check dependencies**: Run `command -v jq`. If missing, ask the user
   which package manager they use and install it:
   - macOS: `brew install jq`
   - Debian/Ubuntu: `sudo apt-get install -y jq`
   - Fedora: `sudo dnf install -y jq`
   - Arch: `sudo pacman -S jq`

2. **Locate the repo**: Look for `scripts/setup.sh` relative to the current
   working directory, or at `~/the-c-suite`. If not found, ask the user
   where to clone it, then run:
   ```
   git clone <repo-url> <target-dir>
   ```

3. **Dry run**: Preview what will be synced:
   ```
   bash <repo-root>/scripts/setup.sh --dry-run --verbose
   ```
   Show the output to the user and ask if it looks good.

4. **Sync skills and OpenCode plugins**: Run for real:
   ```
   bash <repo-root>/scripts/setup.sh --verbose
   ```
   The script symlinks each skill directory into the target agent
   directories and symlinks OpenCode plugin/command files.

5. **OpenCode plugins**: For each directory under `<repo-root>/oc-plugins/`,
   read its `README.md` and follow the setup instructions there (typically
   symlinking `.ts` files to `~/.config/opencode/plugin/` and `.md` command
   files to `~/.config/opencode/command/`).

6. **Claude Code plugins**: Register the local marketplace and install
   plugins:
   ```
   claude plugin marketplace add <repo-root>/marketplace
   ```
   Then ask the user which plugins they want. For each one:
   ```
   claude plugin install <plugin-name>@the-c-suite
   ```
   Available plugins: macnotify, cc-tts, claude-hud.

7. **Report results**: Summarize what was synced and installed. If there
   were warnings about existing non-symlink files, explain that the user
   can remove them and re-run setup.

## Notes

- This command is for first-time setup. For subsequent syncs, use
  `commands/sync.md`.
- The setup script is idempotent — safe to run multiple times.
- Skills are symlinked individually (e.g. `~/.claude/skills/pdf` ->
  `the-c-suite/skills/pdf`). The skills directories themselves must be
  regular directories, not symlinks.
