# cc-tts

Text-to-speech for Claude Code. Reads assistant responses aloud using
[edge-tts](https://github.com/rany2/edge-tts) and `afplay` (macOS).

## Installation

Install via the-c-suite local marketplace:

```
claude plugin marketplace add /path/to/the-c-suite/marketplace
claude plugin install cc-tts@the-c-suite
```

After installing, run `/cc-tts:setup` to check and install dependencies.

## Requirements

- macOS (uses `afplay` for audio playback)
- Python 3
- [edge-tts](https://github.com/rany2/edge-tts)
- `jq`

## Commands

- `/cc-tts:setup` — Check dependencies, install edge-tts, configure defaults
- `/cc-tts:on` — Turn TTS on for the current project
- `/cc-tts:off` — Turn TTS off and kill the daemon
- `/cc-tts:stop` — Stop playback immediately and clear the queue
- `/cc-tts:settings` — Change voice and rate (global or per-project)

## How It Works

1. A `UserPromptSubmit` hook starts the daemon and passes the transcript path.
2. The daemon polls the transcript JSONL for new assistant text.
3. Text is stripped of markdown, split into sentences, and converted to MP3
   via `edge-tts` (sentences generated concurrently).
4. Audio plays sequentially through `afplay`.
5. Sending a new message stops current playback automatically.
6. A `SessionEnd` hook kills the daemon when the session closes.

## Configuration

Run `/cc-tts:settings` to configure voice and rate (global or per-project).

Config is stored as JSON:
- **Global**: `~/.claude/cc-tts/config.json`
- **Per-project**: `./.claude/cc-tts/config.json`

```json
{
  "enabled": true,
  "voice": "en-US-ChristopherNeural",
  "rate": 1.0
}
```

`rate`: `1.0` = normal, `1.5` = 50% faster, `0.75` = 25% slower.
