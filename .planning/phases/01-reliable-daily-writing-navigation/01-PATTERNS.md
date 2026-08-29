# Phase 1: Reliable Daily Writing & Navigation - Pattern Map

**Mapped:** 2026-08-29
**Files analyzed:** 10 (planned new files, no modifications — nothing exists yet)
**Analogs found:** 0 / 10

## Greenfield Confirmation

This repository contains **no `src/` and no `src-tauri/` directory**. The only existing content is `.planning/` (roadmap, requirements, research, context docs), `.claude/` (GSD tooling config), and `.git/`. There is no application code of any kind to analyze for patterns.

```
$ ls -la /Users/bogdan/Projects/Journal
.claude/
.git/
.planning/
```

Confirmed via direct `ls` — no false negative from a misnamed directory. This is a true greenfield start.

**Consequence:** There are zero in-repo analogs for any file this phase will create. This phase's own output (the `create-tauri-app` scaffold + the files below) becomes the *first* pattern set that later phases (2, 3) will copy from. The planner should treat RESEARCH.md's "Architecture Patterns" and "Code Examples" sections as the primary source of implementation patterns for Phase 1, not this document's analog-mapping mechanism (which has nothing to map against).

## File Classification

All files below are **net-new** — created by `npm create tauri-app@latest` scaffolding plus this phase's hand-written additions. None have an existing analog in this codebase.

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|-----------------|----------------|
| `src/app/App.tsx` | provider/controller (app shell) | request-response (routes today vs. selected day) | none | no-analog |
| `src/editor/EditorCanvas.tsx` | component | streaming (continuous text input → debounced writes) | none | no-analog |
| `src/storage/dayFile.ts` | service | file-I/O (CRUD on day `.md` files) | none | no-analog |
| `src/storage/journalDir.ts` | utility/config | file-I/O (resolves base directory) | none | no-analog |
| `src/calendar/CalendarNav.tsx` | component | request-response (directory scan → render) | none | no-analog |
| `src/hooks/useDebouncedFlush.ts` | hook | event-driven (debounce + flush triggers) | none | no-analog |
| `src-tauri/capabilities/default.json` | config | — (declarative permissions) | none | no-analog |
| `src-tauri/tauri.conf.json` | config | — (window/bundle config) | none | no-analog |
| `src-tauri/Cargo.toml` | config | — (Rust plugin registration) | none | no-analog |
| `.github/workflows/build.yml` (CI matrix, per Pitfall 3) | config | batch (build pipeline) | none | no-analog |

## Pattern Assignments

No pattern assignments are possible — there is no prior code in this repository to extract imports, auth patterns, core logic, error handling, or validation conventions from. Do not fabricate analogs.

**Instruction to planner:** For each file above, use RESEARCH.md's "Architecture Patterns" section directly as the implementation source:

- `src/storage/dayFile.ts` — use RESEARCH.md "Code Examples > Loading and resolving today's file path" (dayFilePath/loadDay/saveDay functions, cited from official `@tauri-apps/plugin-fs` + `date-fns` docs).
- `src/editor/EditorCanvas.tsx` + `src/hooks/useDebouncedFlush.ts` — use RESEARCH.md "Pattern 2: Debounce + explicit flush points" (schedule/flush hook) and "Pattern 3: Flush before quit via `onCloseRequested`".
- `src/calendar/CalendarNav.tsx` — use RESEARCH.md "Code Examples > Scanning the journal directory for the calendar's content dots" (`daysWithContent()` via `readDir`), combined with `date-fns` month-grid math per "Don't Hand-Roll" table (no calendar library).
- `src-tauri/capabilities/default.json` — use RESEARCH.md "Pattern 1: Capability + scope are two separate, both-required layers" verbatim as a starting template, adjusted to whichever `BaseDirectory` is chosen (Open Question 1: `$APPDATA` vs `$DOCUMENT`).
- Delete-day confirmation flow — use `@tauri-apps/plugin-dialog`'s `confirm` import (v2 path, not the v1 `@tauri-apps/api/dialog` path — see RESEARCH.md "State of the Art" correction).

## Shared Patterns

### File path construction (security-relevant)
**Source:** RESEARCH.md Security Domain — path traversal mitigation
**Apply to:** `dayFile.ts`, `CalendarNav.tsx`, any delete-day action
All day-file paths must be constructed only through a single `dayFilePath(date: Date)` helper fed by a validated `Date` object (via `date-fns format()`), never by interpolating raw UI strings into a `plugin-fs` path argument.

### Debounce + flush
**Source:** RESEARCH.md Pattern 2 + Pattern 3
**Apply to:** `EditorCanvas.tsx` (schedule on `docChanged`), app shell (`onCloseRequested`), day-navigation handler (flush before switching days), blur handler (`domEventHandlers({ blur })`)

### Capability/scope pairing
**Source:** RESEARCH.md Pattern 1
**Apply to:** `src-tauri/capabilities/default.json` — every `fs:allow-*` permission needs a matching `allow` scope entry; omitting either fails silently at runtime.

### Dark-mode-only CSS
**Source:** RESEARCH.md Pitfall 4
**Apply to:** All component files (`App.tsx`, `EditorCanvas.tsx`, `CalendarNav.tsx`) — hardcode dark literal CSS values, do not use `prefers-color-scheme` media queries; add `<meta name="color-scheme" content="dark">` in `index.html`.

## No Analog Found

All files in this phase have no analog — this is the expected and correct state for a greenfield first phase.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| all files listed above | various | various | No `src/` or `src-tauri/` exists yet in this repository; nothing to copy from. RESEARCH.md's Code Examples and Architecture Patterns sections are the substitute source of truth for this phase only. |

## Metadata

**Analog search scope:** Entire repository root (`/Users/bogdan/Projects/Journal`) — confirmed via `ls -la` that only `.claude/`, `.git/`, `.planning/` exist; no `src/`, no `src-tauri/`, no `package.json`.
**Files scanned:** 0 source files (none exist)
**Pattern extraction date:** 2026-08-29
**Forward note for Phase 2/3 pattern-mappers:** Once Phase 1 lands, its `src/storage/dayFile.ts`, `src/editor/EditorCanvas.tsx`, and `src-tauri/capabilities/default.json` become the canonical analogs for later phases' tag-parsing/search files.
