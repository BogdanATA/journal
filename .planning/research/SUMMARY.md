# Project Research Summary

**Project:** Journal — minimal cross-platform desktop journaling app
**Domain:** Local-first desktop notepad/journaling app (macOS + Windows)
**Researched:** 2026-08-28
**Confidence:** MEDIUM-HIGH

## Executive Summary

This is a minimal, local-first desktop journaling app: a distraction-free notepad that auto-segments free-flowing writing into dated entries, lets users tag entries inline with `#hashtags`, and makes those tags reliably findable even when typed inconsistently (typos, plurals, near-duplicates). Experts building this class of app (Obsidian, Bear, Day One) converge on the same shape — a native-feeling desktop shell, a plain-text-native editor core, and files-as-truth storage — but no competitor does the two things this app is betting on: automatic blank-line entry segmentation and fuzzy/typo-tolerant tag matching with auto-merge. Those two features are genuinely novel and are simultaneously the project's entire value proposition and its highest technical risk.

The recommended approach is Tauri v2 + React + TypeScript for the shell (not Electron — a 20-50x smaller footprint matters for something meant to feel like TextEdit), CodeMirror 6 as the editor core (its `Decoration`/`ViewPlugin` API is purpose-built for rendering tag "pills" and ghost-text without ever letting the visual layer diverge from the real plain-text buffer), and a two-tier storage model: `.md` files on disk are the sole source of truth, with a derived, fully rebuildable SQLite+FTS5 index used only to make fuzzy tag search fast. Fuzzy matching itself should be staged — exact match first, then edit-distance-based fuzzy matching (not prefix-weighted Jaro-Winkler, which over-merges short tags like `thought`/`thoughtful`) — with an "unmatched" review bucket as the safety valve so no tag is ever silently misfiled.

The key risks, in order of severity, are: (1) data loss from non-atomic writes or debounced-autosave race conditions — this app has no cloud backup, so a corrupted file is unrecoverable; (2) cursor/undo/copy-paste desync from hand-rolled tag-pill rendering — must be built on CodeMirror's real decoration API, never raw contenteditable manipulation; (3) over-aggressive fuzzy merging silently collapsing distinct tags, which directly undermines the app's stated core value. All three have well-documented prevention patterns (write-temp-then-rename, decoration-API-only pill rendering, edit-distance-with-hard-negative-test-set), so the risk is in sequencing and discipline, not unknowns.

## Key Findings

### Recommended Stack

Tauri v2 (Rust shell + native WebView) + React 19 + TypeScript 5.9 + Vite, with CodeMirror 6 as the plain-text-native editor core, Fuse.js + fastest-levenshtein for fuzzy tag matching, and Tauri's `plugin-fs`/`plugin-dialog` for file access. Full detail: `.planning/research/STACK.md`.

**Core technologies:**
- **Tauri v2**: desktop shell — ~3-10MB installers, ~75% less RAM than Electron, matches a "minimal notepad" positioning
- **CodeMirror 6**: editor engine — plain-text-native buffer (no HTML<->Markdown serialization step), `Decoration`/`ViewPlugin` API is the exact primitive needed for tag pills and ghost text
- **Fuse.js (search UX) + fastest-levenshtein (clustering)**: two narrowly-scoped fuzzy-matching libraries rather than one general-purpose NLP toolkit
- **date-fns**: daily filename generation and date math, avoiding hand-rolled timezone bugs

### Expected Features

Full detail: `.planning/research/FEATURES.md`.

**Must have (table stakes):** autosave with crash-safety, undo/redo, live search-as-you-type, calendar/date navigation, cross-platform native feel, human-readable non-proprietary storage.

**Should have (differentiators — the app's actual value proposition):** blank-line auto-segmentation into entries (no competitor does this), typo-tolerant fuzzy tag search (competitors are all exact-match), automatic near-duplicate tag merging with an "unmatched" review bucket, non-forcing Tab-to-accept autocomplete, search-box-only navigation (no tag sidebar/directory).

**Defer (v2+):** word count, "days since last entry" passive nudge, manual tag merge/rename UI, optional tag directory (only if fuzzy search proves insufficient), configurable sync-folder location.

**Explicitly excluded (anti-features):** streaks/gamification, reminders/notifications, rich text/media attachments, templates/prompts, an explicit export UI (files are already portable), nested/hierarchical tags (conflicts with the fuzzy-merge model), cloud sync (user can point storage at a synced folder themselves).

### Architecture Approach

Local-first: `.md` files on disk are the sole source of truth; a derived SQLite+FTS5 index (rebuildable at any time by re-parsing files) exists purely to make fuzzy tag search fast. Full detail: `.planning/research/ARCHITECTURE.md`.

**Major components:**
1. **Editor Canvas** (CodeMirror 6) — renders text, hosts pill/ghost-text decorations, never reads from the index
2. **Parser/Entry Model** (pure TS, shared) — blank-line segmentation + tag extraction, used identically by the live editor and the index-sync path so pill rendering and search results never disagree
3. **Tag Matcher** — staged resolution: exact -> normalized exact -> fuzzy (edit-distance, FTS5 trigram prefilter) -> unmatched bucket; the same matcher backs both autocomplete and search
4. **Index Sync Service** — the only writer to SQLite; re-parses and upserts a whole day-file on save (not incremental diffing), and reconciles via mtime/hash on startup

### Critical Pitfalls

Full detail: `.planning/research/PITFALLS.md`.

1. **Non-atomic writes / debounced-autosave races** — the single highest-severity risk given no-cloud-backup; use write-temp-then-rename (atomic on POSIX, `MoveFileEx`/`ReplaceFile` on Windows) and serialize writes per file through one FIFO queue.
2. **Tag-pill cursor/undo/copy-paste desync** — must use CodeMirror's `Decoration`/`RangeSet` API with the pill as a rendering-only overlay on real editable text, never a `contenteditable=false` atomic node; needs its own dedicated UAT phase.
3. **Over-aggressive fuzzy tag merging** — short strings are highly sensitive to threshold choice; use length-normalized edit distance (not prefix-weighted Jaro-Winkler), validate against a hand-built "should NOT merge" test set (`thought`/`thoughtful`, `plan`/`planning`) before shipping any threshold, and route borderline merges to a reviewable bucket.
4. **Ghost-text Tab conflicts** — Tab must only be intercepted when a suggestion is actively displayed and current; must fall through to default behavior otherwise, or it becomes a keyboard-trap accessibility failure.
5. **Blank-line detection fragility across line endings/paste** — normalize line endings on read, define "blank" as empty-after-trim, and explicitly test `\r\n`, trailing whitespace, and pasted multi-paragraph content.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Walking Skeleton — Shell, Signed Packaging, Basic Editor + File I/O
**Rationale:** Packaging/signing is the single most commonly deferred-too-late pitfall (Pitfall 8); establishing a signed, notarized, launchable build early de-risks certificate acquisition and CI setup while there's still time to absorb the cost. Also nothing else is buildable without a working editor and file write path.
**Delivers:** A Tauri+React app that opens to today's plain-text file, has debounced (non-atomic-yet) save, and produces a signed/installable build on both macOS and Windows.
**Addresses:** cross-platform native feel, human-readable storage, autosave (basic version)
**Avoids:** Pitfall 8 (late packaging surprise)

### Phase 2: Reliable Storage — Atomic Writes + Save Race Safety
**Rationale:** This is foundational plumbing that every later phase (editor UI, parser, index) implicitly assumes is correct; must be solid before building on top of it. Highest-severity data-loss risk given no cloud backup.
**Delivers:** Write-temp-then-rename atomic saves, single-writer FIFO queue per file, quit-time save flush.
**Uses:** `@tauri-apps/plugin-fs`
**Avoids:** Pitfall 1 (autosave races), Pitfall 2 (non-atomic write corruption)

### Phase 3: Entry Parsing — Blank-Line Segmentation + Tag Extraction
**Rationale:** This pure, dependency-free module is the linchpin dependency for pills, index sync, and eventually autocomplete — isolating and unit-testing it early de-risks everything downstream. Must handle cross-platform line endings and paste behavior correctly from the start.
**Delivers:** `segmentEntries.ts` / `extractTags.ts`, unit-tested against `\n`/`\r\n`/trailing-whitespace/paste fixtures.
**Implements:** Parser/Entry Model component from ARCHITECTURE.md
**Avoids:** Pitfall 7 (blank-line detection fragility)

### Phase 4: Tag Pill Rendering (Editor Core)
**Rationale:** The highest-risk UI feature (cursor/undo/copy-paste desync); deserves an isolated phase with dedicated UAT rather than being bundled with autocomplete, since debugging two novel interaction systems at once multiplies failure surface.
**Delivers:** `#tag` -> visual pill via CodeMirror `Decoration.mark()`, driven by the Phase 3 parser, with verified cursor/undo/copy-paste behavior.
**Uses:** CodeMirror 6 `Decoration`/`ViewPlugin` API
**Avoids:** Pitfall 4 (pill/text desync)

### Phase 5: Calendar Navigation
**Rationale:** Only depends on file listing (Phase 1/2), not on tagging or search — rounds out basic day-to-day usability before tackling the harder search/matching problem.
**Delivers:** Calendar/day picker that opens any past day's file into the editor.
**Addresses:** calendar/date navigation table-stakes feature

### Phase 6: Index + Exact-Match Search
**Rationale:** Proves the SQLite-as-derived-index architecture (files-as-truth, index-as-rebuildable-cache) and the full read path end-to-end with exact-match matching only, before layering in the highest-uncertainty fuzzy logic on top of a stable foundation.
**Delivers:** SQLite schema, Index Sync Service (re-parse+upsert on save, startup mtime/hash reconciliation), Search Panel with exact-match results and jump-to-day.
**Implements:** Pattern 1 (files as truth, SQLite as rebuildable index) from ARCHITECTURE.md

### Phase 7: Fuzzy Tag Matching — Calibration + Merge + Unmatched Bucket
**Rationale:** This is the project's stated Core Value and its highest-uncertainty piece; deserves a dedicated calibration step (algorithm + threshold selection validated against a hand-built "should merge" / "should NOT merge" test set) rather than just a library pick, sequenced after exact-match search is proven stable.
**Delivers:** Two-stage tag resolution (exact -> fuzzy -> unmatched), near-duplicate auto-merge, unmatched-tag review bucket UI.
**Addresses:** fuzzy tag search, near-duplicate auto-merge, unmatched bucket (FEATURES.md differentiators)
**Avoids:** Pitfall 6 (over-aggressive merging)

### Phase 8: Tab-to-Accept Ghost-Text Autocomplete
**Rationale:** Depends on both the pill decoration layer (Phase 4) and a real tag vocabulary (Phase 7), and is the most fiddly interaction (dismiss-on-any-key, Tab-only-accept) — benefits from everything else being stable first.
**Delivers:** Inline ghost-text suggestion widget reusing the Phase 7 Tag Matcher, with a scoped Tab keymap that falls through to default behavior when no suggestion is active.
**Avoids:** Pitfall 5 (Tab conflicts / keyboard trap)

### Phase Ordering Rationale

- Storage safety (Phase 2) comes before any UI work because every later phase assumes saves are reliable — retrofitting atomic writes after real usage begins is the highest-cost mistake identified in PITFALLS.md.
- The parser (Phase 3) is deliberately isolated and tested before it's wired into either the editor (Phase 4) or the index (Phase 6), because editor-rendering and index-search must derive from the exact same segmentation rules or they will silently disagree.
- Exact-match search (Phase 6) is built and proven before fuzzy matching (Phase 7) is layered on — fuzzy logic is explicitly the single highest-failure-risk piece per the project's own core value statement, and debugging it on top of an unstable sync/search foundation is much harder than adding it to a solid one.
- Packaging (Phase 1) is pulled to the front rather than left as a "ship" phase, per Pitfall 8's explicit warning that signing/notarization becomes a late-stage blocker if deferred.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 7 (Fuzzy Tag Matching):** Threshold/algorithm calibration is genuinely novel — no competitor implements this; needs its own research-phase pass on edit-distance normalization strategy and a hand-built test corpus.
- **Phase 4 (Tag Pill Rendering):** CodeMirror 6's exact decoration/widget API surface for this specific interaction should be verified live against current docs during planning (STACK.md notes the official autocomplete reference returned only a partial excerpt during this research pass).
- **Phase 8 (Ghost-Text Autocomplete):** Tab-keymap state-machine edge cases (accessibility/keyboard-trap avoidance) warrant a focused UAT-driven planning pass.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Walking Skeleton):** `create-tauri-app` scaffolding and Tauri v2 signing docs are well-documented official patterns.
- **Phase 2 (Atomic Writes):** Write-temp-then-rename is a standard, well-documented pattern across languages/platforms.
- **Phase 5 (Calendar Navigation):** Standard file-listing UI, no novel risk.
- **Phase 6 (Index + Exact Search):** SQLite FTS5 exact-match indexing is a well-documented, standard pattern.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Library versions verified live against npm registry (HIGH); Tauri-vs-Electron tradeoffs and CM6 Tab-binding behavior cross-checked across multiple independent 2025/2026 sources but not independently benchmarked (MEDIUM) |
| Features | MEDIUM | Cross-checked web write-ups on Day One, Obsidian, Bear, Apple Notes, Diarium; no official vendor API docs needed since these are consumer-facing feature sets, but no single authoritative source |
| Architecture | MEDIUM | Web-sourced, cross-checked across multiple independent sources; no official case study exists of this exact stack combination (Tauri + CM6 + SQLite-as-derived-index for a journaling app) |
| Pitfalls | MEDIUM | Cross-checked web sources and GitHub issue trackers (ProseMirror, Monaco, chokidar, electron); no official framework docs consulted directly in this pass — recommend Context7 lookups on CodeMirror 6 during Phase 4/8 planning |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Fuzzy-match threshold values:** No source provides a validated, ready-to-use threshold for this exact tag-length/vocabulary-size profile — must be calibrated against a real test set during Phase 7, not assumed from research alone.
- **CodeMirror 6 exact autocomplete API surface:** Official reference docs returned only a partial excerpt during this research pass; verify current `@codemirror/view`/`@codemirror/autocomplete` API against live docs before implementing Phase 4/8.
- **React 19 peer-dependency compatibility with `@uiw/react-codemirror`:** Flagged as needing an install-time check (peer-dep warnings) rather than confirmed compatible — verify at Phase 1 scaffolding time.
- **Signing/notarization scope decision:** PITFALLS.md notes this is explicitly a single-user personal tool — worth an early product decision on whether full notarization is required in early phases or can be deferred with a documented workaround, rather than assumed.

## Sources

### Primary (HIGH confidence)
- npm registry (`registry.npmjs.org`) — live version lookups for all core dependencies
- `https://v2.tauri.app/plugin/file-system/` — official Tauri v2 filesystem plugin docs
- `https://www.fusejs.io/` — official Fuse.js docs
- `https://www.sqlite.org/fts5.html` — official SQLite FTS5 docs

### Secondary (MEDIUM confidence)
- Multiple independent Tauri vs. Electron benchmark write-ups (bundle size, RAM, startup time) — directionally consistent, not independently re-benchmarked
- CodeMirror discuss forum threads and existing open-source ghost-text implementations (`codemirror-extension-inline-suggestion`, `val-town/codemirror-codeium`)
- Vendor feature pages and independent reviews for Day One, Bear, Apple Notes, Obsidian, Diarium
- GitHub issue trackers (ProseMirror, Monaco, chokidar, electron) for pitfall corroboration

### Tertiary (LOW confidence)
- None flagged separately — all findings were at least cross-checked across 2+ sources

---
*Research completed: 2026-08-28*
*Ready for roadmap: yes*
