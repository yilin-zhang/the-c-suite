---
description: Uninstall the-c-suite
allowed-tools: Bash, Read, AskUserQuestion
---

Remove everything installed by the-c-suite.

## Steps

1. **Determine the repo root**: Use the directory containing this
   `commands/` folder, or `git rev-parse --show-toplevel`.

2. **Skills**: Read `<repo-root>/skills/config.json`. For each path in
   the `paths` object, find and remove all symlinks in that directory
   that point back into the repo's `skills/` directory. Leave non-symlink
   entries (like `coc-keeper`) untouched.

3. **OpenCode plugins**: For each directory under `<repo-root>/oc-plugins/`,
   read its `README.md` and follow the uninstall instructions there
   (typically removing symlinks from `~/.config/opencode/plugin/` and
   `~/.config/opencode/command/`).

4. **Claude Code plugins**: Tell the user to uninstall each plugin
   manually inside Claude Code:
   ```
   claude plugin uninstall macnotify
   claude plugin uninstall cc-tts
   claude plugin uninstall claude-hud
   ```
   Then remove the marketplace:
   ```
   claude plugin marketplace remove the-c-suite
   ```

5. **Config files**: Ask the user if they also want to remove config
   files created by the plugins:
   - `~/.config/opencode/macnotify.json`
   - `~/.claude/macnotify/`
   - `~/.claude/cc-tts/`
   - `~/.claude/plugins/claude-hud/config.json`
   Only remove if the user confirms.

6. **pi themes**: Remove any `~/.pi/agent/settings.json` entries under
   `themes` that point into the repo's `pi-themes/` directory. Ask before
   removing any copied or symlinked files under `~/.pi/agent/themes/`.

7. **Report** what was removed.
