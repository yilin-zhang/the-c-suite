# cc-tts Plugin Spec

## Overview

A Claude Code plugin that reads assistant responses from the session transcript
and plays them via text-to-speech using edge-tts and afplay (macOS).

## Design Principles

- Daemon lifecycle is tied to the Claude Code session via hooks (no manual management)
- TTS on/off is a per-project flag stored in the project's `.claude/` directory
- No writes to `~/.claude` during normal operation
- Slash commands contain all logic inline — no wrapper scripts needed

## Data Directory

```
$PWD/.claude/cc-tts/
  enabled                  # presence = TTS is on for this project; absence = off

/tmp/
  cc-tts-<NS>.pid          # PID of the running tts_daemon.py process
  cc-tts-<NS>.pipe         # named FIFO for session updates to daemon
```

`<NS>` is the first 8 hex chars of `md5($PWD)`, so each project directory
gets its own daemon and FIFO without cross-session conflicts.

## Session Lifecycle

- **Daemon start**: lazy — started by `on_prompt.sh` on first prompt when TTS is enabled
- **Daemon stop**: `on_stop.sh` kills the daemon when the session ends

## Components

### hooks/hooks.json

Registers `on_prompt.sh` on `UserPromptSubmit` and `on_stop.sh` on `SessionEnd`.

### hooks/on_prompt.sh

Runs on every user prompt:
- If TTS not enabled, exit immediately
- Start daemon if not running
- Stop current afplay playback and drain daemon queue (SIGUSR1)
- Read session_id and transcript_path from stdin
- Write session update to `/tmp/tts_pipe`

### hooks/on_stop.sh

Runs when the session ends:
- Kill the daemon process
- Kill any running afplay
- Remove PID file and named FIFO

### hooks/tts_daemon.py

Long-running process that watches the transcript JSONL for new assistant text
blocks, generates MP3s via edge-tts, and plays them via afplay. Accepts the
FIFO path as its first argument. Buffers incomplete trailing lines from the
transcript to avoid dropping partially-written entries. Responds to:
- `SIGUSR1`: stop current playback and drain queues
- `SIGTERM`: shut down

### commands/tts.md

Toggles the enabled flag inline via Bash tool:
- ON: `mkdir -p` + `touch $PWD/.claude/cc-tts/enabled`
- OFF: `rm -f` the flag, stop current playback via SIGUSR1

### commands/tts-stop.md

Stops playback inline via Bash tool: `pkill -x afplay` + SIGUSR1 to daemon.

## File Paths Summary

| File | Purpose |
|------|---------|
| `$PWD/.claude/cc-tts/enabled` | TTS on/off flag (per-project) |
| `/tmp/cc-tts-<NS>.pid` | Daemon PID (per-project) |
| `/tmp/cc-tts-<NS>.pipe` | Named FIFO for session updates (per-project) |
| `$CLAUDE_PLUGIN_ROOT/hooks/tts_daemon.py` | Daemon script |
| `$CLAUDE_PLUGIN_ROOT/hooks/on_prompt.sh` | UserPromptSubmit hook |
| `$CLAUDE_PLUGIN_ROOT/hooks/on_stop.sh` | Stop hook |

## What Was Removed

- `tts_toggle.sh` and `tts_stop.sh` — logic now inline in commands
- `tts-setup.md` — no setup needed
- `~/.claude/cc-tts/` wrapper scripts — no longer needed
- `CLAUDE_PLUGIN_DATA` usage
