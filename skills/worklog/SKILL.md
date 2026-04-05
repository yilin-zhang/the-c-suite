---
name: worklog
description: >
  Daily worklog workflow. Reads the user's notes and chat updates, maintains
  an agent.*.md dashboard, and helps plan and execute tasks. Use when the user
  says "/worklog", "check my worklog", "sync my notes", or wants to review,
  plan, or work on worklog items.
---

# Worklog: Daily Agent Workflow

You are the user's co-pilot. The user keeps a daily worklog of messy notes,
and you help them stay organized, do work, and track progress.

## File conventions

```
worklog/
  YYYY-MM-DD/
    notes.*.md           # User's notes. NEVER edit these.
    *.md, *.txt, etc.    # Other files. You may edit these.
    agent.*.md           # Agent's files. Agent owns these.
```

**Files matching `notes.*.md` are read-only.** Never modify them. The user
writes these freely. All other files (scripts, reports, data files, etc.)
are fair game for the agent to create or edit.

**Files matching `agent.*.md` are the agent's own files.** The main one is
`agent.dashboard.md` — rewritten from scratch each invocation. The agent
may create additional files (e.g. `agent.analysis.md`, `agent.report.md`)
as needed.

## On each invocation

### Step 1: Find the worklog root

Look for a `worklog/` directory in the current working directory. If it
doesn't exist, ask the user where their worklog lives, or offer to create
`worklog/` here.

### Step 2: Read today's folder

List all date folders in `worklog/` and pick the latest one as "today".
Read every file in it. If no folders exist, create one for the current date
with an empty `agent.dashboard.md`.

Also read the **second-latest folder's `agent.*.md` files** (if one exists)
to pick up carryover context: unfinished tasks, open questions, ongoing
threads.

### Step 3: Read chat context

The user may provide additional updates, questions, or instructions in the
chat message that triggered this invocation. Treat chat input as equal to
what's in the files. Anything said in chat should be captured in `agent.dashboard.md`
so it isn't lost.

### Step 4: Synthesize and update `agent.dashboard.md`

Rewrite `agent.dashboard.md` from scratch to reflect the **current** state. Structure:

```markdown
# Journal — YYYY-MM-DD

## Review
(Brief review of yesterday: what got done, what carried over, any patterns
or observations worth noting. Skip this section if it's the first day.)

## Current understanding
(Bullet-point summary of everything in progress: experiments, tasks,
requests from coworkers, deadlines. Reference the user's own words/files
where helpful.)

## Completed
(Checked-off items that are done today.)

## Needs your input
(Things the agent can't proceed on without the user. Be specific about
what's needed.)

## Suggested next steps
(What the agent recommends doing next, in priority order. Keep it
actionable.)
```

Adapt the sections to what's actually relevant. Don't include empty sections.
Keep it concise — this is a dashboard, not a report.

**Key principle: the worklog is the handoff document.** Write
`agent.dashboard.md` as if the next reader is a completely new agent with
zero conversation context. Every action taken, result obtained, decision
made, new requirement received, and open question must be recorded there.
If the current conversation were to end right now, a fresh agent should be
able to read today's folder and pick up exactly where things left off.

### Step 5: Respond in chat

After updating `agent.dashboard.md`, give the user a short chat response:
- What's new since last run
- What you recommend doing next
- Any questions you have

Be brief. The details are in `agent.dashboard.md`.

## When the user asks you to do work

If the user says "do X" or "work on X" after a `/worklog` run:

1. Do the work (write code, run analysis, draft reports, etc.)
2. Update `agent.dashboard.md` to reflect what you did and the results
3. Respond in chat with a summary

For **human-in-the-loop tasks** (like listening to audio samples): prepare
everything the user needs (file list, checklist, comparison table) in
`agent.dashboard.md`, mark the task as "waiting for your review", and tell them
what to do.
