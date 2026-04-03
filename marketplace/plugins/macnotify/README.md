# macnotify

macOS notifications for Claude Code events, with per-event sounds and project name in the title.

## Installation

Inside Claude Code, register the local marketplace and install:

```
claude plugin marketplace add /path/to/the-c-suite/marketplace
claude plugin install macnotify@the-c-suite
```

## Notifications

| Event | Message | Default Sound |
|---|---|---|
| Claude finishes a task | ✅ Task complete | Glass |
| Background agent finishes | 🤖 Agent complete | Purr |
| Plan ready for review | 📋 Plan ready for review | Hero |
| Claude needs your input | ❓ Claude needs your input | Ping |
| Permission requested | 🔔 Permission requested | Frog |

## Configuration

Run `/macnotify:settings` to configure sounds interactively.

To configure manually, create `~/.claude/macnotify/sounds.sh`:

```sh
# Valid sounds: Basso, Blow, Bottle, Frog, Funk, Glass, Hero, Morse, Ping, Pop, Purr, Sosumi, Submarine, Tink
# Set to "" to silence a notification

SOUND_STOP="Glass"
SOUND_SUBAGENT_STOP="Purr"
SOUND_PLAN_READY="Hero"
SOUND_QUESTION="Ping"
SOUND_PERMISSION="Frog"
```

Changes take effect immediately — no restart needed.

## Requirements

- macOS (uses `osascript` — no dependencies)
