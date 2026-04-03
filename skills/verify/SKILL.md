---
name: verify
description: Verify that a code change actually works by running the app or the changed workflow, not just by reading code. Use after implementation and before merge when the user wants confidence that behavior matches intent.
compatibility: Requires a runnable project or reproducible verification path. Prefer real execution over static inspection.
metadata:
  note: This version was reconstructed from the bundled skill description because the original verify markdown assets were missing from the Claude Code checkout.
---

# Verify

Verify a code change does what it should by running the app.

## Goal

Confirm behavior through execution, not just code inspection.

## Workflow

1. Identify what changed and what behavior needs to be proven.
2. Choose the most direct runnable verification path.
3. Execute the changed flow end to end when possible.
4. Report what you verified, what passed, what failed, and what remains unverified.

## Verification Principles

- Prefer running the actual app, service, CLI, test harness, or user flow.
- Prefer end-to-end or integration-style verification over unit-only confidence when the changed behavior crosses boundaries.
- If a lightweight direct reproduction is possible, use it.
- If full end-to-end verification is not possible, state why and fall back to the strongest available evidence.

## Common Verification Paths

### CLI changes

- Run the command with realistic arguments.
- Check exit code, stdout/stderr, side effects, and produced files.

### Server or API changes

- Start the service if needed.
- Hit the affected endpoints or workflows.
- Validate status codes, payloads, logs, and user-visible behavior.

### Frontend changes

- Launch the app.
- Exercise the affected screen or interaction.
- Confirm the visible result and any important console or network behavior.

## Output

Summarize:

- What you ran
- What behavior was verified
- Evidence of success or failure
- Any gaps, limitations, or follow-up checks still needed
