---
name: elisp-nav
description: Provide usage guidance for the elisp-nav CLI tool that locates definitions, references, and enclosing forms in Emacs Lisp files. Use this skill whenever you need fast navigation or structural inspection without loading full files into context.
---

# elisp-nav skill

Use this skill to:

- Find symbol definitions and references in Emacs Lisp files.
- Extract the enclosing S-expression at a given line/column.
- Inspect parent form paths to diagnose bracket/structure issues.

## Usage

Invoke the tool via the wrapper script (`scripts/elisp-nav.sh` resolves its own
location, so it works from any working directory):

```bash
bash scripts/elisp-nav.sh --file /path/to/file.el --def SYMBOL
bash scripts/elisp-nav.sh --file /path/to/file.el --refs SYMBOL
bash scripts/elisp-nav.sh --file /path/to/file.el --sexp-at LINE:COL
bash scripts/elisp-nav.sh --file /path/to/file.el --form-path LINE:COL
bash scripts/elisp-nav.sh --dir /path/to/dir --def SYMBOL
bash scripts/elisp-nav.sh --dir /path/to/dir --refs SYMBOL
```

Output is plain text with prefixes:

- `def PATH:START-LINE:START-COL:END-LINE:AUTOLOAD`
- `ref PATH:LINE:COL`
- `sexp PATH:LINE:COL` followed by the full enclosing form
- `path PATH:LINE:COL` followed by parent form names with positions

Notes:

- `--dir` scans `*.el` files recursively and skips common vendor dirs (e.g. `.git`, `node_modules`).
- `--sexp-at` and `--form-path` require `--file` and a `LINE:COL` position.
- AUTOLOAD is `autoload` when a `;;;###autoload` line sits immediately above the defun, otherwise `noautoload`.
- Section headers in Emacs Lisp often use `;;;`-prefixed comments; search for those to locate code blocks quickly.

## Methodology: Analyze and Debug with elisp-nav

Use elisp-nav to build a minimal, evidence-driven map of the code before opening large files. The goal is to identify the entry points, trace the call graph, and then zoom into the smallest structural context needed to understand or fix a problem.

Start from the surface:

- Identify the interactive entry point (usually `M-x` commands). Run `--def` on the command symbol to find where the user-facing flow begins.
- Use the output `def PATH:LINE:COL` to jump to the function and read only the relevant block with your file viewer.

Trace the call path deliberately:

- From the entry function, list the internal helpers it calls, then run `--def` on those helpers to locate their definitions.
- Keep the call chain short and purposeful. If a helper is small or pure, read it; if it is large, postpone until you know you need it.

Use references to understand ownership and side effects:

- Run `--refs` for a helper to see all call sites. This reveals whether a function is used widely (public-ish) or narrowly (local detail).
- If a function is invoked in multiple contexts, compare the surrounding call sites before changing anything.

Inspect structure around a suspicious point:

- Use `--sexp-at LINE:COL` to extract the full enclosing form when you suspect scoping or macro expansion issues.
- Use `--form-path LINE:COL` to see the parent forms chain, which is essential when debugging nested `let`, `pcase`, or macro forms.

Work with section headers for orientation:

- Search for `;;;` section headers to identify the module boundary and keep context scoped to one area.
- If a bug crosses sections, treat the boundary as an interface and inspect only the relevant functions on each side.

Debugging flow checklist:

- Start at the interactive command and confirm parameters/state acquisition.
- Trace into the first data mutation or I/O boundary (DB writes, network calls, file operations).
- Verify the data shape at each boundary using the functions that normalize or map data.
- Confirm the UI/render layer consumes the same shape without re-deriving fields.

When output seems inconsistent:

- Re-run `--def` on the symbol to confirm you are looking at the correct definition.
- Use `--refs` to ensure there are no alternate call paths or redefinitions shadowing the target.
- Use `--sexp-at` for the exact line to make sure the cursor is inside the expected form.

## Validation

- Run a quick check with a known symbol to confirm output formatting.
