# exit-banner

Prints a styled resume banner when pi exits.

## What it does

On shutdown, the extension remembers the current session id and prints a
small banner after pi restores the terminal. The banner shows:

- the session title
- the resume command: `pi --session <id>`

## Install

Preferred:

```bash
python3 ~/the-c-suite/setup.py --pi-only --verbose
```

Or add it manually to `~/.pi/agent/settings.json`:

```json
{
  "extensions": ["/Users/yilinzhang/the-c-suite/pi-plugins/exit-banner/index.ts"]
}
```

Then run `/reload` in pi.

## Notes

- the banner is printed only once per process
- if the session has no custom name, the current directory name is used

## Tests

```bash
cd ~/the-c-suite
node --experimental-strip-types --test pi-plugins/exit-banner/test.ts
```
