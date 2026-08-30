---
phase: 01-reliable-daily-writing-navigation
plan: 02
subsystem: storage, app-shell
tags: [tauri, react, node-test, debounce, write-serialization, utf-8]

requires:
  - phase: 01-reliable-daily-writing-navigation
    provides: storage/editor/app-shell scaffold from 01-01 (dayFile.ts, dayPath.ts, useDebouncedFlush.ts, App.tsx, EditorCanvas.tsx)
provides:
  - Flush-on-quit via Tauri's onCloseRequested, with re-entry guard and finally-block destroy() so a rejected flush can never make the app unquittable
  - goToDay(next) day-navigation seam: flush-then-load, aborts on flush failure, sole assigner of currentDate
  - Pure, node --test-able write-serialization core (flushController.ts) backing useDebouncedFlush, pinning coalesce/serialize/retry-after-rejection/hasPending contracts
  - normalizeForWrite/normalizeForRead named identity passthroughs on dayFile.ts's save/load path, with node --test coverage proving byte-for-byte fidelity (blank lines, CRLF, emoji/CJK/RTL, a decomposed combining-accent sequence, leading/trailing spaces, trailing-newline presence/absence)
  - dayHasContent(text) — single definition of "this day has entries", consumed by saveDay's write-skip rule (no stub .md file for an untyped day) and reserved for Plan 03's calendar dot
affects: ["01-03 calendar navigation and delete", "01-04 CI build matrix and packaging"]

actuals:
  tokens: 4794
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Pure, framework-free core + thin React-hook wrapper: flushController.ts holds all debounce/serialize/retry state as plain closures (no useRef/useCallback), so it runs under node --test without a DOM renderer; useDebouncedFlush.ts persists one controller instance per component via useRef and always writes through the latest save closure via a second ref, so a render-scoped save target (the current day) can change without losing in-flight/pending state."
    - "Flush-then-navigate ordering: any day-state transition (quit, day switch) always awaits flush() to completion before the next step proceeds; a rejected flush aborts the transition rather than proceeding, because useDebouncedFlush's writes always target the *current* render's save closure."
    - "Named identity-transform passthroughs (normalizeForWrite/normalizeForRead) as the one place a future phase would have to deliberately break the byte-fidelity guarantee, with a dedicated round-trip test file pinning it."

key-files:
  created:
    - src/hooks/flushController.ts
    - src/storage/flushController.test.ts
    - src/storage/dayFile.roundtrip.test.ts
  modified:
    - src/hooks/useDebouncedFlush.ts
    - src/app/App.tsx
    - src/storage/dayFile.ts
    - src/storage/journalDir.ts

key-decisions:
  - "Extracted useDebouncedFlush's write-serialization logic (already fully implemented in Plan 01, ahead of this plan's own scope) into a pure src/hooks/flushController.ts module — a React hook cannot be invoked outside a component without a DOM renderer, so this plan's node --test verify gate could not exercise the hook directly. No behavior changed; this is a testability-driven extraction, not a rewrite."
  - "node --test <directory> (bare path, as literally written in this plan's own verify commands) does not recurse on this project's Node v26.5.0 build — it throws MODULE_NOT_FOUND treating the directory as a module specifier. node --test 'src/storage/**/*.test.ts' (or bare node --test, which auto-discovers project-wide) is the working equivalent; both were used throughout this plan's verification."
  - "goToDay aborts the day switch (does not touch currentDate) if its own flush() call rejects, rather than proceeding regardless. useDebouncedFlush always saves through the *current* render's save closure (bound to currentDate), so switching currentDate before a failed write's retry lands would repoint that retry at the wrong day's file."

patterns-established:
  - "Pattern: a hook that needs to be node --test-able splits into a pure closure-based core (no React APIs) plus a thin useRef-persisted wrapper — established here for flushController.ts/useDebouncedFlush.ts, reusable for any future stateful hook this project needs to unit-test."

requirements-completed: [WRITE-02, WRITE-03, WRITE-04]

coverage:
  - id: D11
    description: "Closing the app window flushes the pending buffer to disk before the window is destroyed, so the last thing typed survives a normal quit"
    requirement: "WRITE-02"
    verification:
      - kind: unit
        ref: "src/app/App.tsx — onCloseRequested handler awaits flush() in try, calls destroy() in finally (grep-verified: onCloseRequested, preventDefault, destroy all present)"
        status: pass
    human_judgment: true
    rationale: "Requires visual/interactive confirmation of a running GUI app (real keystrokes, real quit, real relaunch) — deferred to end-of-phase UAT per workflow.human_verify_mode=end-of-phase. The close-interception code shape (preventDefault, awaited flush, destroy in finally, re-entry guard) is grep-verified and type-checked; the disk round-trip itself needs a running webview + Rust core."
  - id: D12
    description: "If a debounce timer fires while a save is already in flight, exactly one write wins and the file ends up holding the latest buffer — writes never interleave and never produce a partial file"
    requirement: "WRITE-02"
    verification:
      - kind: unit
        ref: "src/storage/flushController.test.ts#two rapid schedule() calls collapse into one save call carrying the newest text"
        status: pass
      - kind: unit
        ref: "src/storage/flushController.test.ts#flush() awaits an in-flight write, then the newest pending write, in order"
        status: pass
      - kind: unit
        ref: "src/storage/flushController.test.ts#a rejected save retains its text so the next flush() retries it"
        status: pass
    human_judgment: false
  - id: D13
    description: "Pressing Enter twice leaves a single blank line in the file and that blank line survives save and reload unchanged; three or more consecutive blank lines are preserved verbatim rather than collapsed"
    requirement: "WRITE-03"
    verification:
      - kind: unit
        ref: "src/storage/dayFile.roundtrip.test.ts#normalizeForWrite/normalizeForRead preserve a single blank-line boundary exactly"
        status: pass
      - kind: unit
        ref: "src/storage/dayFile.roundtrip.test.ts#normalizeForWrite/normalizeForRead preserve four consecutive newlines verbatim"
        status: pass
    human_judgment: true
    rationale: "The identity-transform pure functions are fully automated-pinned above; confirming the blank-line boundary survives an actual save-to-disk-and-reload cycle through the running app, visible in an external editor, requires the GUI (Task 2's human-check) — deferred to end-of-phase UAT."
  - id: D14
    description: "A day file that is empty or contains only whitespace loads as a blank canvas and produces zero entries"
    requirement: "WRITE-03"
    verification:
      - kind: unit
        ref: "src/storage/dayFile.roundtrip.test.ts#dayHasContent is false for empty or whitespace-only text"
        status: pass
    human_judgment: true
    rationale: "dayHasContent's empty/whitespace boundary is fully automated-pinned, but loadDay's disk-level behavior and the editor rendering a blank canvas require the running app — deferred to end-of-phase UAT. Phase 1 renders no discrete 'entries' at all (D-04/D-05), so 'zero entries' is trivially true by construction; the GUI check is about the blank-canvas state, not entry counting."
  - id: D15
    description: "Non-ASCII text, emoji, and combining characters round-trip through save and reload byte-identically as UTF-8 with no BOM and no Unicode normalization"
    requirement: "WRITE-03, WRITE-04"
    verification:
      - kind: unit
        ref: "src/storage/dayFile.roundtrip.test.ts#emoji, CJK, and RTL text round-trip with identical code points"
        status: pass
      - kind: unit
        ref: "src/storage/dayFile.roundtrip.test.ts#a combining-accent sequence is not folded into its precomposed form"
        status: pass
    human_judgment: true
    rationale: "Code-point preservation through the pure transform is fully automated-pinned; confirming the actual on-disk bytes are UTF-8 with no BOM after a real writeTextFile call requires the running app and external-editor inspection (Task 2's human-check) — deferred to end-of-phase UAT."
  - id: D16
    description: "Save and reload is lossless: the bytes on disk are exactly the editor buffer, with no inserted trailing newline, no trimmed whitespace, and no line-ending rewriting"
    requirement: "WRITE-03"
    verification:
      - kind: unit
        ref: "src/storage/dayFile.roundtrip.test.ts#normalizeForWrite does not append a trailing newline to text that lacks one"
        status: pass
      - kind: unit
        ref: "src/storage/dayFile.roundtrip.test.ts#normalizeForWrite keeps exactly one trailing newline when the text already ends with one"
        status: pass
      - kind: unit
        ref: "src/storage/dayFile.roundtrip.test.ts#CRLF input survives unchanged in both directions"
        status: pass
      - kind: unit
        ref: "src/storage/dayFile.roundtrip.test.ts#leading and trailing spaces on a line are preserved"
        status: pass
      - kind: unit
        ref: "! grep -rnE \"\\.trimEnd\\(\\)|\\.trimStart\\(\\)|\\\\r\\\\n|normalize\\(['\\\"]NF\" src/storage/dayFile.ts"
        status: pass
    human_judgment: true
    rationale: "The identity-transform contract is fully automated-pinned at the pure-function layer; confirming the actual bytes written by a real writeTextFile call match exactly what CodeMirror held requires the running app (Task 2's human-check) — deferred to end-of-phase UAT."
  - id: D17
    description: "A day the user opened but never typed into produces no .md file on disk; a day whose text is cleared to whitespace keeps its file rather than being silently deleted"
    requirement: "WRITE-04"
    verification:
      - kind: unit
        ref: "src/storage/dayFile.ts — saveDay skips writing only when !dayHasContent(text) AND !exists(); code-inspected, type-checked"
        status: pass
      - kind: unit
        ref: "! grep -nE \"\\bremove\\(|unlink\" src/storage/dayFile.ts"
        status: pass
    human_judgment: true
    rationale: "The write-skip logic and the absence of any destructive filesystem call are automated-verified; confirming no .md file actually appears on disk for an untyped day requires the running app and a real journal-folder inspection (Task 2's human-check) — deferred to end-of-phase UAT."
  - id: D18
    description: "A crash or force-kill during an in-flight writeTextFile does not leave a truncated day file (backstop truth — flush-on-blur/close/quit is the accepted MVP mitigation, not atomic temp+rename)"
    verification: []
    human_judgment: true
    rationale: "Declared a `backstop` verification in the plan's own must_haves — an accepted-risk design decision (RESEARCH.md Open Question 2, carried forward from Plan 01's D10), not something this plan proves empirically. This plan narrows the in-flight window further (flush now also fires on quit, not just blur) but does not add write-to-temp-then-rename. Revisit only if UAT surfaces real mid-write corruption."

duration: 6min
completed: 2026-08-30
status: complete
---

# Phase 1 Plan 2: Durability Hardening Summary

**Flush-on-quit via onCloseRequested with a re-entry guard, a flush-then-load goToDay seam, writes serialized through an extracted node --test-able controller, and a byte-fidelity round-trip test proving the save/load path is the identity function.**

## Performance

- **Duration:** 6 min (wall-clock across this plan's four task commits, 01:58:21 to 02:04:33 local time)
- **Started:** 2026-08-30T05:58:21Z
- **Completed:** 2026-08-30T06:04:33Z
- **Tasks:** 2
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments
- Closed the two remaining D-02 gaps Plan 01 left open: app-close now intercepts via `getCurrentWindow().onCloseRequested`, flushing before `destroy()` (always run from `finally`, so a rejected flush can never make the app unquittable), and the `goToDay(next)` seam Plan 03's calendar will call flushes the outgoing day before loading and switching to the next one.
- Discovered — and pinned with tests rather than re-implementing — that Plan 01 had already built the full write-serialization/retry-on-rejection contract into `useDebouncedFlush`. Extracted that logic into a pure, framework-free `flushController.ts` so it is directly exercisable under `node --test` (a React hook cannot be called outside a component without a DOM renderer), with 5 tests covering coalescing, in-flight-then-pending ordering, retry-after-rejection, no-op-when-empty, and `hasPending()`.
- Added `normalizeForWrite`/`normalizeForRead` as named identity passthroughs on `dayFile.ts`'s save/load path and `dayHasContent` as the single definition of "this day has entries," with a 9-test round-trip suite proving byte-for-byte fidelity across blank-line boundaries, CRLF, emoji/CJK/RTL text, a genuinely decomposed combining-accent sequence, leading/trailing whitespace, and trailing-newline presence/absence.
- Applied the write-skip rule in `saveDay`: an untyped day now leaves no stub `.md` file, while clearing an existing day's text to whitespace still writes the empty content through rather than deleting the file — with no destructive filesystem call anywhere in `dayFile.ts`.

## Task Commits

Each task was committed atomically (TDD RED → GREEN, no refactor commit needed for either):

1. **Task 1: Flush on quit and on day-navigation, with serialized writes**
   - `7fdd883` (test) — failing test for the write-serialization controller
   - `dce6b03` (feat) — `flushController.ts` extraction, `useDebouncedFlush.ts` wrapper, `App.tsx` `onCloseRequested` + `goToDay`
2. **Task 2: Byte-fidelity round-trip and empty-day file semantics**
   - `23f9a30` (test) — failing test for byte-fidelity round-trip and `dayHasContent`
   - `6d95b3c` (feat) — `normalizeForWrite`/`normalizeForRead`/`dayHasContent` in `dayFile.ts`, write-skip rule, `.ts` import-extension fix

**Plan metadata:** commit hash recorded after this SUMMARY is written (see below).

## Files Created/Modified
- `src/hooks/flushController.ts` - New: pure, framework-free debounce/serialize/retry write-controller core (no React, no Tauri imports)
- `src/storage/flushController.test.ts` - New: 5 `node --test` cases pinning the controller's coalesce/serialize/retry/hasPending contracts
- `src/storage/dayFile.roundtrip.test.ts` - New: 9 `node --test` cases pinning `normalizeForWrite`/`normalizeForRead`/`dayHasContent` as the identity function and the has-content boundary
- `src/hooks/useDebouncedFlush.ts` - Rewritten as a thin wrapper: persists one `flushController` instance per component via `useRef`, writes through the latest `save` closure via a second ref
- `src/app/App.tsx` - Adds `onCloseRequested` flush-before-destroy (re-entry guarded), `goToDay(next)` flush-then-load seam (sole assigner of `currentDate`), initial-load effect narrowed to mount-only
- `src/storage/dayFile.ts` - Adds `normalizeForWrite`/`normalizeForRead`/`dayHasContent`; `saveDay` now skips writing for a never-typed day; fixed missing `.ts` extension on its `./dayPath` import
- `src/storage/journalDir.ts` - Fixed missing `.ts` extension on its `./dayPath` import (same Node ESM resolution issue)

## Decisions Made
- Extracted `useDebouncedFlush`'s write-serialization logic (already implemented ahead of schedule in Plan 01) into a pure `flushController.ts` module purely for `node --test`-ability — no behavior change, confirmed by porting the logic verbatim and having all 5 behavior-block tests pass on first run against the ported code.
- `node --test <directory>` (the plan's own literal verify command, bare path) does not recurse on this project's Node v26.5.0 build — it throws `MODULE_NOT_FOUND`. Used `node --test 'src/storage/**/*.test.ts'` (glob) throughout this plan's verification instead; documented so future plans/CI don't hit the same surprise.
- `goToDay` aborts the day switch if its own `flush()` call rejects, rather than proceeding regardless — see Deviations below (Rule 2).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `useDebouncedFlush` cannot be unit-tested as a React hook under `node --test`**
- **Found during:** Task 1, writing the behavior-block tests for the write-serialization controller
- **Issue:** The plan's `<behavior>` block requires tests that "exercise the hook's contract directly" under `node --test src/storage/`, but a React hook (uses `useRef`/`useCallback`) cannot be invoked outside a component render without a DOM renderer/React reconciler — calling it directly throws "Invalid hook call."
- **Fix:** Extracted the existing debounce/serialize/retry logic (already fully implemented in Plan 01) into a pure, closure-based `src/hooks/flushController.ts` with zero React/Tauri imports. `useDebouncedFlush.ts` became a thin wrapper that persists one controller instance per component via `useRef` and always writes through the latest `save` closure via a second ref (so a render-scoped save target, e.g. the current day, stays current without recreating the controller and losing its pending/in-flight state).
- **Files modified:** `src/hooks/flushController.ts` (new), `src/hooks/useDebouncedFlush.ts`
- **Verification:** `node --test 'src/storage/**/*.test.ts'` — 5/5 controller tests pass; `npx tsc --noEmit` and `npm run build` pass.
- **Commit:** `dce6b03`

**2. [Rule 3 - Blocking issue] `node --test src/storage/` (bare directory) does not recurse on this Node build**
- **Found during:** Task 1, first attempt to run the plan's own literal verify command
- **Issue:** `node --test src/storage/` (and `./src/storage`, with or without a trailing slash) throws `Error: Cannot find module '/…/src/storage'` — Node v26.5.0 treats the directory argument as a module specifier to `require()` rather than a glob root, contrary to the plan's assumption.
- **Fix:** Used `node --test 'src/storage/**/*.test.ts'` (explicit glob) as the working equivalent for every verification pass in this plan; bare `node --test` (no path, project-wide auto-discovery) also works and was used to cross-check.
- **Files modified:** None (tooling-invocation finding, not a source change).
- **Verification:** Both invocations correctly discover and run all `src/storage/*.test.ts` files (23/23 pass at the end of this plan).
- **Commit:** N/A (documented here and in task commit messages; no source diff).

**3. [Rule 3 - Blocking issue] `dayFile.ts` and `journalDir.ts` imported `./dayPath` without the `.ts` extension Node's native ESM loader requires**
- **Found during:** Task 2, first RED run of `dayFile.roundtrip.test.ts` (which imports `dayFile.ts`)
- **Issue:** `dayFile.ts`'s `import { dayFilePath } from "./dayPath"` (and `journalDir.ts`'s equivalent) resolves fine under Vite's bundler-mode `moduleResolution`, but Node's native ESM loader (used by `node --test`) requires the explicit extension for relative specifiers — the import chain failed with `ERR_MODULE_NOT_FOUND` before the test could even reach the missing `normalizeForWrite`/`normalizeForRead`/`dayHasContent` exports.
- **Fix:** Added `.ts` to both imports (`"./dayPath.ts"`, `"./journalDir.ts"`), matching the convention `dayPath.test.ts` already used.
- **Files modified:** `src/storage/dayFile.ts`, `src/storage/journalDir.ts`
- **Verification:** `node --test 'src/storage/**/*.test.ts'` passes; `npx tsc --noEmit` and `npm run build` unaffected (bundler-mode resolution already tolerated both forms).
- **Commit:** `6d95b3c`

**4. [Rule 2 - Missing critical functionality] `goToDay` aborts the day switch when `flush()` rejects, instead of navigating anyway**
- **Found during:** Task 1, implementing the `goToDay` seam
- **Issue:** The plan's action text describes `goToDay` as "flush, then load, then set currentDate" but doesn't explicitly address a failed flush. Because `useDebouncedFlush` always saves through the *current* render's `save` closure (bound to `currentDate`), switching `currentDate` before a failed write's pending text is retried would repoint that retry at the *new* day's file — silently misdirecting a previously-typed day's content into the wrong file, undermining the exact ordering guarantee (T-01-06) this plan exists to hardened.
- **Fix:** `goToDay` now catches a `flush()` rejection, surfaces it via the existing inline error element, and returns without touching `currentDate`, `initialText`, or clearing the error — the failed write stays queued against the day it actually belongs to, and the user stays on that day until it succeeds.
- **Files modified:** `src/app/App.tsx`
- **Verification:** `npx tsc --noEmit` and `npm run build` pass; behavior verified by code inspection against `flushController.ts`'s save-closure-per-render contract (no dedicated integration test — `App.tsx` isn't `node --test`-able without a Tauri/DOM runtime, consistent with this plan's other App.tsx changes, which are grep + human-check verified).
- **Commit:** `dce6b03`

**5. [Rule 2 - Missing critical functionality] Narrowed the initial-load effect's dependency array from `[currentDate]` to mount-only**
- **Found during:** Task 1, wiring `goToDay` alongside the pre-existing load-on-mount effect
- **Issue:** The original effect re-ran `loadDay` on every `currentDate` change. Once `goToDay` also calls `loadDay(next)` itself before switching `currentDate`, leaving the effect keyed on `[currentDate]` would fire a second, redundant `loadDay` call racing against `goToDay`'s own — harmless today (no calendar UI yet calls `goToDay`) but a latent double-load/race bug the moment Plan 03 wires a caller.
- **Fix:** Changed the effect's dependency array to `[]` (mount-only), with an inline comment explaining that every subsequent day change goes exclusively through `goToDay`.
- **Files modified:** `src/app/App.tsx`
- **Verification:** `npx tsc --noEmit` and `npm run build` pass; the mount-time load still exercises the exact same code path as before (verified by reading the diff — only the dependency array changed).
- **Commit:** `dce6b03`

---

**Total deviations:** 5 auto-fixed (3 Rule 3 blocking-issue fixes, 2 Rule 2 missing-critical-functionality fixes).
**Impact on plan:** None change the plan's architecture, storage format, or capability surface. Three are dependency-resolution/tooling-invocation corrections discovered while executing exactly the tasks as written; two are correctness hardening directly in service of this plan's own stated goal (writes never landing in the wrong day's file). No re-planning needed.

## Issues Encountered
None beyond the five deviations above, all resolved within the fix-attempt budget. One test-authoring mistake (an assertion in `flushController.test.ts`'s in-flight-write test checked `calls` synchronously immediately after calling `flush()`, before the promise chain had actually invoked `save()` on its first microtask tick) was caught and fixed during the GREEN pass — not a deviation from the plan, just a bug in the test I wrote, corrected before committing.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **01-03 (calendar navigation)** can call `goToDay(next: Date)` from `src/app/App.tsx` and `dayHasContent(text: string): boolean` from `src/storage/dayFile.ts` directly, without re-deriving either — `goToDay` already handles the flush-then-load ordering and flush-failure abort case; `dayHasContent` is the single source of truth the calendar's content-dot scan should reuse rather than reimplementing its own emptiness check.
- **01-04 (CI build matrix)** is unaffected by this plan; the Node-version-specific `node --test <dir>` finding (Deviation 2) is worth carrying into any CI test-invocation script — use a glob or bare `node --test`, not a bare directory path.
- No blockers. The `onCloseRequested`/`destroy()` code shape was confirmed directly against the installed `@tauri-apps/api/window` type declarations (`onCloseRequested(handler): Promise<UnlistenFn>`, `CloseRequestedEvent.preventDefault()`, `destroy(): Promise<void>`) before being written against, per this plan's `<read_first>` requirement — no assumption-driven API mismatch risk carried forward.
- CodeMirror's line-ending behavior on pasted CRLF text (Assumption 3 in the plan's Flagged Assumptions) was **not observed** this session — no running app was launched to test a real paste. This remains an open item for end-of-phase UAT: the storage-layer round-trip test proves `dayFile.ts` itself never rewrites CRLF, but whether CodeMirror's own input handling normalizes a pasted CRLF sequence before it reaches `saveDay` is unverified.
- Windows-specific `onCloseRequested` behavior (Assumption 2) also remains unverified — this machine is macOS-only, consistent with Plan 01's carried-forward note; belongs in end-of-phase UAT alongside the other GUI-only checks above.
- All GUI-visual `<human-check>` items from both tasks (immediate-close-survives-relaunch; blank-line/emoji/accent round-trip visible in an external editor plus no stub file for an untyped day) are deferred to end-of-phase UAT per `workflow.human_verify_mode=end-of-phase` — see the `coverage` block's `human_judgment: true` entries (D11, D13, D14, D15, D16, D17, D18) for the exact walkthrough steps, mirroring both tasks' `<human-check>` text verbatim.

## Self-Check: PASSED

All 7 created/modified source files listed in `key-files` were verified present on disk (`flushController.ts`, `flushController.test.ts`, `dayFile.roundtrip.test.ts`, `useDebouncedFlush.ts`, `App.tsx`, `dayFile.ts`, `journalDir.ts`), and all 4 task commit hashes (`7fdd883`, `dce6b03`, `23f9a30`, `6d95b3c`) were verified present in `git log --oneline --all`.

---
*Phase: 01-reliable-daily-writing-navigation*
*Completed: 2026-08-30*
