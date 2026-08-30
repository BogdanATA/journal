---
phase: 01-reliable-daily-writing-navigation
plan: 01
subsystem: app-shell, storage, editor
tags: [tauri, react, codemirror, date-fns, plugin-fs, walking-skeleton]

requires: []
provides:
  - Rust toolchain installed on the dev machine (was previously absent)
  - Tauri v2 + React 19 + TypeScript scaffold at repo root (create-tauri-app react-ts template)
  - Dark-only shell (hardcoded CSS custom properties, no OS-theme media query, color-scheme meta)
  - Journal storage location decided and encoded ($APPDATA/journal/)
  - Pure, tested day-file path construction (dayPath.ts)
  - Tauri capability file scoped to the journal subfolder only (fs + dialog)
  - loadDay/saveDay against plugin-fs (dayFile.ts)
  - Debounced autosave with flush-on-blur and write serialization (useDebouncedFlush.ts)
  - CodeMirror 6 notepad canvas wired to the debounced save (EditorCanvas.tsx)
  - App shell that loads today's file on mount and surfaces fs errors inline (App.tsx)
affects: ["01-02 durability hardening", "01-03 calendar navigation and delete", "01-04 CI build matrix and packaging"]

actuals:
  tokens: 4589
  tasks: 3
  commits: 4

tech-stack:
  added:
    - "@tauri-apps/cli@2.11.4, @tauri-apps/api@2.11.1, @tauri-apps/plugin-fs@2.5.1, @tauri-apps/plugin-dialog@2.7.2"
    - "react@19.2.8, react-dom@19.2.8"
    - "@uiw/react-codemirror@4.25.11, @codemirror/state@6.7.1, @codemirror/view@6.43.9, @codemirror/commands@6.11.0"
    - "date-fns@4.4.0"
    - "typescript@5.9.3, vite@8.2.2, @vitejs/plugin-react@6.1.1 (bumped from the plan's ^4 pin — see deviations)"
    - "@types/node@22.20.1 (dev-only, added for node:test/node:assert types)"
    - "Rust stable 1.98.0 via rustup (was entirely absent on this machine)"
  patterns:
    - "Single pure path-construction module (dayPath.ts) with zero Tauri imports, runnable under node --test directly, feeding every plugin-fs call by direct inlined call rather than an intermediate path variable"
    - "Single BaseDirectory-importing module (journalDir.ts) as the only place a Tauri storage-root concept exists"
    - "Debounce + explicit flush pair (not a single timer), writes serialized on an in-flight promise ref so two saves can never interleave"
    - "Capability permission + matching allow-scope pairs, scoped to $APPDATA/journal and $APPDATA/journal/* only — no $APPDATA/**/*, $DOCUMENT/**/*, or $HOME root"
    - "Dark-only styling as literal CSS custom properties on :root, no prefers-color-scheme branching anywhere"

key-files:
  created:
    - src/storage/dayPath.ts
    - src/storage/dayPath.test.ts
    - src/storage/journalDir.ts
    - src/storage/dayFile.ts
    - src/hooks/useDebouncedFlush.ts
    - src/editor/EditorCanvas.tsx
    - src/styles.css
  modified:
    - package.json
    - index.html
    - vite.config.ts
    - tsconfig.json
    - .gitignore
    - src/main.tsx
    - src/app/App.tsx
    - src-tauri/Cargo.toml
    - src-tauri/src/lib.rs
    - src-tauri/tauri.conf.json
    - src-tauri/capabilities/default.json

key-decisions:
  - "Journal storage location: $APPDATA/journal/ (Tauri BaseDirectory.AppData) — decided by the project owner via an interactive question in the orchestrating session, presented with the full pros/cons from the plan's checkpoint:decision task text. Chosen over $DOCUMENT/Journal for: conventional app-data home on both platforms, coverage by plugin-fs's default permission set, no macOS privacy prompt on first write, and zero risk of colliding with an unrelated user folder. Recorded verbatim in src/storage/journalDir.ts and src/storage/dayPath.ts (JOURNAL_SUBDIR = \"journal\")."
  - "@vitejs/plugin-react bumped from the plan's pinned ^4 to ^6 — see Deviations."
  - "tauri-plugin-opener and @tauri-apps/plugin-opener removed from the scaffold (unused demo plugin, not part of the audited Phase 1 dependency set) rather than left wired to a deleted greet command."

patterns-established:
  - "Pattern: every plugin-fs call in dayFile.ts takes dayFilePath(date) as a direct inlined argument, never through an intermediate path variable — makes the T-01-01 path-purity property machine-checkable with a simple grep."

requirements-completed: [WRITE-01, WRITE-02, WRITE-04, PLATFORM-03]

coverage:
  - id: D1
    description: "Rust toolchain installed and Tauri v2 + React 19 + TypeScript shell scaffolded, builds with zero TypeScript errors"
    requirement: "PLATFORM-01"
    verification:
      - kind: unit
        ref: "cargo --version"
        status: pass
      - kind: unit
        ref: "npx tsc --noEmit"
        status: pass
      - kind: unit
        ref: "npm run build"
        status: pass
      - kind: unit
        ref: "cargo build (via `tauri build --debug --no-bundle`) — full Rust + capability + frontend pipeline compiles and links"
        status: pass
    human_judgment: false
  - id: D2
    description: "Dark-only chrome regardless of host OS theme — no prefers-color-scheme rule anywhere, color-scheme meta set to dark, all seven CSS custom properties defined"
    requirement: "PLATFORM-03"
    verification:
      - kind: unit
        ref: "! grep -rq 'prefers-color-scheme' src/ index.html"
        status: pass
      - kind: unit
        ref: "grep -q 'color-scheme' index.html"
        status: pass
    human_judgment: false
  - id: D3
    description: "Exactly one date header rendered, no per-entry metadata, no save/status/spinner indicator anywhere in the chrome"
    requirement: "WRITE-01"
    verification:
      - kind: unit
        ref: "grep -c 'day-header' src/app/App.tsx == 1; grep -c '<h1' src/app/App.tsx == 1"
        status: pass
      - kind: unit
        ref: "grep -inE 'saving|saved|spinner|status' src/app/App.tsx src/editor/EditorCanvas.tsx — only match is the saveDay function name, no UI indicator text"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every filesystem path handed to plugin-fs is produced by dayFilePath(date) from a validated Date and resolves inside the journal folder"
    requirement: "WRITE-04"
    verification:
      - kind: unit
        ref: "node --test src/storage/dayPath.test.ts (8/8 pass, including TypeError-on-invalid-input and traversal-rejection cases)"
        status: pass
      - kind: unit
        ref: "grep -q 'dayFilePath' src/storage/dayFile.ts && ! grep -nE \"(readTextFile|writeTextFile|exists|remove)\\([^d)]\" src/storage/dayFile.ts"
        status: pass
      - kind: unit
        ref: "! grep -qE \"from ['\\\"]@tauri\" src/storage/dayPath.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Tauri capability scope grants the five fs:allow-* permissions only within $APPDATA/journal and $APPDATA/journal/* — no broader $APPDATA, $DOCUMENT, or $HOME root, no recursive wildcard"
    requirement: "PLATFORM-03"
    verification:
      - kind: unit
        ref: "capability-scope assertion script (parses src-tauri/capabilities/default.json, checks every allow path contains 'journal' and no '**')"
        status: pass
    human_judgment: false
  - id: D6
    description: "No outbound network surface anywhere under src/ — CSP connect-src is 'self' ipc: http://ipc.localhost only, no absolute link, XMLHttpRequest, WebSocket, EventSource, or beacon call"
    requirement: "PLATFORM-03"
    verification:
      - kind: unit
        ref: "! grep -rnE 'XMLHttpRequest|sendBeacon|new WebSocket|new EventSource' src/"
        status: pass
      - kind: unit
        ref: "! grep -rnE 'https?://[a-zA-Z]' src/"
        status: pass
      - kind: unit
        ref: "csp assertion script (connect-src allows only 'self', ipc:, http://ipc.localhost)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Launching the app puts a blinking caret in an empty editor for today's date with no click, menu action, or file prompt required"
    requirement: "WRITE-01"
    verification: []
    human_judgment: true
    rationale: "Requires visual/interactive confirmation of a running GUI app — deferred to end-of-phase UAT per workflow.human_verify_mode=end-of-phase"
  - id: D8
    description: "Typing writes the whole buffer to the day file ~1.2s after the last keystroke, and again immediately on window blur; quitting and relaunching shows the text read back from disk"
    requirement: "WRITE-02"
    verification: []
    human_judgment: true
    rationale: "Requires visual/interactive confirmation of a running GUI app (real keystrokes, real blur, real quit/relaunch) — deferred to end-of-phase UAT per workflow.human_verify_mode=end-of-phase. Code-level guarantees (1200ms default delay, in-flight write serialization, blur-triggered flush) are unit-covered where the API surface allows it, but the disk round-trip itself needs a running webview + Rust core."
  - id: D9
    description: "The day file is plain UTF-8 Markdown, opens unchanged in an external text editor, no BOM, no proprietary wrapper; saving the same unchanged buffer twice leaves the file byte-identical"
    requirement: "WRITE-04"
    verification: []
    human_judgment: true
    rationale: "writeTextFile always performs a whole-file overwrite (never append) by construction, and the buffer is written exactly as CodeMirror holds it (no trailing-newline insertion, no trimming) — but proving byte-identical idempotency and BOM-free UTF-8 output requires actually running the app against a real file, deferred to end-of-phase UAT."
  - id: D10
    description: "A crash or force-kill during an in-flight writeTextFile does not leave a truncated day file (backstop truth — flush-on-blur/close is the accepted MVP mitigation, not atomic temp+rename)"
    verification: []
    human_judgment: true
    rationale: "Declared a `backstop` verification in the plan's own must_haves — accepted-risk design decision (RESEARCH.md Open Question 2), not something Phase 1 proves empirically. Revisit with write-to-temp-then-rename only if UAT surfaces real mid-write corruption."

duration: 7min
completed: 2026-08-30
status: complete
---

# Phase 1 Plan 1: Walking Skeleton Summary

**Tauri v2 + React 19 shell autosaving to $APPDATA/journal/YYYY-MM-DD.md via a debounced CodeMirror 6 canvas, with the two-layer Tauri capability/scope permission model locked to the journal subfolder only.**

## Performance
- **Duration:** 7 min (wall-clock across the session; excludes upfront required-reading time)
- **Started:** 2026-08-30T05:39:50Z
- **Completed:** 2026-08-30T05:46:58Z
- **Tasks:** 3 (Task 2's decision pre-resolved by the project owner in the orchestrating session)
- **Files modified:** 18 (matches the plan's `files_modified` frontmatter exactly)

## Accomplishments
- Installed the Rust toolchain (previously entirely absent on this machine) and scaffolded a working Tauri v2 + React 19 + TypeScript app from `create-tauri-app`, with the audited dependency set at the verified majors from RESEARCH.md.
- Resolved the one open product decision (journal storage location) and encoded it as the single `BaseDirectory.AppData` constant in `journalDir.ts`, with the Tauri capability scope locked to `$APPDATA/journal` and `$APPDATA/journal/*` only — never a broader root.
- Proved the full vertical slice end-to-end: typing in a CodeMirror 6 canvas schedules a debounced save, flushes immediately on blur, writes through a single validated path-construction helper, and the whole stack compiles and links (`tauri build --debug --no-bundle` succeeded).

## Task Commits
Each task was committed atomically:
1. **Task 1: Install Rust toolchain and scaffold dark-only shell** - `a67cab3`
2. **Task 2: Journal storage location decision** - no separate commit (decision-only task per its own frontmatter; recorded in Task 3's commits and this SUMMARY)
3. **Task 3: End-to-end tracer (RED/GREEN/integration)** - three commits: `b88b022` (test), `2db72a1` (feat, dayPath.ts — no refactor commit needed, implementation was clean on first pass), `0aecadc` (feat, full integration)

**Plan metadata:** commit hash recorded after this SUMMARY is written (see below).

## Files Created/Modified
- `src/storage/dayPath.ts` - Pure day-file path construction/validation; zero Tauri imports; `node --test`-able
- `src/storage/dayPath.test.ts` - 8 `node --test` cases covering zero-padding, traversal rejection, TypeError guards, and `dayFromFileName` parsing
- `src/storage/journalDir.ts` - `JOURNAL_BASE_DIR = BaseDirectory.AppData`, `ensureJournalDir()` — the only module importing a `BaseDirectory`
- `src/storage/dayFile.ts` - `loadDay`/`saveDay` against plugin-fs, every call inlining `dayFilePath(date)` directly (no intermediate path variable)
- `src/hooks/useDebouncedFlush.ts` - Hand-rolled debounce/flush pair, 1200ms default, in-flight write serialization
- `src/editor/EditorCanvas.tsx` - CodeMirror 6 canvas via `@uiw/react-codemirror`, dark-themed via CSS custom properties, `updateListener`/`domEventHandlers` blur wiring, autofocus
- `src/app/App.tsx` - App shell: loads today's file on mount, wires debounce/flush into the canvas, surfaces fs errors inline (no swallowing)
- `src/styles.css` - Hardcoded dark-only CSS custom properties, no OS-theme media query
- `src-tauri/capabilities/default.json` - `fs:default`, `dialog:default`, and the five `fs:allow-*` permissions scoped to the journal subfolder only
- `src-tauri/tauri.conf.json` - `productName` Journal, 900x700 Dark-themed window, locked-down CSP
- `src-tauri/src/lib.rs` - Registers `tauri_plugin_fs::init()` and `tauri_plugin_dialog::init()`; demo `greet` command and `tauri-plugin-opener` removed
- `package.json` - Audited dependency set installed; `@vitejs/plugin-react` bumped to `^6` (see Deviations); `@types/node` added

## Decisions Made
- Storage location: `appdata` (see key-decisions above — decided by the project owner, not this executor).
- `@vitejs/plugin-react` bumped from the plan's `^4` pin to `^6` to resolve an ERESOLVE peer-dependency conflict against `vite@8` (see Deviations).
- Removed `tauri-plugin-opener`/`@tauri-apps/plugin-opener` from the scaffold since it is unused and outside the audited Phase 1 dependency set, rather than leaving a dead plugin registration wired to a deleted demo command.

## Deviations from Plan

**1. [Rule 3 - Blocking issue] `@vitejs/plugin-react@^4` cannot resolve against `vite@^8`**
- **Found during:** Task 1, installing dev dependencies
- **Issue:** `npm install -D ... @vitejs/plugin-react@^4 ...` failed with `ERESOLVE`: the latest `@vitejs/plugin-react@4.7.0` declares a peer range of `^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0` for `vite`, which does not include `vite@8`. CLAUDE.md's Version Compatibility table asserts `@vitejs/plugin-react@^4` as the standard pairing for `vite@8.x`, but the actual published peer range on the registry disagrees — the plugin's own major line has since moved to `^6`, whose peer range is `vite: ^8.0.0`.
- **Fix:** Installed `@vitejs/plugin-react@^6.1.1` instead of `^4`, resolved cleanly with no ERESOLVE and no `--legacy-peer-deps` override needed.
- **Files modified:** `package.json`, `package-lock.json`
- **Verification:** `npm install` completed with `found 0 vulnerabilities` and no peer warnings; `npm run build` succeeds.
- **Commit:** `a67cab3`

**2. [Rule 3 - Blocking issue] `node:test`/`node:assert` types missing for `dayPath.test.ts`**
- **Found during:** Task 3, running `npx tsc --noEmit` after writing `dayPath.test.ts`
- **Issue:** `tsc --noEmit` failed with `TS2307: Cannot find module 'node:test'` and `'node:assert/strict'` — the project has no `@types/node` installed (not part of RESEARCH.md's audited Standard Stack, since the original plan didn't anticipate a `node --test` file needing ambient Node types for `tsc` to typecheck cleanly).
- **Fix:** Installed `@types/node@^22` as a dev dependency (matches the installed Node v26 runtime's LTS-adjacent type surface closely enough for `node:test`/`node:assert` typings; not a runtime dependency, dev-only).
- **Files modified:** `package.json`, `package-lock.json`
- **Verification:** `npx tsc --noEmit` passes cleanly; `node --test src/storage/dayPath.test.ts` still passes (8/8).
- **Commit:** `0aecadc`

**3. [Rule 2 - Missing critical functionality / cleanup] Removed unused `tauri-plugin-opener`**
- **Found during:** Task 1, replacing the template's demo UI
- **Issue:** The scaffold registers `tauri-plugin-opener` (Rust crate + `@tauri-apps/plugin-opener` npm package + `opener:default` capability) purely to support the demo "open a URL" functionality that Task 1 deletes along with the greet command. Left wired, it would be a dead, unaudited dependency with its own capability surface.
- **Fix:** Removed `tauri-plugin-opener` from `Cargo.toml`, `@tauri-apps/plugin-opener` from `package.json`, and `opener:default` from the capability file; removed the plugin registration from `lib.rs`.
- **Files modified:** `src-tauri/Cargo.toml`, `package.json`, `src-tauri/capabilities/default.json`, `src-tauri/src/lib.rs`
- **Verification:** `cargo build` and `npm run build` both succeed with the plugin gone; dependency-absence grep gate still passes (opener was never in the audited "must not install" list, but is now absent regardless).
- **Commit:** `a67cab3`

---
**Total deviations:** 3 auto-fixed (2 Rule 3 blocking-issue fixes, 1 Rule 2 cleanup).
**Impact on plan:** None of the three change the plan's architecture, storage format, or capability surface — all are dependency-resolution or dead-code corrections discovered while executing exactly the tasks as written. No re-planning needed.

## Issues Encountered
None beyond the three deviations above, all resolved within the fix-attempt budget.

## User Setup Required
None - no external service configuration required. `npm run tauri dev` runs the full stack locally with no additional setup beyond what Task 1 installed (Rust toolchain, npm dependencies).

## Next Phase Readiness
- **01-02 (durability hardening)** can build directly on `dayFile.ts`, `useDebouncedFlush.ts`, and the capability scope — no changes needed to consume them; it extends the flush strategy to the quit path (`onCloseRequested`, listed in RESEARCH.md Pattern 3 but not yet wired in this plan since Task 3 scoped to exactly the typing→disk→reload slice).
- **01-03 (calendar navigation)** can build on the same `App.tsx` day-routing shape and `loadDay`/`saveDay` contract; `dayFromFileName` in `dayPath.ts` is already exported and tested for the calendar's directory-scan use case.
- **01-04 (CI build matrix)** can build on a confirmed-working `cargo build`/`tauri build --debug --no-bundle` — the Rust toolchain and plugin registration are proven to compile on this machine.
- No blockers. One open item carried forward per RESEARCH.md Assumption #4: the `@uiw/react-codemirror`/React 19 pairing showed **no** peer-dependency warning on install (`npm ls react` shows a single deduped `react@19.2.8` across the tree) — the pairing is confirmed clean, not just "unproven," as of this plan's execution.
- All GUI-visual `<human-check>` items (blinking caret, dark window, no save indicator, actual disk round-trip) are deferred to end-of-phase UAT per `workflow.human_verify_mode=end-of-phase` — see the `coverage` block's `human_judgment: true` entries (D7-D10) for the exact walkthrough steps, which mirror Task 3's `<human-check>` text verbatim.

## Self-Check: PASSED

All 8 created/modified files listed in `key-files` were verified present on disk (`dayPath.ts`, `dayPath.test.ts`, `journalDir.ts`, `dayFile.ts`, `useDebouncedFlush.ts`, `EditorCanvas.tsx`, `App.tsx`, `capabilities/default.json`), and all 4 task commit hashes (`a67cab3`, `b88b022`, `2db72a1`, `0aecadc`) were verified present in `git log --oneline --all`.

---
*Phase: 01-reliable-daily-writing-navigation*
*Completed: 2026-08-30*
