---
phase: 01-reliable-daily-writing-navigation
plan: 03
subsystem: calendar, storage, app-shell
tags: [tauri, react, date-fns, plugin-fs, plugin-dialog, node-test, hand-rolled-calendar]

requires:
  - phase: 01-reliable-daily-writing-navigation
    provides: "goToDay flush-then-load seam and dayHasContent contract from 01-02; storage/editor scaffold from 01-01"
provides:
  - "loadDaysWithContent() — live journal-folder scan producing the set of days with real content, backing the calendar's dot (D-07)"
  - "CalendarNav — hand-rolled month-grid calendar (date-fns math, no calendar package), opened by a chrome button and Cmd/Ctrl+J, closed by Escape with focus returned to the editor"
  - "deleteDay(date) — the only file-remove call site in the codebase, gated by a single confirm() dialog naming the exact date"
  - "flushController.cancel() — clears a scheduled debounced write without invoking save, so a pending write can never resurrect a deleted day's file"
affects: ["01-04 CI build matrix and packaging", "Phase 3 search (reuses goToDay unchanged for 'jump to that day' results)"]

actuals:
  tokens: 6438
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Pure filter/impure-wrapper split for a directory scan: filterDaysWithContent(entries, readText) takes plain values so it runs under node --test with no webview/Rust core, mirroring flushController.ts's pure-core-plus-thin-wrapper shape from Plan 02; loadDaysWithContent() is the real readDir/readTextFile-calling wrapper."
    - "Live-scan-only calendar index, no persisted cache (T-01-12, accepted): loadDaysWithContent() re-scans the folder every time CalendarNav opens, so the dots can never disagree with the folder."
    - "Confirm-then-cancel-then-delete ordering for the one destructive action: the debounce is only cancelled after the user affirmatively confirms, never before showing the dialog — a Cancel click must leave the pending write untouched, per D-09's 'do nothing at all' contract."
    - "Live buffer-content tracking for delete-button visibility: hasContent is updated on every scheduled edit (not just on day load), so the delete control appears/disappears responsively as text is typed or cleared, rather than lagging behind the ~1.2s autosave debounce."

key-files:
  created:
    - src/storage/dayIndex.ts
    - src/storage/dayIndex.test.ts
    - src/calendar/CalendarNav.tsx
    - src/storage/dayDelete.ts
  modified:
    - src/app/App.tsx
    - src/styles.css
    - src/hooks/flushController.ts
    - src/storage/flushController.test.ts

key-decisions:
  - "Mod-j keybinding: Cmd+J on macOS, Ctrl+J on Windows, toggling the calendar via a window-level keydown listener. Chosen (per RESEARCH.md's flagged assumption) because it collides with neither CodeMirror's default keymap nor common webview chrome bindings. Verified only on macOS this session — the Windows binding is an open UAT item (see Next Phase Readiness)."
  - "@tauri-apps/plugin-dialog confirm() signature confirmed directly from the installed type declarations (node_modules/@tauri-apps/plugin-dialog/dist-js/index.d.ts) before writing against it, per this task's read_first requirement: confirm(message: string, options?: string | ConfirmDialogOptions): Promise<boolean>, where ConfirmDialogOptions is { title?, kind?: 'info'|'warning'|'error', okLabel?, cancelLabel? }. RESEARCH.md's warning that most web results show the stale v1 '@tauri-apps/api/dialog' import was correct to flag — the actual v2 signature and import path were taken from the shipped types, not memory."
  - "Delete-button visibility tracks the live editor buffer (dayHasContent(text) recomputed on every scheduled edit) rather than only the state at day-load time — an implementation discretion within the task's 'visible only when the day has content' wording, chosen so the control reacts immediately to typing/clearing instead of lagging behind the debounce."
  - "flushController gained a fourth method, cancel() (Rule 2 deviation — see below), because deleting a day needs to discard a pending scheduled write without ever invoking save(), which none of schedule/flush/hasPending provided."

patterns-established:
  - "Pattern: any future destructive action that must survive a pending-write race follows the same confirm() → cancel() → mutate ordering established here — never cancel before the user affirmatively confirms."

requirements-completed: [NAV-01, NAV-02]

coverage:
  - id: D19
    description: "A calendar picker opens from both a visible affordance in the app chrome and a keyboard shortcut, so it is discoverable and fast (NAV-01, D-06)"
    requirement: "NAV-01"
    verification:
      - kind: unit
        ref: "grep -q 'icon-button' src/app/App.tsx (calendar button present) and grep -q 'metaKey || event.ctrlKey' src/app/App.tsx (Mod-j keydown registration present)"
        status: pass
      - kind: unit
        ref: "npx tsc --noEmit && npm run build"
        status: pass
    human_judgment: true
    rationale: "Requires visual/interactive confirmation of a running GUI app (clicking the button, pressing Cmd/Ctrl+J, confirming the popover actually opens) — deferred to end-of-phase UAT per workflow.human_verify_mode=end-of-phase."
  - id: D20
    description: "The calendar marks every day that has non-empty content with a dot, and leaves days with no entries unmarked, using a live scan of the journal folder (NAV-01, D-07)"
    requirement: "NAV-01"
    verification:
      - kind: unit
        ref: "node --test src/storage/dayIndex.test.ts (5/5 pass: blank-file produces no dot, non-file/non-day names ignored, empty directory yields empty set, a failed per-file read is skipped without failing the scan)"
        status: pass
      - kind: unit
        ref: "grep -q 'loadDaysWithContent' src/calendar/CalendarNav.tsx — the calendar rescans on every open, no cached index"
        status: pass
    human_judgment: true
    rationale: "The set-building logic (dayHasContent-gated, never file-existence-alone) is fully automated-pinned; confirming the dot actually renders under the correct day number in a running calendar requires the GUI — deferred to end-of-phase UAT."
  - id: D21
    description: "Selecting a day in the calendar flushes the current day's pending save first, then loads the selected day — a pending debounce can never land in the wrong day's file (WRITE-02, D-02)"
    requirement: "NAV-01"
    verification:
      - kind: unit
        ref: "code inspection — CalendarNav's onSelect prop is wired exclusively to App.tsx's handleCalendarSelect, which calls goToDay(date) and never sets currentDate directly; goToDay's flush-then-load ordering was already pinned under node --test in Plan 02"
        status: pass
    human_judgment: true
    rationale: "goToDay's own ordering guarantee is unit-tested (Plan 02); this plan's contribution is that the calendar has no second navigation path into currentDate, which is grep/code-verified. Confirming the on-disk file never receives cross-day text requires the running app — deferred to end-of-phase UAT."
  - id: D22
    description: "A past day opens in the same editor surface with the same typing, backspace, and autosave behaviour as today — there is no read-only mode and no separate per-entry delete action (NAV-02, D-08)"
    requirement: "NAV-02"
    verification:
      - kind: unit
        ref: "test -f src/calendar/CalendarNav.tsx && ! grep -nE \"readOnly|editable=\\{false\\}|disabled=\\{true\\}\" src/editor/EditorCanvas.tsx src/app/App.tsx"
        status: pass
    human_judgment: true
    rationale: "The absence of any read-only/disabled/non-editable prop for any date is grep-verified; confirming a past day actually types, backspaces, and autosaves identically to today requires the running app — deferred to end-of-phase UAT."
  - id: D23
    description: "Deleting an entire day's file asks for confirmation first, and only that action does; backspacing or selecting-and-deleting text inside a day never prompts (NAV-02, D-09)"
    requirement: "NAV-02"
    verification:
      - kind: unit
        ref: "[ \"$(grep -rl 'confirm(' src/ | wc -l | tr -d ' ')\" = \"1\" ] — exactly one confirmation call site in src/"
        status: pass
      - kind: unit
        ref: "grep -qE \"from ['\\\"]@tauri-apps/plugin-dialog['\\\"]\" src/app/App.tsx && ! grep -rqE \"@tauri-apps/api/dialog\" src/"
        status: pass
    human_judgment: true
    rationale: "The single-confirmation-site and correct-v2-import-path invariants are grep-verified; confirming the dialog appears only on the delete-day click and never on backspace/select-delete requires the running app — deferred to end-of-phase UAT."
  - id: D24
    description: "After a confirmed day deletion the file is gone from the journal folder and the calendar no longer marks that day"
    requirement: "NAV-02"
    verification:
      - kind: unit
        ref: "grep -q 'deleteDay' src/storage/dayDelete.ts && grep -q 'dayFilePath' src/storage/dayDelete.ts; test -f src/storage/dayFile.ts && ! grep -nE \"\\bremove\\(|unlink\" src/storage/dayFile.ts — dayDelete.ts is the only remove call site"
        status: pass
      - kind: unit
        ref: "node --test src/storage/ — flushController's new cancel() test proves a scheduled write never reaches save() once cancelled; dayFile.roundtrip.test.ts's existing write-skip test (Plan 02) proves saveDay never recreates a file with no content and no existing file"
        status: pass
    human_judgment: true
    rationale: "The code-level guarantees (single remove call site, cancel-before-delete ordering, write-skip on the cleared buffer) are unit-verified; confirming the file is actually gone from the real journal folder and the calendar's next open shows no dot requires the running app — deferred to end-of-phase UAT."
  - id: D25
    description: "The calendar is dismissible with Escape and returns focus to the editor, so the keyboard path never traps the user (NAV-01)"
    requirement: "NAV-01"
    verification:
      - kind: unit
        ref: "code inspection — CalendarNav registers a window keydown listener only while open that calls onClose() on Escape; App.tsx's closeCalendar, toggleCalendar (on close), and handleCalendarSelect all call focusEditor() via requestAnimationFrame after closing"
        status: pass
    human_judgment: true
    rationale: "The Escape-listener wiring and every focus-return call site are grep/code-verified; confirming the caret visibly reappears in the editor after pressing Escape requires the running app — deferred to end-of-phase UAT."

duration: 4min
completed: 2026-08-30
status: complete
---

# Phase 1 Plan 3: Calendar Navigation Summary

**Hand-rolled month-grid calendar with live content dots, a chrome button plus Cmd/Ctrl+J shortcut, and a confirmed whole-day delete gated by the one confirm() dialog in the app.**

## Performance

- **Duration:** 4 min (commit-to-commit span across this plan's 5 task commits, 11:11:02 to 11:14:31 local time; excludes upfront required-reading time)
- **Started:** 2026-08-30T15:11:02Z
- **Completed:** 2026-08-30T15:14:31Z
- **Tasks:** 2 (Task 1 TDD RED→GREEN plus a follow-on UI-wiring commit; Task 2 a Rule-2 dependency commit plus the feature commit)
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments

- Built the calendar's content-dot data source (`loadDaysWithContent`) as a pure `filterDaysWithContent(entries, readText)` core plus a thin Tauri-calling wrapper — the exact pure-core/thin-wrapper split Plan 02 established for `flushController.ts` — with 5 `node --test` cases proving a blank-but-existing file produces no dot, non-day filenames and directories are ignored, an empty directory yields an empty set, and a per-file read failure is skipped rather than failing the whole scan.
- Hand-rolled `CalendarNav` as a plain CSS grid over `date-fns` month math (no calendar/date-picker package installed, per RESEARCH.md's explicit "Don't Hand-Roll" call), opened by a chrome-row icon button and by Cmd+J/Ctrl+J, closed by Escape with focus always returned to the editor's `.cm-content`, and wired so day selection calls the existing `goToDay(date)` seam directly rather than adding a second navigation path.
- Added the one destructive action in the app: `deleteDay(date)` in a dedicated module (the only file-remove call site under `src/`), gated by a single `confirm()` from `@tauri-apps/plugin-dialog` — its exact v2 signature confirmed from the installed type declarations rather than assumed from a (likely stale, v1) web result — naming the exact date and defaulting to Cancel.
- Closed the one real correctness gap in the delete flow: added `flushController.cancel()` (Rule 2 deviation) so a debounced write already scheduled for a day can be discarded before that day's file is removed, and only after the user affirmatively confirms — never before, so a Cancel click leaves the pending save untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: Calendar picker with content dots, opened by button and keyboard shortcut** (TDD: RED → GREEN, no refactor commit needed)
   - `e0cfa54` (test) — failing test for `filterDaysWithContent`
   - `99b7a6b` (feat) — `loadDaysWithContent`/`filterDaysWithContent` implementation, GREEN
   - `baf65c3` (feat) — `CalendarNav.tsx`, chrome button, Mod-j keydown, Escape/focus wiring, calendar CSS
2. **Task 2: Delete an entire day, confirmed — and nothing else prompts**
   - `22a0418` (feat, Rule 2 deviation) — `flushController.cancel()` plus its own test
   - `37428f9` (feat) — `dayDelete.ts`, delete-button wiring in `App.tsx`, delete-button CSS

**Plan metadata:** commit hash recorded after this SUMMARY is written (see below).

## Files Created/Modified

- `src/storage/dayIndex.ts` - New: `loadDaysWithContent()` live journal-folder scan; `filterDaysWithContent(entries, readText)` pure filtering step
- `src/storage/dayIndex.test.ts` - New: 5 `node --test` cases pinning the filtering step's behavior
- `src/calendar/CalendarNav.tsx` - New: hand-rolled month-grid calendar component (`date-fns` math, no new dependency)
- `src/storage/dayDelete.ts` - New: `deleteDay(date)`, the only file-remove call site under `src/`
- `src/app/App.tsx` - Adds calendar state/toggle/Mod-j/Escape-focus wiring, the calendar and delete buttons in the chrome row, `handleCalendarSelect`, `handleDeleteDay`
- `src/styles.css` - Adds chrome-row/icon-button/calendar-popover/calendar-grid/delete-button styles, all from existing `--surface`/`--border`/`--fg`/`--muted`/`--accent`/`--selection`/`--bg` custom properties
- `src/hooks/flushController.ts` - Adds `cancel()` to the `FlushController` interface and its closure implementation
- `src/storage/flushController.test.ts` - Adds one `node --test` case pinning `cancel()`'s contract

## Decisions Made

- Mod-j keybinding (Cmd+J macOS / Ctrl+J Windows) — see key-decisions above; macOS-verified only, Windows carried to UAT.
- `@tauri-apps/plugin-dialog` `confirm()` signature — confirmed from installed type declarations before writing against it, per this task's own `read_first` requirement.
- Delete-button visibility tracks the live buffer rather than only the loaded-file state — see key-decisions above.
- `flushController.cancel()` added (Rule 2) — see Deviations below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] `flushController` had no way to discard a pending write without invoking save**
- **Found during:** Task 2, implementing `handleDeleteDay`
- **Issue:** The plan's action text requires "before calling `deleteDay`, clear any pending save for that date" — but `flushController.ts` (Plan 01/02) only exposed `schedule`/`flush`/`hasPending`. `flush()` would *invoke* save with the pending text (writing the file the delete is about to remove), which is the opposite of "clear." Without a true no-op cancel, a debounce timer scheduled just before a confirmed delete could fire afterward and resurrect the file with stale text.
- **Fix:** Added `cancel()` to `FlushController`: clears the pending timer and pending text without ever calling `save()`. Does not touch a write already in flight (that write's own promise settles normally) — a narrower, accepted-risk edge case noted in Next Phase Readiness below. Called only after the user affirmatively confirms the delete dialog, never before (a Cancel click must leave the pending write untouched, per D-09).
- **Files modified:** `src/hooks/flushController.ts`, `src/storage/flushController.test.ts`
- **Verification:** `node --test 'src/storage/**/*.test.ts'` — 29/29 pass, including the new cancel() test; `npx tsc --noEmit` and `npm run build` pass.
- **Commit:** `22a0418`

---

**Total deviations:** 1 auto-fixed (Rule 2 missing-critical-functionality).
**Impact on plan:** Adds one method to an existing Plan 01/02 module; does not change the plan's architecture, storage format, or capability surface. No re-planning needed.

## Issues Encountered

None beyond the one deviation above. One accepted, narrow edge case is worth flagging explicitly rather than silently leaving undocumented: if a debounced write is already *in flight* (not merely pending/scheduled) at the exact moment a delete is confirmed, `cancel()` does not abort that in-flight write, so it could complete and briefly recreate the file microseconds before `deleteDay()` removes it again. Given the 1200ms debounce plus the time a user takes to read and click a native confirm dialog, this window is vanishingly small and not something this plan's explicit scope ("clear any pending save") asked for — the plan only required handling the *pending* (not-yet-started) case, which is fully handled. Flagged here rather than fixed, consistent with this phase's treatment of `writeTextFile`'s undocumented atomicity gap (T-01-12-style accepted risk) — revisit only if real usage surfaces it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **01-04 (CI build matrix)** is unaffected by this plan's changes; no new dependency was installed (`package.json` diff-checked as empty across this plan's commits), so the build matrix's dependency set from Plan 01 remains accurate.
- **Phase 3 (search)** can call `goToDay(next: Date)` from `App.tsx` for its "click a result, jump to that day" requirement, unchanged from Plan 02's contract — this plan added no second navigation path, by construction (`CalendarNav`'s `onSelect` always routes through `goToDay`).
- No blockers. Two items are carried forward to end-of-phase UAT, both macOS-only limitations of this session (consistent with Plans 01/02's own carried-forward Windows items):
  - The Mod-j keybinding (Cmd+J / Ctrl+J) was implemented per the OS-branching logic (`event.metaKey || event.ctrlKey`) but only exercised on macOS this session — Windows behavior (including any potential collision with a Windows-specific webview/chrome shortcut) is unverified.
  - `@tauri-apps/plugin-dialog`'s native `confirm()` dialog styling/behavior on Windows (versus the macOS-native dialog actually seen this session) is unverified.
- All GUI-visual `<human-check>` items from both tasks (calendar open/dot/navigate/escape-focus interaction; backspace-doesn't-prompt, delete-confirms-and-clears, dot-disappears, retyping-recreates-the-file interaction) are deferred to end-of-phase UAT per `workflow.human_verify_mode=end-of-phase` — see the `coverage` block's `human_judgment: true` entries (D19-D25) for the exact walkthrough steps, mirroring both tasks' `<human-check>` text verbatim.
- This is the last plan in Phase 1's plan sequence for calendar/delete (01-04's CI/packaging plan remains). Once 01-04 lands, Phase 1's full success-criteria set (blank canvas, durable autosave, calendar navigation, cross-platform packaging) is ready for the phase's own end-to-end UAT pass before transitioning to Phase 2 (tag pills).

## Self-Check: PASSED

All 8 created/modified files listed in `key-files` were verified present on disk (`dayIndex.ts`, `dayIndex.test.ts`, `CalendarNav.tsx`, `dayDelete.ts`, `App.tsx`, `styles.css`, `flushController.ts`, `flushController.test.ts`), and all 5 task commit hashes (`e0cfa54`, `99b7a6b`, `baf65c3`, `22a0418`, `37428f9`) were verified present in `git log --oneline --all`.

---
*Phase: 01-reliable-daily-writing-navigation*
*Completed: 2026-08-30*
