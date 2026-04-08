---
description: Bootstrap the-c-suite on a new machine
allowed-tools: Bash, Read, AskUserQuestion
---

Set up the-c-suite repository from scratch.

## Steps

1. **Check dependencies**: Run `command -v python3`. If missing, ask the
   user to install Python 3.

2. **Locate the repo**: Look for `setup.py` relative to the current
   working directory, or at `~/the-c-suite`. If not found, ask the user
   where to clone it, then run:
   ```
   git clone <repo-url> <target-dir>
   ```

3. **Dry run**: Preview what will be synced:
   ```
   python3 <repo-root>/setup.py --dry-run --verbose
   ```
   Show the output to the user and ask if it looks good.

4. **Sync skills, OpenCode plugins, pi plugins, and pi themes**: Run for real:
   ```
   python3 <repo-root>/setup.py --verbose
   ```
   The script symlinks each skill directory into the target agent
   directories, copies OpenCode `.ts` plugins, symlinks OpenCode `.md`
   commands, registers pi plugin entrypoints in
   `~/.pi/agent/settings.json` under `extensions`, and registers pi theme
   files under `themes`.

5. **OpenCode plugins**: For each directory under `<repo-root>/oc-plugins/`,
   read its `README.md` and follow any additional setup instructions there.

6. **pi plugins**: For each directory under `<repo-root>/pi-plugins/`,
   read its `README.md` and follow any additional setup instructions there.

7. **pi themes**: Read `<repo-root>/pi-themes/README.md` and ensure the
   selected theme name in pi settings matches one of the synced theme files.

8. **Claude Code plugins**: Register the local marketplace and install
   plugins:
   ```
   claude plugin marketplace add <repo-root>/marketplace
   ```
   Then ask the user which plugins they want. For each one:
   ```
   claude plugin install <plugin-name>@the-c-suite
   ```
   Available plugins: macnotify, cc-tts, claude-hud.

9. **Report results**: Summarize what was synced and installed. If there
   were warnings about existing non-symlink files, explain that the user
   can remove them and re-run setup.

## Notes

- This command is for first-time setup. For subsequent syncs, use
  `commands/sync.md`.
- The setup script is idempotent — safe to run multiple times.
- Skills are symlinked individually (e.g. `~/.claude/skills/pdf` ->
  `the-c-suite/skills/pdf`). The skills directories themselves must be
  regular directories, not symlinks.
