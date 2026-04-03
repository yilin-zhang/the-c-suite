---
description: Configure notification sounds for each event type
allowed-tools: Read, Write, AskUserQuestion, Bash
---

# Configure macnotify

**FIRST**: Read `~/.claude/macnotify/sounds.sh` if it exists.

Parse current values for:
- `SOUND_STOP` (default: Glass)
- `SOUND_SUBAGENT_STOP` (default: Purr)
- `SOUND_PLAN_READY` (default: Hero)
- `SOUND_QUESTION` (default: Ping)
- `SOUND_PERMISSION` (default: Frog)

---

## Configuration Flow

**AskUserQuestion supports max 4 questions and max 4 options per call.**
Ask in two batches: first 3 (Stop, SubagentStop, PlanReady), then 2 (Question, Permission).
For each question, show 3 representative sounds + "Silent". Remind the user they can type any
sound via "Other" — valid names: Basso, Blow, Bottle, Frog, Funk, Glass, Hero, Morse, Ping,
Pop, Purr, Sosumi, Submarine, Tink.

### Batch 1 (2 questions — most important)

**Q1: ✅ Task Complete**
- header: "Task Complete"
- question: "Sound when Claude finishes a task? (current: `SOUND_STOP`) — type any macOS sound via Other"
- options: Glass (default), Hero, Purr, Silent

**Q2: 🔔 Permission**
- header: "Permission"
- question: "Sound when Claude requests permission? (current: `SOUND_PERMISSION`) — type any macOS sound via Other"
- options: Frog (default), Basso, Sosumi, Silent

### Batch 2 (3 questions — secondary)

**Q3: 🤖 Agent Complete**
- header: "Agent Complete"
- question: "Sound when a background agent finishes? (current: `SOUND_SUBAGENT_STOP`) — type any macOS sound via Other"
- options: Purr (default), Pop, Ping, Silent

**Q4: 📋 Plan Ready**
- header: "Plan Ready"
- question: "Sound when a plan is ready for review? (current: `SOUND_PLAN_READY`) — type any macOS sound via Other"
- options: Hero (default), Funk, Glass, Silent

**Q5: ❓ Needs Input**
- header: "Needs Input"
- question: "Sound when Claude needs your input? (current: `SOUND_QUESTION`) — type any macOS sound via Other"
- options: Ping (default), Tink, Morse, Silent

---

## Guards

- If the user cancels (Esc) at any point → say "Configuration cancelled." and stop.
- If no values changed → say "No changes — config unchanged." and stop.

---

## Preview Before Saving

Show a summary table:

```
Event              Before  →  After
────────────────────────────────────
✅ Task complete    Glass   →  Basso
🤖 Agent complete   Purr      (unchanged)
📋 Plan ready       Hero      (unchanged)
❓ Needs input      Ping      (unchanged)
🔔 Permission       Frog      (unchanged)
```

Then ask: "Save these changes?" (yes / cancel)

---

## Write Configuration

Write to `~/.claude/macnotify/sounds.sh`, creating the directory if needed.

Map "Silent" to `""`.

Use this exact format:
```sh
# macnotify sound configuration
# Valid macOS sounds: Basso, Blow, Bottle, Frog, Funk, Glass, Hero, Morse, Ping, Pop, Purr, Sosumi, Submarine, Tink
# Set to "" to silence a notification

SOUND_STOP="{value}"
SOUND_SUBAGENT_STOP="{value}"
SOUND_PLAN_READY="{value}"
SOUND_QUESTION="{value}"
SOUND_PERMISSION="{value}"
```

---

## After Saving

Say: "Sounds saved to ~/.claude/macnotify/sounds.sh — changes take effect immediately."
