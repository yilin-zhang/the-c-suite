---
description: Synchronize skills and plugins to their target directories
allowed-tools: Bash, Read
---

Re-sync all skills, OpenCode plugins, and Claude Code plugins after
pulling new changes.

## Steps

1. **Determine the repo root**: Use the directory containing this
   `commands/` folder, or `git rev-parse --show-toplevel`.

2. **Sync skills and OpenCode plugins**:
   ```
   python3 <repo-root>/setup.py --verbose
   ```
   If the user passed `--dry-run`, add `--dry-run` to the command.

3. **OpenCode plugins**: For each directory under `<repo-root>/oc-plugins/`,
   read its `README.md` and follow the setup instructions there to ensure
   files are in place.

4. **Claude Code plugins**: Run `claude plugin update <name>` for each
   installed the-c-suite plugin to pick up any changes. You can check
   which are installed with `claude plugin list`.

5. **Report** the output summary to the user.

## Notes

- The script is idempotent — running it multiple times is safe.
- "WARN" entries mean a non-symlink file already exists at the destination.
  The user may need to remove it manually if they want the symlink instead.
