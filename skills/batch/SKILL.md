---
name: batch
description: Research and plan a large-scale change, then execute it in parallel across many isolated work units. Use when the user wants a sweeping mechanical refactor, migration, or bulk edit that can be decomposed into independent chunks.
compatibility: Best in coding agents that support parallel subagents, isolated workspaces or worktrees, git, and optional GitHub PR workflows.
---

# Batch: Parallel Work Orchestration

You are orchestrating a large, parallelizable change across a codebase.

## User Instruction

Start from the user's requested migration, refactor, or bulk change.

## Phase 1: Research and Plan

1. Understand the scope.
   Launch one or more research subagents if available, or do the research yourself. Find all affected files, patterns, and call sites. Understand existing conventions so the migration is consistent.

2. Decompose into independent units.
   Break the work into roughly 5-30 self-contained units, scaled to the actual size of the task. Each unit should:
   - Be independently implementable in an isolated workspace if possible
   - Be mergeable on its own without depending on sibling units landing first
   - Be roughly uniform in size

3. Determine the end-to-end verification recipe.
   Figure out how a worker can verify its change actually works, not just that unit tests pass. Look for browser automation, CLI verification, a dev-server-plus-request flow, or an existing integration/e2e test suite.

4. Write the plan.
   Include:
   - A summary of what you found
   - A numbered list of work units, with title, files or directories covered, and one-line change description
   - The end-to-end verification recipe, or a justified reason to skip it
   - The exact worker instructions you will give each agent

## Phase 2: Spawn Workers

After the plan is approved, spawn one worker per work unit using the agent or subagent mechanism available in your environment. Launch them in parallel when possible.

Each worker prompt should be fully self-contained and include:

- The overall goal
- The unit's specific task
- Relevant codebase conventions
- The verification recipe
- The worker instructions below

## Worker Instructions

After finishing the change:

1. Run a simplify or cleanup pass on your own changes.
2. Run the relevant unit tests and fix failures.
3. Run the end-to-end verification recipe unless the plan explicitly says to skip it.
4. If the environment supports git and PR workflows and the user asked for them, create a commit, push the branch, and open a pull request.
5. Report status in a single final line in a machine-readable form if coordination requires it, for example: `PR: <url>` or `PR: none - <reason>`.

## Phase 3: Track Progress

Render an initial status table for all work units. As workers complete, update the table with status and PR links if applicable. When all workers finish, render the final table and a one-line summary.
