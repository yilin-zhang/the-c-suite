#!/bin/bash
# UserPromptSubmit hook.
# Stops current TTS playback and tells the daemon to watch the new session transcript.

# Read stdin immediately to avoid blocking the hook framework.
INPUT=$(timeout 2 cat) || true

PROJECT_CONFIG="$PWD/.claude/cc-tts/config.json"
GLOBAL_CONFIG="$HOME/.claude/cc-tts/config.json"

# Project config takes priority; fall back to global
CONFIG="$PROJECT_CONFIG"
[ -f "$CONFIG" ] || CONFIG="$GLOBAL_CONFIG"
[ -f "$CONFIG" ] || exit 0
python3 -c "import json,sys; d=json.load(open('$CONFIG')); sys.exit(0 if d.get('enabled') else 1)" || exit 0

NS=$(echo -n "$PWD" | md5 | cut -c1-8)
PID_FILE="/tmp/cc-tts-${NS}.pid"
PIPE="/tmp/cc-tts-${NS}.pipe"

# Start daemon if not running
PID=""
[ -f "$PID_FILE" ] && PID=$(cat "$PID_FILE")
if [ -z "$PID" ] || ! kill -0 "$PID" 2>/dev/null; then
  [ -p "$PIPE" ] || mkfifo "$PIPE"
  python3 "${CLAUDE_PLUGIN_ROOT}/hooks/tts_daemon.py" "$PIPE" "$CONFIG" </dev/null >/dev/null 2>&1 &
  PID=$!
  echo "$PID" > "$PID_FILE"
  sleep 0.3
fi

[ -p "$PIPE" ] || exit 0

# Stop current playback when user sends a new message
pkill -x afplay 2>/dev/null
kill -USR1 "$PID" 2>/dev/null

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript_path // empty')
[ -n "$SESSION_ID" ] && [ -n "$TRANSCRIPT" ] || exit 0

OFFSET=0
[ -f "$TRANSCRIPT" ] && OFFSET=$(wc -c < "$TRANSCRIPT" | tr -d ' ')
# Write to FIFO with timeout to avoid blocking if daemon reader is gone.
timeout 2 bash -c "echo '{\"session_id\": \"$SESSION_ID\", \"transcript_path\": \"$TRANSCRIPT\", \"offset\": $OFFSET}' > \"$PIPE\""
