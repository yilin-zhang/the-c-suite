# hide-tools

Toggle built-in tool result visibility in the pi UI.

## What it does

`/hide-tools` hides or shows the result body for these built-in tools:

- `read`
- `bash`
- `edit`
- `write`
- `grep`
- `find`
- `ls`

The one-line tool call header still stays visible.

## Install

Preferred:

```bash
python3 ~/the-c-suite/setup.py --pi-only --verbose
```

Or add it manually to `~/.pi/agent/settings.json`:

```json
{
  "extensions": ["/Users/yilinzhang/the-c-suite/pi-plugins/hide-tools/index.ts"]
}
```

Then run `/reload` in pi.

## Command

- `/hide-tools`
