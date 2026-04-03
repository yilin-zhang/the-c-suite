---
description: Turn text-to-speech off
---

Turn TTS off for this session. Use the Bash tool to run:

```bash
python3 -c "
import json, os
path = os.path.join(os.getcwd(), '.claude/cc-tts/config.json')
if os.path.exists(path):
    with open(path) as f:
        config = json.load(f)
    config['enabled'] = False
    with open(path, 'w') as f:
        json.dump(config, f, indent=2)
"
NS=$(echo -n "$PWD" | md5 | cut -c1-8)
PID_FILE="/tmp/cc-tts-${NS}.pid"
pkill -x afplay 2>/dev/null
if [ -f "$PID_FILE" ]; then
  kill "$(cat "$PID_FILE")" 2>/dev/null
  rm -f "$PID_FILE"
fi
echo "TTS is now OFF"
```

Report the output to the user.
