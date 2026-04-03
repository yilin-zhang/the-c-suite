# macnotify

macOS notifications for OpenCode events.

## Setup

If you're an AI agent, create these symlinks:

```bash
ln -s <this-dir>/macnotify.ts ~/.config/opencode/plugins/macnotify.ts
ln -s <this-dir>/macnotify-toggle.md ~/.config/opencode/commands/macnotify-toggle.md
```

Where `<this-dir>` is the absolute path to this directory. Create the
target directories if they don't exist.

## Uninstall

Remove the symlinks:

```bash
rm ~/.config/opencode/plugins/macnotify.ts
rm ~/.config/opencode/commands/macnotify-toggle.md
```

Ask the user if they also want to remove their config files:

- Global: `~/.config/opencode/macnotify.json`
- Project: `./.opencode/macnotify.json`

## Events

- `session.idle` — Task complete (sound: Glass)
- `session.error` — Session error (sound: Basso)
- `permission.asked` — Permission requested (sound: Frog)
- `todo.updated` — Todo list updated (disabled by default, sound: Hero)

## Config

The plugin reads config from two locations (project overrides global):

- Global: `~/.config/opencode/macnotify.json`
- Project: `./.opencode/macnotify.json`

Settings can be configured via the built-in `macnotify_settings` tool
(e.g. "turn off todo notifications", "set the permission sound to Ping").

## Commands

- `/macnotify-toggle` — Toggle notifications on or off

## Requirements

- macOS (uses `osascript`)
