---
description: Check dependencies and install edge-tts
---

Run the setup checks below step by step using the Bash tool. Report results to the user as you go.

## Step 1: Check platform

```bash
uname -s
```

If not `Darwin`, warn the user that cc-tts requires macOS (uses `afplay` for playback) and stop.

## Step 2: Check core tools

```bash
which python3 && python3 --version
which jq
which afplay
```

Report any missing tools. `jq` can be installed via `brew install jq`. `afplay` ships with macOS. If `python3` is missing, stop and tell the user to install Python 3 first.

## Step 3: Check for uv

```bash
which uv
```

- **If `uv` is found**, go to Step 4a.
- **If `uv` is not found**, ask the user:
  > `uv` is not installed. Would you like to:
  > 1. Install `uv` (recommended) — I'll run `curl -LsSf https://astral.sh/uv/install.sh | sh`
  > 2. Use system Python and pip instead

  If user picks 1, install uv and go to Step 4a. If user picks 2, go to Step 4b.

## Step 4a: Install edge-tts with uv

```bash
uv tool install edge-tts
```

Then verify:

```bash
which edge-tts && edge-tts --version
```

Go to Step 5.

## Step 4b: Install edge-tts with pip

```bash
pip3 install edge-tts
```

Then verify:

```bash
which edge-tts && edge-tts --version
```

Go to Step 5.

## Step 5: Verify everything

```bash
echo "=== cc-tts dependency check ==="
echo -n "python3: " && python3 --version 2>&1
echo -n "jq:      " && (which jq > /dev/null 2>&1 && echo "ok" || echo "MISSING")
echo -n "afplay:  " && (which afplay > /dev/null 2>&1 && echo "ok" || echo "MISSING")
echo -n "edge-tts:" && (which edge-tts > /dev/null 2>&1 && edge-tts --version 2>&1 || echo "MISSING")
```

If any dependency is missing, stop and report the issue. Do not proceed to Step 6.

## Step 6: Create global config

```bash
python3 -c "
import json, os
path = os.path.expanduser('~/.claude/cc-tts/config.json')
os.makedirs(os.path.dirname(path), exist_ok=True)
if not os.path.exists(path):
    config = {'enabled': False, 'voice': 'en-US-ChristopherNeural', 'rate': 1.0}
    with open(path, 'w') as f:
        json.dump(config, f, indent=2)
    print('created')
else:
    print('exists')
"
```

## Step 7: Configure voice and rate

Now ask the user to configure their global defaults (2 questions):

**Q1: Voice**
- header: "Voice"
- question: "Default speaker? — type any edge-tts voice name via Other"
- multiSelect: false
- options:
  - "en-US-ChristopherNeural" – US English, male (default)
  - "en-US-JennyNeural" – US English, female
  - "en-GB-RyanNeural" – British English, male
  - "en-AU-NatashaNeural" – Australian English, female

**Q2: Rate**
- header: "Rate"
- question: "Default speed?"
- multiSelect: false
- options:
  - "1.0" – Normal (default)
  - "0.75" – Slower
  - "1.25" – Faster
  - "1.5" – Fast

Write the chosen voice and rate to `~/.claude/cc-tts/config.json`, preserving `enabled` and any other existing fields.

## Step 8: Done

Say: "Setup complete! Run `/cc-tts:on` to enable TTS in any project."
