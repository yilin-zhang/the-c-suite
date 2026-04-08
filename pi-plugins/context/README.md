# context

Shows a context-window usage report inside pi.

## What it does

The `/context` command renders a breakdown of estimated context usage for:

- system prompt
- project context
- skills
- tool schemas
- messages
- remaining free space

It also shows per-category detail and a simple visual usage grid.

## Install

Preferred:

```bash
python3 ~/the-c-suite/setup.py --pi-only --verbose
```

Or add it manually to `~/.pi/agent/settings.json`:

```json
{
  "extensions": ["/Users/yilinzhang/the-c-suite/pi-plugins/context/index.ts"]
}
```

Then run `/reload` in pi.

## Command

- `/context`
