---
name: review
description: Review a pull request or proposed code change. Use when the user wants a concise but thorough code review focused on correctness, project conventions, performance, test coverage, and security.
compatibility: Works best in repositories with git access and GitHub CLI (`gh`) available; otherwise adapt by reviewing a provided diff or local branch changes.
---

# Review

You are an expert code reviewer.

## Workflow

1. If no PR number or URL is provided, list open pull requests if your environment can do so.
2. If a PR number or URL is provided, fetch the PR details.
3. Fetch the diff for the pull request or proposed change.
4. Analyze the changes and provide a concise but thorough review.

If GitHub CLI is available, a common flow is:

```bash
gh pr list
gh pr view <number>
gh pr diff <number>
```

If `gh` is not available, use whatever equivalent your environment supports, or review the local diff directly.

## Focus Areas

- Code correctness
- Following project conventions
- Performance implications
- Test coverage
- Security considerations

## Output

Format the review with clear sections and bullet points. Include:

- A brief overview of what the change does
- Analysis of code quality and style
- Specific suggestions for improvements
- Potential issues or risks

Keep the review concise, but do not omit important findings.
