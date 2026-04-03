---
description: Turn text-to-speech on
---

Turn TTS on for this session. Use the Bash tool to run:

```bash
python3 -c "
import json, os
path = os.path.join(os.getcwd(), '.claude/cc-tts/config.json')
os.makedirs(os.path.dirname(path), exist_ok=True)
config = {}
if os.path.exists(path):
    with open(path) as f:
        config = json.load(f)
config.setdefault('voice', 'en-US-ChristopherNeural')
config.setdefault('rate', 1.0)
config['enabled'] = True
with open(path, 'w') as f:
    json.dump(config, f, indent=2)
print('TTS is now ON')
"
```

Report the output to the user.
