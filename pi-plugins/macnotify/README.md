# macnotify

macOS notifications for pi events.

## Events

| Event | Message | Default Sound |
|---|---|---|
| Agent finishes a task | ✅ Task complete | Glass |
| Tool execution errors | 🔴 Tool error | Basso |
| Context compaction completes | 🗜️ Context compacted | Hero |

Compaction notifications are disabled by default.

## Install

Option 1: load directly from this repo in `~/.pi/agent/settings.json`:

```json
{
  "extensions": ["/Users/yilinzhang/the-c-suite/pi-plugins/macnotify/index.ts"]
}
```

Option 2: symlink into pi's extension directory:

```bash
mkdir -p ~/.pi/agent/extensions/macnotify
ln -sf /Users/yilinzhang/the-c-suite/pi-plugins/macnotify/index.ts ~/.pi/agent/extensions/macnotify/index.ts
```

Then run `/reload` inside pi, or restart pi.

## Commands

- `/macnotify-toggle` — Toggle global notifications on or off
- `/macnotify-toggle project` — Toggle project-local notifications on or off
- `/macnotify-status` — Show effective settings
- `/macnotify-test [agentComplete|toolError|compaction]` — Send a test notification

## Config

The extension reads config from two locations, with project overriding global:

- Global: `~/.pi/agent/macnotify.json`
- Project: `.pi/macnotify.json`

Example global config:

```json
{
  "enabled": true,
  "titlePrefix": "pi",
  "includeProjectName": true,
  "cooldownMs": 5000,
  "notifyOn": {
    "agentComplete": true,
    "toolError": true,
    "compaction": false
  },
  "sounds": {
    "agentComplete": "Glass",
    "toolError": "Basso",
    "compaction": "Hero"
  }
}
```

Set a sound to `""` for silent notifications.

## Requirements

- macOS (`osascript`)
