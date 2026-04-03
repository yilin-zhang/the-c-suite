---
description: Stop TTS playback and clear the queue
---

Stop TTS playback immediately and clear the queue. Use the Bash tool to run:

```bash
NS=$(echo -n "$PWD" | md5 | cut -c1-8)
PID_FILE="/tmp/cc-tts-${NS}.pid"
pkill -x afplay 2>/dev/null
[ -f "$PID_FILE" ] && kill -USR1 "$(cat "$PID_FILE")" 2>/dev/null
echo "Playback stopped."
```

Confirm to the user that playback has been stopped.
