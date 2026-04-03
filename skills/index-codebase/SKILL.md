---
name: index-codebase
description: >
  Index a codebase into structured feature specs under a `specs/` directory,
  and update the project's agent instructions file (CLAUDE.md or AGENTS.md)
  to reference them. Use this skill whenever the user asks to "index the
  codebase", "write specs", "document the architecture", "create feature
  specs", "spec out the project", or any request to produce structured
  documentation of how the code works for future AI agent reference. Also
  trigger when the user says "update the specs" after code changes.
---

# Index Codebase

Generate structured feature specs that serve as a reference for AI coding
agents working on the project. The specs describe what exists in the code
today — not aspirational design docs.

## Why specs matter for agents

Agents lose context between sessions. Specs give them a fast on-ramp:
- The front matter `summary` field lets an agent scan all specs in seconds to
  find the relevant one.
- The full spec provides implementation details, data structures, flows, and
  edge cases without reading every source file.
- Keeping specs in sync with code means agents don't act on stale information.

## Workflow

### 1. Explore the codebase

Read all source files. Understand:
- **Module boundaries**: which files exist, what each one owns.
- **Dependency graph**: which modules depend on which.
- **Feature boundaries**: where one feature ends and another begins.
- **Public vs private API**: exported functions/classes vs internal helpers.
- **Data structures**: structs, types, schemas, models.
- **Key flows**: how data moves through the system for each feature.

Use Explore agents for large codebases. For smaller ones, direct reads suffice.

### 2. Plan the spec structure

Before writing, decide what specs to create. The split should follow feature
boundaries, not file boundaries (though they often align). Typical specs:

- `main.spec.md` — always created. Architecture overview, module layout,
  dependency graph, core concepts, naming conventions.
- One spec per major feature or subsystem (e.g. `review-mode.spec.md`,
  `database.spec.md`, `auth.spec.md`).

Share the plan with the user before writing: "Here are the specs I plan to
create: [list]. Does this split make sense?"

### 3. Write the specs

Each spec file goes under `specs/` with the naming pattern
`<feature-name>.spec.md`.

#### Front matter (required)

```yaml
---
summary: One-line description of what this feature does and its key mechanism
---
```

The summary should be specific enough that an agent can decide whether to read
the full spec. Bad: "Database stuff." Good: "SQLite storage layer with
connection management, CRUD, review-order queries, backup/restore, and JSON
export/import."

#### Body structure

Adapt to what the feature needs, but generally cover:

- **Purpose** — what the feature does, in 1-2 sentences.
- **Entry points** — public functions/commands/endpoints.
- **Data structures** — schemas, structs, types, key variables.
- **Flows** — step-by-step description of how key operations work.
- **Configuration** — user-facing settings, defaults.
- **Edge cases** — known gotchas, error handling, constraints.
- **Dependencies** — what this feature depends on (internal and external).
- **Integration** — how this feature connects to other features (hooks,
  callbacks, shared state).

Use tables for listings (functions, config options, keybindings). Use numbered
lists for flows. Use code blocks for schemas and data structures.

#### What to include and what to skip

**Include**: anything an agent would need to know to modify the feature without
reading every line of source. Function signatures with purpose. Data flows.
State transitions. Non-obvious design decisions.

**Skip**: line-by-line code narration. Implementation details that are obvious
from reading the code. Aspirational plans. TODOs.

### 4. Update the agent instructions file

Find the project's agent instructions file. Common names: `CLAUDE.md`,
`AGENTS.md`, `CODEX.md`, `.cursorrules`. If none exists, create `CLAUDE.md`.

Add or update these sections:

```markdown
## Specs
- `specs/` contains detailed feature specs. Read the front matter (`summary`
  field) for a quick overview. Read the full spec for implementation details.
- When making code changes, check whether an existing spec covers the affected
  area and update it to stay in sync with the code.
- When implementing a new feature, sketch the spec first and align with the
  user before writing code.
```

If the file already has a large "Design" or "Architecture" section that
overlaps with what's now in `specs/main.spec.md`, move that content into the
spec and replace it with the pointer above.

### 5. Verify

After writing all specs:
- Confirm the `specs/` directory has one `main.spec.md` plus one spec per
  feature.
- Confirm every spec has YAML front matter with a `summary` field.
- Confirm the agent instructions file references `specs/`.
- Present a summary table to the user showing each spec and its summary.

## Updating specs after code changes

When the user asks to "update the specs" or "sync specs with code":
1. Identify which files changed (git diff, user description, or read the code).
2. Find the spec(s) that cover the affected area.
3. Read the current spec and the changed code.
4. Update the spec to reflect the new state. Don't leave stale information.
5. If the change introduces a new feature that doesn't fit existing specs,
   create a new spec file.

## Adapting to different project types

The spec format works for any language or framework. Adapt the terminology:

| Concept | Elisp | Python | TypeScript | Go |
|---|---|---|---|---|
| Module | `.el` file | module/package | module/file | package |
| Public API | no `--` prefix | no `_` prefix | `export` | Uppercase |
| Private | `--` prefix | `_` prefix | no export | lowercase |
| Entry point | `;;;###autoload` | `__main__` | CLI/route handler | `main()` |
| Config | `defcustom` | settings/env | config/env | flags/env |
| Data structure | `cl-defstruct` | dataclass/model | interface/type | struct |
