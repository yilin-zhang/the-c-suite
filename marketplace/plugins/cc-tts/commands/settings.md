---
description: Configure TTS voice and rate (global or per-project)
allowed-tools: Read, Write, AskUserQuestion, Bash
---

# Configure cc-tts

## Config paths
- **Global**: `~/.claude/cc-tts/config.json` — default for all projects
- **Project**: `./.claude/cc-tts/config.json` — overrides global for this project

## Step 1 — Read current values

Check both config files and load the effective values:
1. Read `~/.claude/cc-tts/config.json` if it exists (global)
2. Read `./.claude/cc-tts/config.json` if it exists (project, overrides global)

Use defaults if neither exists: `voice = en-US-ChristopherNeural`, `rate = 1.0`

## Step 2 — Ask all settings in one call (3 questions)

**Q1: Scope**
- header: "Scope"
- question: "Apply to all projects or just this one?"
- multiSelect: false
- options:
  - "Global" – save to ~/.claude/cc-tts/config.json
  - "This project" – save to ./.claude/cc-tts/config.json

**Q2: Voice**
- header: "Voice"
- question: "Speaker? (current: `{voice}`) — type any edge-tts voice name via Other"
- multiSelect: false
- options:
  - "en-US-ChristopherNeural" – US English, male (default)
  - "en-US-JennyNeural" – US English, female
  - "en-GB-RyanNeural" – British English, male
  - "en-AU-NatashaNeural" – Australian English, female

**Q3: Rate**
- header: "Rate"
- question: "Speed? (current: `{rate}`)"
- multiSelect: false
- options:
  - "1.0" – Normal (default)
  - "0.75" – Slower
  - "1.25" – Faster
  - "1.5" – Fast

## Step 3 — Guards

- Cancel (Esc) → say "Configuration cancelled." and stop.
- No changes → say "No changes — config unchanged." and stop.

## Step 4 — Write config

Determine the target path from the Scope answer:
- "Global" → `~/.claude/cc-tts/config.json`
- "This project" → `./.claude/cc-tts/config.json`

Read existing config at the target path (if any) to preserve `enabled` and other fields.
Update only `voice` and `rate`. Create the directory if needed.

Write as JSON:
```json
{
  "enabled": true,
  "voice": "{value}",
  "rate": {value}
}
```

(`rate` is a number, not a string)

## Step 5 — After saving

Say: "Settings saved to `{path}`. Restart TTS (`/cc-tts:off` then `/cc-tts:on`) to apply."
