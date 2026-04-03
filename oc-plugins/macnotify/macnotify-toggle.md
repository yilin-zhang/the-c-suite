---
description: Toggle macnotify notifications on or off
allowed-tools: Bash
---

Toggle macnotify notifications on or off.

## Steps

1. Read the current config from `~/.config/opencode/macnotify.json`.
   If the file doesn't exist, notifications are enabled by default.

2. Flip the `enabled` field to its opposite value.

3. Write the updated config back to `~/.config/opencode/macnotify.json`.

4. Report the new state to the user (e.g. "Notifications are now off").
