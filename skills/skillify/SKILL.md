---
name: skillify
description: Capture a repeatable process from the current session and turn it into a reusable Agent Skill. Use near the end of a workflow when the user wants to automate it or save it as a standard skill for future reuse.
compatibility: Best in agents that can inspect prior conversation context, ask structured follow-up questions, and write files into a skills directory such as `~/.agents/skills`.
---

# Skillify

You are capturing this session's repeatable process as a reusable skill.

## Step 1: Analyze the Session

Before asking questions, identify:

- What repeatable process was performed
- What the inputs or parameters were
- The distinct steps, in order
- The success artifacts or criteria for each step
- Where the user corrected or steered the process
- What tools and permissions were needed
- What kinds of subagents or parallel work were useful

## Step 2: Interview the User

Ask only the questions needed to make the skill reusable. Do not over-interview simple workflows.

Gather:

- A good skill name and one-line description
- The high-level goal and success criteria
- The major steps
- Any arguments the skill should accept
- Whether the skill should run inline or in a separate agent, if the host supports that distinction
- Where the skill should be saved
- Trigger phrases or examples of when the skill should be used
- Any hard constraints, must-do rules, or must-not-do rules

Pay special attention to places where the user corrected you during the original session.

## Step 3: Write a Standard Agent Skill

Create a skill directory and write `SKILL.md` using the Agent Skills format from `agentskills.io/specification`.

Use this structure:

```markdown
---
name: skill-name
description: One-line description of what the skill does and when to use it.
compatibility: Optional environment requirements if needed.
allowed-tools: Optional space-delimited tool patterns if the host supports them.
metadata:
  version: "1.0"
---

# Skill Title

## Goal

Clear statement of the workflow goal and completion criteria.

## Inputs

- `$arg_name`: Description of the input

## Steps

### 1. Step Name

Specific, actionable instructions.

**Success criteria**: State what proves this step is complete.
```

## Step Writing Rules

- Every step should include success criteria.
- Include human checkpoints before irreversible actions.
- Capture important artifacts produced by one step and consumed by later steps.
- Keep simple skills simple.
- Use relative file references if you add `scripts/`, `references/`, or `assets/`.
- Keep the main `SKILL.md` reasonably short; move large reference material into separate files.

## Step 4: Confirm and Save

Before saving, show the complete `SKILL.md` draft to the user for review if the interaction style allows it. Then save it in the chosen skills directory.

For Agent Skills environments, a common default location is:

```text
~/.agents/skills/<skill-name>/SKILL.md
```

After writing, tell the user:

- Where the skill was saved
- How to invoke or activate it in their environment
- That they can edit `SKILL.md` directly to refine it
