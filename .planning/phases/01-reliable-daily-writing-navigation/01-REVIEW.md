---
phase: 01-reliable-daily-writing-navigation
reviewed: 2026-08-30T00:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - .github/workflows/build.yml
  - .gitignore
  - README.md
  - index.html
  - package.json
  - src-tauri/Cargo.toml
  - src-tauri/capabilities/default.json
  - src-tauri/src/lib.rs
  - src-tauri/tauri.conf.json
  - src/app/App.tsx
  - src/calendar/CalendarNav.tsx
  - src/editor/EditorCanvas.tsx
  - src/hooks/flushController.ts
  - src/hooks/useDebouncedFlush.ts
  - src/main.tsx
  - src/storage/dayDelete.ts
  - src/storage/dayFile.roundtrip.test.ts
  - src/storage/dayFile.ts
  - src/storage/dayIndex.test.ts
  - src/storage/dayIndex.ts
  - src/storage/dayPath.test.ts
  - src/storage/dayPath.ts
  - src/storage/flushController.test.ts
  - src/storage/journalDir.ts
  - src/styles.css
  - tsconfig.json
  - vite.config.ts
findings:
  critical: 4
  warning: 5
  info: 2
  total: 11
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-08-30T00:00:00Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

The path-construction layer (`dayPath.ts`, `journalDir.ts`, `dayDelete.ts`) is genuinely solid: every filesystem call is built from a validated `Date` via `dayFilePath()`, the directory-listing parser only accepts an anchored `YYYY-MM-DD.md` shape, and the Tauri capability file scopes every fs permission to `$APPDATA/journal`. No path-traversal vector was found.

The write-serialization core (`flushController.ts`) and its two call sites (`App.tsx`'s day-navigation and window-close handling, and the delete-day flow) are where the real problems are. Tracing the actual control flow — not just the happy path the unit tests cover — turns up four distinct, concretely-reproducible ways the app can lose or misdirect a user's text, which directly contradicts the "never lose a keystroke" core value this file is supposed to guarantee. None of these require a hostile input; three of the four reproduce under entirely ordinary usage (typing quickly after opening the calendar, double-pressing quit, deleting a day right as an autosave lands).

## Critical Issues

### CR-01: A rejected save clobbers newer text scheduled while it was in flight

**File:** `src/hooks/flushController.ts:35-50`
**Issue:** `runSave(text)` closes over the `text` argument it was called with. If that save rejects, its catch handler unconditionally does `pending = text;` — even if a newer `schedule()` call already replaced `pending` with fresher content while the failed save was still in flight. Sequence that loses data:
1. `schedule("v1")` → debounce timer fires → `runSave("v1")` starts.
2. While `save("v1")` is still pending, the user keeps typing → `schedule("v2")` sets `pending = "v2"`.
3. `save("v1")` rejects (e.g. a transient disk error). The catch handler runs `pending = text` — `text` is `"v1"` — silently overwriting `pending` back to the stale `"v1"`, discarding `"v2"`.
4. If no further keystroke occurs before the next flush (window close, blur, day switch), that flush persists the stale `"v1"`, and everything the user typed in step 2 is gone with zero error surfaced.

This is the opposite of the doc comment's stated intent ("Keep the text pending so the next flush retries it, rather than silently dropping the user's words") — it silently drops the *newer* words instead.
**Fix:**
```ts
save(text).catch((err: unknown) => {
  // Only restore the failed text if nothing newer has been scheduled
  // since this save started — otherwise this clobbers fresher edits
  // with a stale snapshot.
  if (pending === null) {
    pending = text;
  }
  throw err;
}),
```

### CR-02: Text typed during the day-navigation flush→load gap is silently discarded (and can be mis-saved to the new day's file)

**File:** `src/app/App.tsx:135-154`, `src/editor/EditorCanvas.tsx:76-91`
**Issue:** `goToDay` is: `await flush()` → `await loadDay(next)` → `setCurrentDate(next); setInitialText(text)`. Nothing disables or blurs the editor during this async window. `handleCalendarSelect` (App.tsx:158-165) explicitly refocuses the editor via `requestAnimationFrame(() => focusEditor())` *immediately* after closing the calendar — well before `loadDay(next)`'s disk read resolves. `EditorCanvas` still renders with the **old** day's `initialText`/`value` at this point (its `date` prop is accepted but never read — see IN-02), so a fast typist can type real characters into the editor for the day that is in the process of being navigated away from.
When `loadDay(next)` finally resolves, `setInitialText(text)` unconditionally replaces the CodeMirror `value` with the newly-loaded day's on-disk content, silently discarding whatever the user typed in the gap — with no warning, no merge, and no recovery path. Depending on the CodeMirror React wrapper's internal value-sync behavior, the pre-overwrite keystrokes may also have already gone through `onScheduleSave` → `schedule()` while `saveRef` still targeted the *old* day, and could be flushed to the **wrong file** if a flush lands before the corrective re-sync (this part depends on `@uiw/react-codemirror` internals and should be verified, but the keystroke-loss itself is directly provable from this code alone).
**Fix:** Make the editor non-interactive for the duration of the navigation:
```ts
// App.tsx
const [navigating, setNavigating] = useState(false);
const goToDay = useCallback(async (next: Date) => {
  setNavigating(true);
  try {
    await flush();
  } catch (err) { ...; return; } finally { /* only clear after load below */ }
  try {
    const text = await loadDay(next);
    setCurrentDate(next);
    setInitialText(text);
    ...
  } finally {
    setNavigating(false);
  }
}, [flush]);
// <EditorCanvas ... readOnly={navigating} />
```
Pass `readOnly`/`editable={false}` into `basicSetup`/`CodeMirror` while `navigating` is true. Also consider `key={dayFileName(currentDate)}` on `<EditorCanvas>` so each day gets a fresh editor instance rather than a value-diffed reuse of the same one (defense in depth, not a full fix by itself).

### CR-03: A second close request destroys the window before the first flush finishes

**File:** `src/app/App.tsx:214-244`
**Issue:**
```ts
void win.onCloseRequested(async (event) => {
  event.preventDefault();
  if (closingRef.current) {
    await win.destroy();
    return;
  }
  closingRef.current = true;
  try {
    await flush();
  } finally {
    await win.destroy();
  }
});
```
On re-entry (a second close signal arriving while the first flush is still in flight — realistic for a double Cmd+Q/Alt+F4, or an OS logout sending the close event twice), the handler skips straight to `win.destroy()` without waiting for the first flush's write to finish. If that write is still mid-`writeTextFile` when the process is torn down, the save can be interrupted, risking a truncated or lost write — exactly the durability guarantee this file's own comments claim to provide ("so a rejected flush can never leave the app unquittable" only addresses failure, not a second concurrent close request).
**Fix:** Track the in-flight flush and await it on re-entry instead of skipping it:
```ts
const closingRef = useRef(false);
const flushPromiseRef = useRef<Promise<void> | null>(null);
...
void win.onCloseRequested(async (event) => {
  event.preventDefault();
  if (closingRef.current) {
    await flushPromiseRef.current;
    await win.destroy();
    return;
  }
  closingRef.current = true;
  flushPromiseRef.current = flush();
  try {
    await flushPromiseRef.current;
  } finally {
    await win.destroy();
  }
});
```

### CR-04: `deleteDay` doesn't wait for a write that's already in flight, so the deleted file can be resurrected

**File:** `src/app/App.tsx:175-206`, `src/hooks/flushController.ts:80-93`
**Issue:** `handleDeleteDay` calls `cancel()` then `deleteDay(currentDate)`. The surrounding comment states this is to stop "a save scheduled just before the click" from firing after deletion and resurrecting the file. But `cancel()`'s own doc comment says exactly the opposite of full coverage: *"Does not touch a write already in flight; that write's own promise settles normally."* If the debounce timer had already fired and `writeTextFile` was actively running at the moment the user confirms the delete dialog, `cancel()` clears only the (already-empty) `pending`/`timer` state — it does nothing to the in-flight write. `deleteDay()` then removes the file immediately; when the in-flight write completes afterward, it recreates the just-deleted file with the stale pre-delete content. This is precisely the "silently resurrect the file" scenario the comment says `cancel()` prevents, and it doesn't, for this specific (narrow but real) timing window.
**Fix:** Wait for any in-flight write to settle before deleting, e.g. replace `cancel()` with `await flush()` (once CR-01 is fixed, `flush()` is safe to call here — it will finish writing whatever was pending/in-flight, and only then does `deleteDay` run, so no write can land after the delete):
```ts
cancel(); // still needed to stop a *scheduled* write from starting new
try {
  await flush(); // now also waits out anything already in flight
} catch {
  // a failed flush here just means nothing new landed on disk; proceed to delete regardless
}
try {
  await deleteDay(currentDate);
} catch (err) { ... }
```
(Or add an explicit `waitForInFlight()` method to `FlushController` if re-triggering a write before delete is considered wasteful.)

## Warnings

### WR-01: Inline handler props defeat `EditorCanvas`'s extension memoization

**File:** `src/app/App.tsx:280-289`, `src/editor/EditorCanvas.tsx:58-74`
**Issue:** `App.tsx` passes `onScheduleSave`/`onFlush` as inline arrow functions defined directly in JSX. These get a new identity on every `App` render — and `App` re-renders on every keystroke (`onScheduleSave` itself calls `setHasContent`/`setError`). `EditorCanvas`'s `behaviorExtensions` is `useMemo(() => [...], [onScheduleSave, onFlush])`, so the memo is invalidated every render, producing a new `extensions` array reference on every keystroke, which `@uiw/react-codemirror` will reconfigure via its extensions-diffing effect. The `useMemo` here gives the false impression of a stable extension set.
**Fix:** Wrap the handlers passed into `<EditorCanvas>` in `useCallback` in `App.tsx` so their identity is stable across renders that don't actually change their captured dependencies.

### WR-02: Close-time flush failure is an unhandled rejection with no user-visible feedback

**File:** `src/app/App.tsx:219-232`
**Issue:** `try { await flush(); } finally { await win.destroy(); }` has no `catch`. If `flush()` genuinely rejects (pending text existed and the save failed), the `finally` still runs and the window is destroyed — correctly not leaving the app unquittable — but the rejection then propagates out of the async `onCloseRequested` callback unhandled, and the user is given no indication whatsoever that their last edit failed to save before the app exited.
**Fix:**
```ts
try {
  await flush();
} catch (err) {
  console.error("Flush failed on quit; last edit may not be saved", err);
} finally {
  await win.destroy();
}
```
Consider also surfacing this via `@tauri-apps/plugin-dialog`'s `message()` before destroying, since data loss on quit is exactly what this file exists to prevent.

### WR-03: A failed calendar-dot scan is indistinguishable from "no days have content"

**File:** `src/calendar/CalendarNav.tsx:46-52`
**Issue:** `loadDaysWithContent().catch(() => setDaysWithContent(new Set()))` silently swallows any scan failure (e.g. a permissions error reading the journal directory) and renders the calendar as if no day has any content. There is no `console.error`, no `error` state, nothing to distinguish a real scan failure from a genuinely empty journal.
**Fix:** At minimum log the error for diagnosability; consider reusing `App.tsx`'s existing `error` state/prop pattern so a scan failure is surfaced the same way a save/load failure already is.

### WR-04: `fs:default` is granted alongside five explicitly-scoped fs permissions that already cover every operation the app performs

**File:** `src-tauri/capabilities/default.json:6-9`
**Issue:** The file's own `description` states "scoped to the journal subfolder only," and the five explicit permission objects below (`allow-read-text-file`, `allow-write-text-file`, `allow-mkdir`, `allow-read-dir`, `allow-remove`) already cover exactly what `dayFile.ts`, `dayIndex.ts`, `dayDelete.ts`, and `journalDir.ts` call. Including the blanket `"fs:default"` permission set on top is redundant for the app's actual needs and risks granting whatever baseline filesystem capabilities Tauri's fs plugin bundles into its default set (which may include commands or scope not limited to `$APPDATA/journal`), undermining the least-privilege posture this file is trying to document.
**Fix:** Remove `"fs:default"` and verify the app still functions with only the five explicitly-scoped permission objects (plus `core:default`/`dialog:default`, which are unrelated to filesystem scope). If some specific default-set permission turns out to be required, add it individually with its own scope rather than pulling in the whole set.

### WR-05: CI builds installers but never runs the project's test suite

**File:** `.github/workflows/build.yml` (entire file), `package.json:6-11`
**Issue:** Four `node --test` suites exist (`dayFile.roundtrip.test.ts`, `dayIndex.test.ts`, `dayPath.test.ts`, `flushController.test.ts`) and are repeatedly referenced in code comments as "this plan's verify gate." `build.yml` only checks out, installs, and builds installers for both platforms — it never invokes `node --test` or any test script. `package.json`'s `scripts` block has no `"test"` entry at all, so there isn't even a documented one-liner to run them locally, let alone in CI. A regression in path validation, byte-fidelity round-tripping, or write-serialization correctness could ship in a release build without ever failing CI.
**Fix:**
```json
// package.json
"scripts": {
  "test": "node --test src/storage",
  ...
}
```
```yaml
# build.yml, before the platform-specific build steps
- name: Run tests
  run: npm test
```

## Info

### IN-01: `dayFromFileName` accepts calendar-invalid dates that then become permanently un-navigable

**File:** `src/storage/dayPath.ts:16,44-47`
**Issue:** `DAY_FILENAME_PATTERN` (`/^(\d{4}-\d{2}-\d{2})\.md$/`) validates shape only, not calendar validity — `"2026-13-40.md"` matches. Since these are documented (README) as plain files a user can create/rename with any external tool, such a file would be picked up by `loadDaysWithContent()` and added to the content set, but would never match `format(day, "yyyy-MM-dd")` for any real day rendered by `CalendarNav`, so it can never get a dot or be opened via the calendar UI. Not a crash risk, just a silently-orphaned file.
**Fix:** Optional — could validate against `date-fns`'s `isValid(parse(...))` if this edge case is worth closing, but low priority given how it would have to be created (manual file rename outside the app).

### IN-02: `EditorCanvas`'s `date` prop is accepted but never used

**File:** `src/editor/EditorCanvas.tsx:13-19`
**Issue:** The component's prop type declares `date: Date`, and `App.tsx:278` passes `date={currentDate}`, but the destructure on line 19 (`const { initialText, onScheduleSave, onFlush } = props;`) never reads it. It's dead as far as the component body is concerned. As noted in CR-02, using this value as a React `key` would at least make day-boundary component identity explicit rather than implicit in `initialText`'s value.
**Fix:** Either remove the unused prop, or put it to use (e.g. as a `key` on the consuming `<EditorCanvas>` element, or to gate `readOnly` per CR-02's fix).

---

_Reviewed: 2026-08-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
