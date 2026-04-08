# session-color

Per-session accent colors for pi.

## What it does

- adds `/session-color` to pick a session accent
- adds `/session-color-reset` to restore the default accent
- colors the editor border and session-name badge
- keeps the choice in session history so it survives reload/resume
- reads legacy saved keys for backward compatibility

## Install

Preferred:

```bash
python3 ~/the-c-suite/setup.py --pi-only --verbose
```

Or add it manually to `~/.pi/agent/settings.json`:

```json
{
  "extensions": ["/Users/yilinzhang/the-c-suite/pi-plugins/session-color/index.ts"]
}
```

Then run `/reload` in pi.

## Commands

- `/session-color`
- `/session-color-reset`

## Persistence

New sessions save the accent under:

- `session-color`

The extension also reads older saved keys:

- `session-color-state`
- `claude-session-ui-state`

## Tests

```bash
cd ~/the-c-suite
node --experimental-strip-types --test pi-plugins/session-color/test.ts
```
