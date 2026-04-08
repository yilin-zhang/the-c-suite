# pi-themes

Custom themes for pi.

## Layout

Each theme is a JSON file in this directory, for example:

- `pi-themes/gruvbox-dark.json`

## Install

Preferred:

```bash
python3 ~/the-c-suite/setup.py --pi-only --verbose
```

This registers theme file paths in `~/.pi/agent/settings.json` under
`themes`.

Then select the theme by name in pi settings, for example:

```json
{
  "theme": "gruvbox-dark"
}
```

## Notes

- `theme` selects a theme by name
- `themes` provides extra theme file or directory paths for discovery
