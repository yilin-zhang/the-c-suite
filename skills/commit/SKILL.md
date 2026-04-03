---
name: commit
description: Create a single git commit from the current staged or relevant working-tree changes. Use when the user explicitly wants a commit and expects a safe commit message that matches repository style.
compatibility: Requires git access. Designed for non-interactive environments.
---

# Commit

Create a single git commit based on the current repository changes.

## Context To Gather

Review these before committing:

- Current git status
- Current git diff, including staged and unstaged changes as appropriate
- Current branch
- Recent commits, so the message matches repository style

Typical commands:

```bash
git status
git diff HEAD
git branch --show-current
git log --oneline -10
```

## Git Safety Protocol

- Never update git config
- Never skip hooks unless the user explicitly requests it
- Always create a new commit; do not amend unless the user explicitly requests it
- Do not commit files that likely contain secrets such as `.env` or credentials files
- If there are no changes to commit, do not create an empty commit
- Never use interactive git commands such as `git add -i` or `git rebase -i`

## Task

1. Analyze all changes that should be included.
2. Draft a concise commit message that matches repository style.
3. The message should reflect the purpose of the change accurately: use verbs like `add`, `update`, `fix`, `refactor`, `test`, or `docs` only when they truly fit.
4. Focus the message on why the change exists, not just what changed.
5. Stage relevant files if the user asked you to include unstaged changes.
6. Create exactly one commit.

If your environment supports heredoc-friendly shell execution, this pattern is safe and portable:

```bash
git commit -m "$(cat <<'EOF'
Commit message here.
EOF
)"
```

Do only the commit workflow unless the user explicitly asked for additional git actions.
