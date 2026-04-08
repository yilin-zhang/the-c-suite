# role

Session roles for pi, backed by markdown prompt files.

## What it does

This extension lets you choose a full replacement system prompt for a
session.

Role files are loaded from:

- `~/.pi/agent/roles/*.md`
- `<cwd>/.pi/roles/*.md`

Project-local roles override global roles with the same filename.

## Behavior

- empty sessions default to the built-in `code` role
- custom role files fully replace the system prompt when selected
- `/role` opens a picker before the first message
- once conversation history exists, the role is locked for that session
- the selected role is persisted in session history

## Install

Preferred:

```bash
python3 ~/the-c-suite/setup.py --pi-only --verbose
```

Or add it manually to `~/.pi/agent/settings.json`:

```json
{
  "extensions": ["/Users/yilinzhang/the-c-suite/pi-plugins/role/index.ts"]
}
```

Then run `/reload` in pi.

## Commands

- `/role`
- `/role list`
- `/role status`

## CLI flag

- `--role <name>`
