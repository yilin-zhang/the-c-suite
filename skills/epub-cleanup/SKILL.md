---
name: epub-cleanup
description: Use when cleaning and normalizing EPUB/KEPUB files while preserving the book's visual style. Focus on removing export artifacts (GoogleDoc/calibre), soft typography normalization, safe link rewrites, and validation.
---

# EPUB Cleanup Skill

## When to use
- EPUB has cramped line spacing, odd font scaling chains, or inconsistent body text.
- Source shows exporter artifacts (GoogleDoc paths, calibre metadata/bookmarks).
- User wants a cleaner, lighter EPUB while keeping chapter/title style.
- User needs a re-converted KEPUB after cleanup.

## Goals
- Keep structure and reading flow intact.
- Normalize body typography lightly (avoid full redesign).
- Preserve chapter heading personality.
- Adjust in-book TOC sizing independently from chapter headings.
- Remove obvious metadata/path noise safely.

## Workflow
1. Inspect package internals.
   - List archive contents.
   - Identify CSS files, OPF, NCX, and XHTML spine files.
2. Audit typography patterns.
   - Count `font-size`, `line-height`, `height` declarations.
   - Detect compensating chains like parent `0.75em` + child `1.33333em`.
3. Apply soft normalization (not hard lock).
   - Body paragraphs: normalize tiny exported classes to `1em` when safe.
   - Inline body spans: normalize compensating `1.2-1.38em` classes to `1em` when safe.
   - Remove fixed `height` on text blocks.
   - Optional default line-height is allowed, but avoid `!important` so Kobo can still adjust.
4. Handle TOC vs chapter headings separately.
   - Detect in-book TOC pages (many numbered chapter lines).
   - Scale TOC text classes only.
   - Do not change chapter heading classes unless explicitly requested.
5. De-artifact packaging.
   - Rename internal `GoogleDoc/...` files to clean namespaces (`Text/...`, `Images/...`).
   - Rewrite all `href`/`src` links in XHTML/OPF/NCX to new paths.
   - Remove `META-INF/calibre_bookmarks.txt`.
   - Remove calibre-only metadata entries from OPF/NCX if requested.
6. Validate.
   - Ensure `mimetype` is first and uncompressed.
   - Ensure no broken links after path rewrites.
   - Ensure NCX/OPF references point to renamed files.
7. Output artifacts.
   - Write a new EPUB; never overwrite source unless user asks.
   - Convert to KEPUB (if requested) and place in target folder.

## Safety rules
- Do not drop chapters, notes, anchors, or spine order.
- Avoid broad CSS deletion; remove/normalize only what is justified by usage.
- Prefer reversible changes and explicit output naming (e.g., `(... cleaned).epub`).
- Keep text encoding UTF-8 and preserve original XML declarations.

## Recommended command patterns
```bash
# Inspect
unzip -l "Book.epub"

# Convert cleaned EPUB to KEPUB
kepubify -o "../kepub" "Book (cleaned).epub"
```

## Validation checklist
- `GoogleDoc/` internal paths removed (if cleanup requested).
- No calibre bookmarks file.
- OPF/NCX links valid and readable.
- TOC font size adjusted as requested.
- Chapter heading size unchanged unless explicitly requested.
- Kobo line spacing slider still effective (no forced `!important` lock).
- Global body text color is unset (or intentionally set and documented).

## Rebuild-from-PDF playbook (for heavily corrupted EPUBs)
Use this path when source EPUB structure is too noisy (`c1/c2/...` class soup) and user wants a clean semantic package.

1. Extract text from PDF with layout hints.
   - Prefer `pdftotext -layout` over OCR if PDF already has text layer.
   - Remove page-number-only lines and form-feed artifacts.
2. Use source EPUB only as style/structure reference.
   - Parse NCX chapter labels and ordering.
   - Keep chapter/title visual intent (font family/size direction), not exporter class names.
3. Build a fresh EPUB2 package with semantic paths/classes.
   - Paths: `OEBPS/Text`, `OEBPS/Styles`, `OEBPS/Images`.
   - Classes: `section-title`, `para-first`, `para-body`, `toc-item`, etc.
   - Avoid anonymous classes and inline style attributes.
4. Reconstruct front matter and TOC explicitly.
   - Title, note, copyright, epigraph, contents.
   - One XHTML per chapter for reliable pagination.
5. Recover emphasis from source EPUB if needed.
   - Detect source classes with `font-style: italic` and `font-weight: bold/700+`.
   - Map emphasis back into rebuilt text as semantic `<em>`/`<strong>`.
   - Treat this as alignment-driven recovery; verify manually on dense chapters.

## Kobo-oriented typography defaults (practical baseline)
- Body paragraph indent baseline: `1.55em` is a strong default for English trade fiction on Kobo.
- First paragraph after heading: no indent (`para-first`).
- Prefer leaving global body/paragraph text color unset in reflowable books.
  - This lets Kobo theme/rendering pick foreground color and avoids "gray text" perception on eInk.
  - Avoid hardcoding near-black like `#111` for body text unless there is a specific reason.
- Do not hard-lock user controls unless debugging a renderer bug.
  - Avoid `!important` on line-height/indent in final delivery.
- TOC font can be smaller than section-title while preserving the same typeface family.

## New Yorker HTML ingestion playbook
Use this when source is saved New Yorker HTML with `window.__PRELOADED_STATE__`.

1. Parse article JSON from `__PRELOADED_STATE__`.
2. Keep only narrative blocks:
   - Keep: `p`, `blockquote`, `inline-embed` with `type=callout:dropcap`.
   - Drop: `ad`, `cm-unit`, `inline-newsletter`, `journey-inline-newsletter`, `externallink`.
3. Normalize and sanitize paragraph text:
   - Collapse whitespace and punctuation spacing.
   - Remove New Yorker boilerplate lines at both start and end of serialized parts:
     - `This is the ... part of a four-part series. Read the ... part.`
     - `This was the ... part of a four-part series...`
   - Remove end symbols like `♦`.
4. Preserve emphasis semantics with `<em>` / `<strong>`.
5. Build one XHTML per part/chapter for stable Kobo pagination.

## Kobo renderer quirks (important)
- KEPUB injects wrappers (`#book-columns`, `#book-inner`) and `span.koboSpan`.
- If alignment fails on device, apply selector hardening for target elements:
  - Add rules for both element and `span.koboSpan` descendants.
  - Use `text-align: ... !important` only for specific frontmatter/TOC labels where Kobo overrides are common.
  - For stubborn centering failures (title page / epigraph second line), mirror the `Hiroshima` pattern:
    - Add high-specificity selectors on `body.book-body ...` and `#book-columns #book-inner ...`.
    - Force `display:block` on both element and injected `span.koboSpan` nodes.
- Keep TOC link underlines natural:
  - Use inline links for TOC entries when Kobo draws full-width dotted underlines on block links.
- For cover behavior on eInk:
  - Keep cover image in its own XHTML file.
  - Place title/author/dek in a separate frontmatter XHTML to avoid fixed-layout side effects.

## Footnotes and popup behavior (Kobo)
- EPUB2: Kobo popup is heuristic-driven; plain links may still open as jumps.
- EPUB3: prefer semantic markup for best chance of popup behavior:
  - Reference link: `epub:type="noteref"`.
  - Note target: `epub:type="footnote"` on the target block with stable `id`.
- Keep note targets as block-level anchors (`<p id="note-x">...`) to survive KEPUB conversion.
- Keep links local and explicit (`notes.xhtml#note-x`), with targets after source content.
- If migrating to EPUB3, include `nav.xhtml` and keep nav order aligned with spine to avoid `NAV-011` warnings.

## Packaging and size optimization
- For custom covers: normalize once, then encode as JPEG for reflowable books unless transparency is required.
- Typical practical cover target for Kobo sideload: around 1000px height can be enough for low file size.
- Audit for unused image assets after chapter/frontmatter changes (e.g., removed "Book Covers" chapter).
  - Remove unreferenced images from both archive payload and OPF manifest.
  - This can reduce file size dramatically.

## Frontmatter layout heuristics
- If frontmatter paragraph blocks are non-indented (e.g., translator note), increase inter-paragraph spacing slightly (e.g., adjacent `margin-top: 0.6-0.9em`) instead of adding indents.
- For title-page vertical composition across screens:
  - Keep title/author near top and subtitle pinned near bottom via container padding + absolute/fixed bottom region.
  - Avoid fragile negative margins.

## Content parity verification (required for rebuilds)
After building from HTML/PDF, verify text parity explicitly:

1. Extract normalized paragraph list from source (after intentional cleanup rules).
2. Extract normalized paragraph list from EPUB chapter files.
3. Compare per chapter/part:
   - Paragraph counts must match.
   - Paragraph-by-paragraph text should match exactly after entity decode.
4. Report intentional differences separately (e.g., removed boilerplate lines).

## EPUB2 compatibility guardrails
- In EPUB2 content docs, avoid EPUB3-only structural tags in body flow (`<nav>`).
  - Use `<div>` wrappers for in-book contents pages.
- Ensure block-level placement is valid.
  - Wrap standalone `<img>` in block containers where required by DTD/profile.
- Keep `mimetype` first and uncompressed.

## Required validation sequence
1. `epubcheck <book.epub>` must be clean (`0 fatals / 0 errors / 0 warnings`).
2. Internal link audit (`href`/`src`) must report no missing targets.
3. Class audit: no anonymous exporter classes if the goal is semantic cleanup.
4. Convert to KEPUB and smoke-test chapter starts, TOC links, and paragraph indent.

## Deliverable summary format
- Output EPUB path.
- Whether source EPUB was untouched.
- Cleanup actions performed (paths, metadata, typography, TOC sizing).
- KEPUB output path (if converted).
