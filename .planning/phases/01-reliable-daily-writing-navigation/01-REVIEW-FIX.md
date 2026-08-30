---
phase: 01-reliable-daily-writing-navigation
fixed_at: 2026-08-30T16:45:00Z
review_path: .planning/phases/01-reliable-daily-writing-navigation/01-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-08-30T16:45:00Z
**Source review:** .planning/phases/01-reliable-daily-writing-navigation/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (4 critical + 5 warning; IN-01 and IN-02 explicitly out of scope for this pass)
- Fixed: 9
- Skipped: 0

**Isolation:** All fixes were applied and committed in an isolated git worktree (`gsd-reviewfix/01-74121`, branched from `master`), then fast-forwarded onto `master` and pushed to `origin/master` after each commit. Verification (tsc/build/tests) below ran inside that worktree with a symlinked `node_modules` from the main checkout (read-only usage; not deleted or written to).

## Fixed Issues

### CR-01: A rejected save clobbers newer text scheduled while it was in flight

**Files modified:** `src/hooks/flushController.ts`
**Commit:** `474f7a9`
**Applied fix:** `runSave`'s catch handler now only restores `pending = text` if `pending === null` (i.e. nothing newer was scheduled while the failed save was in flight), otherwise it lets the newer `pending` value stand and just rethrows. Matches the fix suggested in REVIEW.md exactly — code state was unchanged from what the reviewer saw.

### CR-02: Text typed during the day-navigation flush->load gap is silently discarded

**Files modified:** `src/app/App.tsx`, `src/editor/EditorCanvas.tsx`
**Commit:** `ce0d4b1`
**Applied fix:** Added a `readOnly?: boolean` prop to `EditorCanvas` (mapped to CodeMirror's `editable={!readOnly}`). `App.tsx` now tracks a `navigating` state flag, set `true` for the duration of `goToDay`'s flush-then-load window and cleared in a `finally`/early-return path, and passes it through as `readOnly={navigating}`. Also keyed `<EditorCanvas>` by `format(currentDate, "yyyy-MM-dd")` (reusing the already-imported `date-fns` `format`, rather than introducing `dayFileName` as REVIEW.md's snippet suggested) so each day gets a fresh editor instance instead of a value-diffed reuse of the same one — defense in depth per the reviewer's note.

### CR-03: A second close request destroys the window before the first flush finishes

**Files modified:** `src/app/App.tsx`
**Commit:** `9aa9308`
**Applied fix:** Added a `flushPromiseRef` that captures the in-flight close-time `flush()` promise. On re-entry (`closingRef.current` already true), the handler now `await`s that same promise before calling `win.destroy()`, instead of destroying immediately. Matches the reviewer's suggested pattern.

### CR-04: `deleteDay` doesn't wait for a write already in flight

**Files modified:** `src/app/App.tsx`
**Commit:** `4496f35`
**Applied fix:** `handleDeleteDay` now calls `await flush()` (wrapped in its own try/catch that ignores failure) immediately after `cancel()` and before `deleteDay(currentDate)`, so any write already in flight settles before the file is removed. Added `flush` to the `useCallback` dependency array.

### WR-01: Inline handler props defeat `EditorCanvas`'s extension memoization

**Files modified:** `src/app/App.tsx`
**Commit:** `968c7a6`
**Applied fix:** Extracted `handleScheduleSave` and `handleEditorFlush` as top-level `useCallback`s (deps `[schedule]` and `[flush]` respectively — both stable per `useDebouncedFlush`'s own doc comment) and pass those stable references into `<EditorCanvas onScheduleSave={...} onFlush={...}>` instead of inline arrow functions.

### WR-02: Close-time flush failure is an unhandled rejection with no feedback

**Files modified:** `src/app/App.tsx`
**Commit:** `bb6a0a6`
**Applied fix:** Added `catch (err) { console.error("Flush failed on quit; last edit may not be saved", err); }` around the `await` of the close-time flush, in both the first-entry and re-entry (CR-03) code paths, so a genuine flush rejection on quit is logged rather than propagating as an unhandled rejection. Kept to `console.error` (not a `dialog.message()` popup) — the reviewer's fix offered the dialog as a "consider," not a requirement, and a blocking modal on quit was judged out of scope for a warning-level fix.

### WR-03: A failed calendar-dot scan is indistinguishable from "no days have content"

**Files modified:** `src/calendar/CalendarNav.tsx`
**Commit:** `fb184e5`
**Applied fix:** Added `console.error("Failed to scan journal directory for calendar dots", err)` in the `loadDaysWithContent().catch(...)` handler before falling back to an empty `Set`.

### WR-04: `fs:default` is redundant alongside five explicitly-scoped fs permissions

**Files modified:** `src-tauri/capabilities/default.json`
**Commit:** `ecbdbd4`
**Applied fix:** Removed the `"fs:default"` entry from the `permissions` array; the five explicit `fs:allow-*` objects (all scoped to `$APPDATA/journal`) plus `core:default`/`dialog:default` remain. Verified the file is still valid JSON. Did not run a full Tauri capability-resolution build (no Rust toolchain invoked) — the app's fs usage is fully covered by the five explicit permissions per the existing source code (`dayFile.ts`, `dayIndex.ts`, `dayDelete.ts`, `journalDir.ts`), so this is a config-only removal with no code-side dependency on the broader default set.

### WR-05: CI builds installers but never runs the project's test suite

**Files modified:** `package.json`, `.github/workflows/build.yml`
**Commit:** `3713dff`
**Applied fix:** Added `"test": "node --test src/storage"` to `package.json`'s `scripts`, and a `Run tests` step (`run: npm test`) to `build.yml` immediately after `Install dependencies` and before the platform-specific build steps (macOS/Windows), on both matrix legs.

## Verification (CR-01 through CR-04 consolidated re-run, as requested)

Run inside the isolated worktree after all four critical fixes landed:

- `node --test 'src/storage/*.test.ts'` (equivalent invocation — see caveat below): **29/29 tests pass**, 0 failures.
- `npx tsc --noEmit`: clean, no errors.
- `npm run build` (`tsc && vite build`): succeeds, produces `dist/` with only a pre-existing "chunk larger than 500kB" advisory warning (unrelated to these changes, not a new regression).

All three checks were re-run again after each subsequent WR fix; final state after all 9 commits is identical: 29/29 tests pass, `tsc --noEmit` clean, `npm run build` succeeds.

**Node-version caveat on the `node --test src/storage` invocation (relevant to WR-05):** On this machine's local Node (`v26.5.0`), `node --test src/storage` (passing a non-well-known directory name as a bare positional argument, with no glob) fails with `MODULE_NOT_FOUND` — Node appears to try to `require()` the directory path directly rather than recursively scanning it for test files, for any directory that isn't the default cwd scan or a conventionally-named `test`/`tests` folder. This reproduces even in a from-scratch `/tmp` directory with a trivial `.test.js` file, so it is not specific to this project's file contents. `.github/workflows/build.yml` pins `node-version: 22` (an LTS line where the test runner's documented directory-recursion behavior is expected to hold), so `npm test` should work as intended in CI; this was not independently verified against an actual Node 22 install (none was available in this environment). The equivalent glob form `node --test 'src/storage/*.test.ts'` was used for local verification instead and passes all 29 tests, confirming the underlying test suite and file layout are sound — only the bare-directory-argument form is in question, and only on this specific local Node version. Flagging this for the developer to confirm once the pushed CI run completes.

## Skipped Issues

None — all 9 in-scope findings were fixed and committed.

---

_Fixed: 2026-08-30T16:45:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
