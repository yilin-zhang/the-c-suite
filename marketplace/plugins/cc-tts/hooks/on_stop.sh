#!/bin/bash
# Stop hook: kill the TTS daemon when the session ends.

NS=$(echo -n "$PWD" | md5 | cut -c1-8)
PID_FILE="/tmp/cc-tts-${NS}.pid"
PIPE="/tmp/cc-tts-${NS}.pipe"

[ -f "$PID_FILE" ] || exit 0

kill "$(cat "$PID_FILE")" 2>/dev/null
pkill -x afplay 2>/dev/null
rm -f "$PID_FILE" "$PIPE"
