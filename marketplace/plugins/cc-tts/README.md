# cc-tts

Text-to-speech for Claude Code. Reads assistant responses aloud using
[edge-tts](https://github.com/rany2/edge-tts) and `afplay` (macOS).

## Installation

**1. Add as a marketplace:**

```
/plugin marketplace add yilin-zhang/cc-tts
```

**2. Install the plugin:**

```
/plugin install cc-tts@cc-tts
```

**Or from a local directory:**

```
/plugin marketplace add /path/to/cc-tts
/plugin install cc-tts@cc-tts
```

After installing, run `/cc-tts:setup` to check and install dependencies.

### Requirements

- macOS (uses `afplay` for audio playback)
- Python 3
- [edge-tts](https://github.com/rany2/edge-tts)
- `jq`

## Usage

- `/cc-tts:setup` — Check dependencies, install edge-tts, and configure global defaults
- `/cc-tts:on` — Turn TTS on for the current project
- `/cc-tts:off` — Turn TTS off and kill the daemon
- `/cc-tts:stop` — Stop playback immediately and clear the queue
- `/cc-tts:settings` — Change voice and rate (global or per-project)

When TTS is on, a background daemon watches the session transcript and reads
new assistant text blocks aloud. Sending a new message stops the current
playback automatically.

## How it works

1. A `UserPromptSubmit` hook starts the daemon (if not running) and tells it
   where the session transcript is.
2. The daemon polls the transcript JSONL file for new assistant entries.
3. Text is stripped of markdown, split into sentences, and converted to MP3
   via `edge-tts` (sentences are generated concurrently).
4. Audio is played sequentially through `afplay`.
5. A `SessionEnd` hook kills the daemon when the session closes.

## Configuration

Run `/cc-tts:settings` to configure voice and rate interactively (global or per-project).

Config is stored as JSON:
- **Global** (all projects): `~/.claude/cc-tts/config.json`
- **Per-project** (overrides global): `./.claude/cc-tts/config.json`

```json
{
  "enabled": true,
  "voice": "en-US-ChristopherNeural",
  "rate": 1.0
}
```

`rate`: `1.0` = normal, `1.5` = 50% faster, `0.75` = 25% slower. See
[edge-tts voices](https://github.com/rany2/edge-tts#listing-voices) for available voices.

Restart the daemon (`/cc-tts:off` then `/cc-tts:on`) to apply voice/rate changes.

## Files

| File | Purpose |
|------|---------|
| `hooks/tts_daemon.py` | Background daemon: transcript polling, TTS generation, playback |
| `hooks/on_prompt.sh` | UserPromptSubmit hook: starts daemon, relays session info |
| `hooks/on_stop.sh` | SessionEnd hook: kills daemon and cleans up |
| `commands/setup.md` | `/cc-tts:setup` — dependency check, install, and global config |
| `commands/on.md` | `/cc-tts:on` — enable TTS |
| `commands/off.md` | `/cc-tts:off` — disable TTS |
| `commands/stop.md` | `/cc-tts:stop` — stop playback |
| `commands/settings.md` | `/cc-tts:settings` — configure voice and rate |
