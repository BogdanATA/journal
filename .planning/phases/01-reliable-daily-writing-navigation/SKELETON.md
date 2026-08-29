# Walking Skeleton — Journal

**Phase:** 1
**Generated:** 2026-08-29

## Capability Proven End-to-End

A user launches the packaged desktop app, types a sentence on the blank canvas for today, quits, relaunches, and sees that sentence again — read back from a plain `YYYY-MM-DD.md` file that also opens unchanged in any external text editor.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| App shell | Tauri v2 (`@tauri-apps/cli` 2.x, Rust core + OS-native WebView) | Single codebase covering macOS + Windows at ~3–10MB installer instead of Electron's 120–200MB; the app is functionally a notepad and must feel like one. Locked project-wide in `.claude/CLAUDE.md`. |
| UI framework | React 19 + TypeScript 5.9 + Vite 8 (`create-tauri-app` react-ts template) | Broadest library coverage for the two hard sub-problems later phases need (CodeMirror 6 React wrapper, fuzzy-search UI). |
| Editor core | CodeMirror 6 via `@uiw/react-codemirror` 4.x | Plain-text-native: the editor buffer **is** the Markdown file. No serialize/deserialize boundary, so the canonical content cannot drift from the on-disk format. |
| Data layer | Plain UTF-8 `.md` files, one per day, named `YYYY-MM-DD.md`, via `@tauri-apps/plugin-fs` | No database anywhere in this project — a DB file is opaque and breaks the "readable outside the app" constraint. Directory listing is the only index. |
| Storage location | Decided at Plan 01 Task 2 (`checkpoint:decision`) — `$APPDATA/journal/` or `$DOCUMENT/Journal/` | One-way door: once a user's journal files exist at a path, relocating the default in a later release strands them. Resolved by the developer, then encoded in `src/storage/journalDir.ts` and the Tauri capability scope. |
| Path construction | Single pure helper `dayFilePath(date: Date)` in `src/storage/dayPath.ts`; no Tauri imports | Security boundary: every filesystem path crossing into the Rust core is derived from a validated `Date`, never from an interpolated UI string. Import-purity keeps it unit-testable with `node --test` and zero new dependencies. |
| Permissions | `src-tauri/capabilities/default.json`, scoped to the journal subfolder only | Tauri v2 requires **both** an `fs:allow-*` permission and a matching `allow` scope path; either alone fails at runtime. Scope is the journal folder, never `$APPDATA/**/*` or `$HOME`. |
| Durability | Debounce 1200ms after last keystroke + forced flush on blur, day-navigation, and window close | D-01/D-02. The debounce window is never the only thing between a keystroke and disk. No save indicator (D-03). |
| Theme | Hardcoded dark literal CSS + `<meta name="color-scheme" content="dark">` | Dark-only is a requirement (PLATFORM-03), and the WebView does not reliably propagate a configured window theme to CSS theme media queries — hardcoding sidesteps the bug entirely. |
| Deployment target | GitHub Actions matrix (`macos-latest` + `windows-latest`), unsigned artifacts | Windows installers cannot be reliably cross-compiled from macOS (Tauri's own docs call it a last resort). Unsigned by explicit product decision (D-10/D-11). Local full-stack run command: `npm run tauri dev`. |
| Directory layout | `src/{app,editor,storage,calendar,hooks}/` + `src-tauri/` | Feature-folder split that Phases 2–3 extend (`src/tags/`, `src/search/`) without restructuring. |

## Stack Touched in Phase 1

- [ ] Project scaffold — `create-tauri-app` react-ts template, Vite build, `tsc --noEmit` typecheck, Rust plugin registration
- [ ] Routing — single-window app with day-state routing (`today` vs. a calendar-selected date) in `src/app/App.tsx`
- [ ] Filesystem — one real read (`loadDay`) AND one real write (`saveDay`) against a `YYYY-MM-DD.md` file through `plugin-fs`
- [ ] UI — CodeMirror 6 canvas whose keystrokes drive the debounced write, plus a calendar picker that switches the loaded day
- [ ] Deployment — `npm run tauri dev` runs the full stack locally on macOS; the CI matrix produces the macOS `.dmg`/`.app` and Windows `.msi`/`.exe`

## Out of Scope (Deferred to Later Slices)

- `#hashtag` parsing, tokenization, or pill rendering — Phase 2 (TAG-01..03). CodeMirror needs zero decoration code in Phase 1; per D-04 the blank-line entry boundary is invisible in the UI.
- Any entry parser / segmentation module. The blank line in the file *is* the boundary; nothing reads structure out of it this phase.
- Fuzzy tag search, near-duplicate clustering, unmatched-tag bucket, Tab-to-accept ghost text — Phase 3 (SEARCH-01..05, TAG-04). Fuse.js and fastest-levenshtein are NOT installed in Phase 1.
- Per-entry timestamps or metadata UI (D-05) — one day header only.
- Any save indicator, spinner, or "saved" toast (D-03).
- A folder-picker / relocatable storage settings screen. The location is fixed at Plan 01 Task 2 for v1.
- Paid code-signing and notarization (D-10/D-11) — unsigned with a documented bypass.
- Light mode, Linux support, cloud sync, database storage, export button — out of scope project-wide (`REQUIREMENTS.md`).
- Atomic write-to-temp-then-rename. Flush-on-blur/close is the accepted MVP durability strategy; revisit only if UAT surfaces real mid-write corruption (RESEARCH.md Open Question 2).

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- **Phase 2** — a user types `#thought` inside an entry and sees it become a visual pill, using CodeMirror 6 `Decoration` over the same unchanged plain-text buffer and the same `dayFile.ts` read/write path.
- **Phase 3** — a user types a tag into a search box and gets every entry filed under it with its date, however the tag was spelled; results click through to that day via the same `App.tsx` day-routing the calendar already uses.
