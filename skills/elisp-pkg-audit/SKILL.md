---
name: elisp-pkg-audit
description: Audit and selectively upgrade Emacs packages before updating them. Use this skill when the user wants to review pending package updates, export diffs for upgradable packages, inspect security or regression risk, and only then upgrade approved archive packages. This skill is tailored for package.el workflows driven through emacsclient. It exports per-package diffs plus a machine-readable summary, reviews the diffs like a code review, and upgrades only explicitly approved non-package-vc packages.
---

# Elisp Package Audit

Use this skill when the user wants a cautious Emacs package upgrade flow:

1. Export diffs for the packages that `package.el` says are upgradeable.
2. Review those diffs for security risk, behavior changes, or likely regressions.
3. Upgrade only the packages the user explicitly approves.

## Files

- `scripts/export-upgrade-diffs.sh`
  Exports per-package diffs and `summary.json`.
- `scripts/upgrade-archive-packages.sh`
  Upgrades explicitly named archive packages only.
- `lisp/package-audit.el`
  Shared helper used by both scripts.

## Workflow

### 1. Export diffs

Run:

```bash
bash scripts/export-upgrade-diffs.sh /tmp/elisp-pkg-audit-run
```

Optional package filter:

```bash
bash scripts/export-upgrade-diffs.sh /tmp/elisp-pkg-audit-run magit transient
```

This writes:

- `summary.json`
- `diffs/<package>.diff`
- `downloads/`
- `expanded/`

### 2. Audit

Read `summary.json` first, then inspect the relevant diff files.

Audit with a code-review mindset:

- Flag security-sensitive changes first.
- Then flag behavior changes and likely regressions.
- Treat noisy metadata-only updates as low risk.
- Prefer concrete findings with file and line references into the diff files.

### 3. Upgrade only approved packages

After the user approves specific packages, run:

```bash
bash scripts/upgrade-archive-packages.sh magit transient
```

Only pass packages the user approved.

## Constraints

- Always use the bundled scripts instead of re-deriving the workflow.
- The upgrade script only upgrades explicitly named archive packages.
- Do not auto-upgrade `package-vc` packages with this skill.
- If a package shows `upgrade-strategy` of `manual-vc`, explain that it needs a separate git-based audit and upgrade path.
- If a package shows `archive-preview-only`, you may audit its downloaded archive diff, but do not switch installation method without explicit user approval.

## Notes

- The helper uses `emacsclient`, so an Emacs server must already be running.
- Diff output intentionally excludes `.git`, CI files, autoloads, compiled files, and common repo metadata to keep the audit focused on package code.
