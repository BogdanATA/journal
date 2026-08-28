# Pitfalls Research

**Domain:** Cross-platform desktop journaling app (Electron/Tauri) with custom inline tag pills, ghost-text autocomplete, plain-text-file storage, and fuzzy tag search
**Researched:** 2026-08-28
**Confidence:** MEDIUM (cross-checked web sources; no official framework docs consulted directly in this pass — recommend Context7 lookups on chosen editor library during Stack/Architecture phases)

## Critical Pitfalls

### Pitfall 1: Debounced autosave races overwrite newer keystrokes with stale content

**What goes wrong:**
Two autosave writes fire close together (e.g., user types, pauses, types again before the first save's promise resolves). The first (older) save resolves after the second, and its stale content wins the write, silently reverting recently typed text. This is the single most-reported class of bug in autosave implementations.

**Why it happens:**
Debouncing controls *when* a save is triggered, not the *order* in which in-flight writes complete. Developers assume "last triggered = last written" but async I/O and OS-level buffering don't guarantee that ordering, especially if a save is slow (large file, disk contention, antivirus scan).

**How to avoid:**
- Serialize writes per file through a single FIFO queue (one in-flight write at a time; newer content supersedes queued-but-not-started writes rather than running both).
- Always save the *current* editor buffer content read at write-time, not content captured when the debounce timer was set.
- Version/sequence-tag each save request; discard a completed write's result if a newer sequence number has already been queued.

**Warning signs:**
- Rapid typing followed by a brief pause occasionally "loses" the last sentence typed.
- Bug reports that only reproduce under fast typing or on slower disks (network drives, Windows with real-time antivirus).

**Phase to address:**
Core writer/autosave phase (before any UI polish). This is foundational plumbing — must be correct before building the editor UI on top of it, since editor phases will assume saves are reliable.

---

### Pitfall 2: Non-atomic writes corrupt or truncate the journal file on crash or power loss

**What goes wrong:**
Writing directly to the day's file (`fs.writeFile(path, content)`) truncates the file first, then streams new bytes. If the app crashes, the OS kills the process, or power is lost mid-write, the file is left empty or half-written — permanently destroying a day's entries with no recovery path (this is the user's *only* copy of the data, per the plain-text/no-cloud constraint).

**Why it happens:**
Direct in-place writes are the naive/default approach in every language's file API, and they "work" in every manual test because crashes during the ~1-5ms write window are rare in testing but not rare in aggregate across real usage (laptop sleep interruptions, forced quits, OS updates).

**How to avoid:**
- Use the write-temp-then-rename pattern: write full new content to `<file>.tmp` (or a hidden temp file) in the same directory, `fsync` it, then atomically rename over the target file. POSIX `rename()` is atomic; on Windows use `MoveFileEx` with `MOVEFILE_REPLACE_EXISTING` (or `ReplaceFile` for better crash semantics) since plain rename-over-existing-file has historically been less safe on Windows.
- Because this app has exactly one writer process, cross-process write coordination is not needed — but ensure the app itself never has two concurrent save operations targeting the same file (see Pitfall 1).
- Consider writing a `.bak` of the previous good version before replacing, or keeping the last N autosave snapshots, to give users a recovery path if a save writes garbage due to an application-level bug (not just an OS crash).

**Warning signs:**
- QA only tests "normal" save/quit flows; no test simulates killing the process mid-save (`kill -9`, Task Manager "End Task", forced laptop shutdown).
- File corruption reports that correlate with OS sleep/wake or forced quits.

**Phase to address:**
Core writer/autosave phase. This is the single highest-severity pitfall for this project given the "plain text files as source of truth, no cloud backup" constraint — a corrupted file is unrecoverable data loss for the user.

---

### Pitfall 3: File watcher reacts to the app's own writes, causing reload loops or clobbering in-progress edits

**What goes wrong:**
If the app watches the journal directory for external edits (e.g., user opens the file in another editor) using something like chokidar, and doesn't distinguish its own writes from external ones, it can: (a) reload the buffer from disk right after its own save, wiping unsaved keystrokes typed during the save; or (b) enter a save→detect-change→reload→save loop.

**Why it happens:**
File watchers fire on any write to the path, including the app's own atomic-rename saves. Developers often add file watching later (to support "edit in another app" or multi-window scenarios) without accounting for self-triggered events.

**How to avoid:**
- Track the mtime/hash of the last content the app itself wrote; ignore watcher events that match it.
- Use chokidar's `atomic` option and `awaitWriteFinish` (stabilityThreshold ~1-2s) to avoid reacting to partial writes.
- Simplest for v1: only watch for external changes when the file is *not* the one currently being actively edited/autosaved, or skip file-watching entirely for v1 and only load from disk on explicit day-navigation (defer "detect external edit" to a later milestone).

**Warning signs:**
- Cursor jumps or content flickers right after autosave fires.
- Rapid alternating disk-write events visible in file watcher logs.

**Phase to address:**
Only relevant if a "reload on external change" feature is built. Recommend explicitly deferring this feature out of MVP scope; note it as a known trap if added later.

---

### Pitfall 4: Custom inline tag-pill decorations desync from the underlying plain text, breaking cursor position, undo/redo, or copy-paste

**What goes wrong:**
Rendering `#tag` as a styled "pill" (typically a non-editable inline span or widget overlaid on/replacing the raw text) is one of the highest-risk UI features in this project. Common failures: cursor disappears or jumps to the wrong position when adjacent to a pill (especially in Safari/Chrome with `contenteditable=false` spans); typing immediately before/after a pill inserts text inside the pill instead of beside it; copy-paste yields the wrong text (styled HTML fragments, duplicated characters, or missing `#`); undo/redo desyncs — undoing removes the pill's visual wrapper but leaves stray characters, or redo re-renders a stale pill.

**Why it happens:**
Contenteditable/DOM-based decoration is notoriously inconsistent across browsers for elements that are visually inline but have different editability than surrounding text. Every major editor framework (ProseMirror, Quill, CKEditor) has open, long-standing issues specifically about cursor placement next to non-editable inline nodes at line boundaries. Developers who build pills as raw DOM manipulation (rather than through an editor framework's decoration/widget API with a proper document model) run into this fastest because there's no single source of truth for "what is the real plain text" vs. "what is rendered."

**How to avoid:**
- Use an editor framework with a real document model that separates the source-of-truth text/state from its rendered decoration (e.g., CodeMirror 6's `Decoration`/`RangeSet` API, or ProseMirror's mark/decoration system) rather than hand-rolling contenteditable DOM manipulation. The plain text (`#thought`) should always be the actual underlying content; the pill is purely a rendering decoration layered on top, never a replacement node that could diverge from the text.
- Never make the tag text itself a non-editable atomic node if it can be avoided — style the span as a decoration/mark on real editable text, so typing, backspace, and cursor movement behave like normal text; only add pill chrome (background, padding, border-radius) via CSS/decoration, not via `contenteditable=false`.
- Test copy-paste roundtrip explicitly: copy a tagged entry, paste into a plain text editor, verify it comes out as the exact original plain text (no smart quotes, no duplicated `#`, no lost characters).
- Test undo/redo explicitly across pill boundaries: type a tag, let it render as a pill, undo character-by-character back through the pill, redo forward — verify text and pill state stay consistent at every step.

**Warning signs:**
- Cursor "hops" or becomes invisible when arrow-keying across a tag pill.
- Backspace at a pill boundary deletes the wrong number of characters or leaves orphaned `#`.
- Copy-pasted text differs from what was visually selected.
- Undo history shows visual/text mismatches after a handful of undo steps near a tag.

**Phase to address:**
Editor core phase (before autocomplete/search are layered on). This should be its own focused phase with explicit UAT covering cursor, undo/redo, and copy-paste — do not bundle it with the ghost-text autocomplete phase, since debugging both novel interaction systems simultaneously multiplies failure surface.

---

### Pitfall 5: Ghost-text Tab-to-accept autocomplete fights native Tab behavior (indentation/focus) and interrupts normal typing flow

**What goes wrong:**
Tab is heavily overloaded: browsers/OSes use it for focus movement between controls, many editors use it for indentation, and screen-reader/keyboard-only users rely on it to escape the editing region entirely. Implementing "Tab accepts the ghost-text suggestion" without carefully scoping when that binding is active can: trap keyboard focus inside the editor (a known accessibility failure mode seen in rich-text editors and Ace/Monaco-style embeds); silently swallow Tab when no suggestion is showing (breaking expected focus-navigation or indent behavior); or accept a suggestion the user didn't intend because ghost text was still visible from a stale keystroke.

**Why it happens:**
Developers copy the "accept on Tab" pattern from Copilot-style tools without replicating the surrounding state machine: Tab should only be intercepted when a suggestion is *actively displayed and current* (i.e., matches the text right before the cursor); it must fall through to default behavior in every other case. Getting this state machine subtly wrong is the most common cause of both "ghost text swallowed my Tab" and "ghost text is stuck / re-appears after I already dismissed it" bug reports in editor implementations (documented in Monaco/VS Code issue trackers).

**How to avoid:**
- Only bind the Tab handler when a suggestion is currently rendered *and* the cursor is still immediately after the point where it was generated (any cursor move, keystroke other than continued matching characters, or space should immediately clear/hide the ghost text per this project's explicit non-forcing requirement).
- If Tab has no active suggestion, let it fall through to the browser/OS default — do not globally capture Tab at the editor level.
- Explicitly test: Tab with no suggestion showing behaves normally (moves focus or does nothing unexpected — this app doesn't need code-style indentation, so default Tab can likely just do nothing/move focus, simplifying this case versus a code editor).
- Explicitly test Escape and continued-typing-past-the-suggestion both dismiss the ghost text without inserting it, matching the constraint already captured in PROJECT.md.
- Debounce/gate suggestion generation so a suggestion computed for `#thou` doesn't linger and get wrongly accepted after the user has typed further to `#though`.

**Warning signs:**
- Tab occasionally does nothing when the user expects an accept, or accepts stale/wrong suggestion text.
- Keyboard-only or screen-reader manual testing gets stuck unable to leave the editor via Tab.
- Space or continued typing sometimes still inserts the suggested tag (a functional regression against the explicit "never auto-insert" constraint).

**Phase to address:**
Autocomplete/ghost-text phase, built after the core editor and tag-pill rendering are solid (Pitfall 4). Needs its own UAT checklist covering: no-suggestion Tab, active-suggestion Tab, Escape, continued-typing dismissal, and keyboard-focus-escape.

---

### Pitfall 6: Fuzzy/near-duplicate tag merging collapses intentionally distinct short tags

**What goes wrong:**
Aggressive fuzzy matching (especially prefix-weighted algorithms like Jaro-Winkler) merges `#thought` and `#thoughtful`, or `#idea`/`#ideal`, or `#read`/`#ready` into one bucket — silently misfiling entries under the wrong category with no easy way for the user to notice, since search "just works" until it works wrong. This directly undermines the app's stated Core Value ("reliable tag search... must consistently surface everything that belongs under it").

**Why it happens:**
Short strings are extremely sensitive to similarity-threshold choice: a single edit on a 5-8 character tag swings the similarity score much more than the same edit on a long string, so thresholds tuned on longer text (names, sentences) over-merge when applied naively to tags. Jaro-Winkler's prefix bonus specifically makes two words that merely *start* the same (thought/thoughtful, plan/planning, read/ready) score deceptively high even though they're semantically distinct. Developers often pick "one algorithm, one global threshold" without validating against realistic short-tag pairs, and without distinguishing "typo" (transposition/substitution near the end) from "different word that happens to share a prefix or root."

**How to avoid:**
- Do not rely on a single similarity score in isolation. Use edit distance (Levenshtein/Damerau-Levenshtein, which handles transpositions well) as the primary typo signal rather than Jaro-Winkler's prefix-weighted score, since typos in short tags are usually 1-2 character insertions/deletions/transpositions/substitutions, not prefix truncations.
- Set thresholds conservative-by-default and validate them against a hand-built test set of realistic near-miss pairs before shipping, including deliberately *hard negatives* like thought/thoughtful, plan/planning, read/ready, idea/ideal, note/notes — cross-checked research indicates false-positive rates only approach zero at very high similarity thresholds (~0.95+) for short strings; anything looser risks exactly this kind of over-merge.
- Prefer normalized edit distance relative to string length (e.g., max 1 edit for tags ≤6 chars, max 2 for longer) over a single fixed percentage threshold, since percentage thresholds behave inconsistently across the wide range of tag lengths.
- Treat plural/suffix variants (`thought`/`thoughts`) as a distinct, more lenient rule (stemming/suffix-stripping) rather than folding them into the same generic fuzzy-distance threshold used for typo correction — these are a different problem with different risk tolerance.
- Never auto-merge silently in a way that's hard to undo — this project already plans an "unmatched" review bucket; extend that same reviewability to *borderline* fuzzy merges (i.e., a merge just above threshold could still surface as "these look similar — same tag?" rather than being fully invisible), especially early on while the threshold is unproven with real usage data.

**Warning signs:**
- Manual QA search test set only includes obvious typos (`#thouhgt`), not near-miss distinct words (`#thoughtful`).
- No test set of "should NOT merge" pairs exists alongside the "should merge" pairs — teams often only validate the positive case.
- User has to remember which specific tag spelling "won" after a merge to find their own entries.

**Phase to address:**
Fuzzy tag matching/search phase — this is the project's stated Core Value, so it deserves its own dedicated research spike (algorithm + threshold selection validated against a real test set) before implementation, not just a library pick. Recommend a short calibration phase or explicit UAT step using this project's own PROJECT.md example (`#thought` vs `#thoughtful`) as a hard acceptance test.

---

### Pitfall 7: "Blank line = new entry" detection breaks across OS line endings, trailing whitespace, and paste operations

**What goes wrong:**
Detecting entry boundaries by "two newlines in a row" is deceptively fragile: Windows-authored files may use `\r\n`, macOS-native editors use `\n`, and if the app ever round-trips through another text editor (the plain-text-file design explicitly invites this), mixed line endings can appear in one file. A line containing only trailing whitespace/space characters visually looks blank but isn't an empty string, so a naive `\n\n` check misses it. Pasting multi-paragraph text can introduce different blank-line patterns (e.g., single newlines between paragraphs, or `\r\n\r\n`) than what typing Enter-twice produces, causing paste to either merge everything into one entry or fragment unpredictably compared to what typing would have produced.

**Why it happens:**
Developers write and test the blank-line detection against content generated only by their own app's Enter key, using one OS, and never test against externally-edited or pasted content — which is exactly the scenario this app is designed to support (portable plain-text files, readable/editable in any text editor).

**How to avoid:**
- Normalize all line endings to a single internal representation (e.g., `\n`) immediately on file read, and only convert back to the OS-appropriate ending (or a single consistent choice like `\n` always, which is safely readable cross-platform) on write — never do boundary detection on raw un-normalized text.
- Define "blank line" as a line that is empty after trimming trailing whitespace/tabs, not just zero-length — otherwise accidental trailing spaces silently prevent an entry boundary from being recognized.
- Explicitly decide and test the paste behavior: does pasting a multi-paragraph block of text create multiple entries (matching what typing Enter-twice would do) or one entry? This should be a deliberate product decision, not an accident of whatever regex happens to run.
- Add a test fixture file with `\r\n`, `\n`, mixed encodings, and trailing-whitespace blank lines, and verify entry-splitting behaves identically across all of them.

**Warning signs:**
- Entries that "should" be separate show up merged into one block after the file was touched by another editor or after a paste.
- Bug reports concentrated on Windows-authored or Windows-edited files, or after copy-pasting from other apps (Word, browsers, Notes apps that use different paragraph conventions).

**Phase to address:**
Core parsing/entry-boundary phase, alongside the writer/autosave phase — should be built and tested before the pill/autocomplete UI phases, since those all assume a correctly-segmented entry model underneath.

---

### Pitfall 8: Underestimating desktop packaging/signing/distribution effort as a "final step" instead of an early phase

**What goes wrong:**
Code signing and notarization are frequently left until the app is "otherwise done," at which point teams discover: macOS Gatekeeper blocks unsigned/unnotarized apps outright (not just a warning — for anything not through the Mac App Store, an unsigned or un-notarized build is effectively undistributable to non-technical users); Windows SmartScreen still flags freshly-signed apps because reputation is built from download volume/time, not just from having a valid certificate; and since June 2023, both OV and EV Windows code-signing private keys must live on FIPS-140-2-certified hardware (a physical USB token, HSM, or cloud-HSM signing service) — there is no longer a "just buy a .pfx file and sign locally" option, which surprises teams expecting the old workflow. Buying only one certificate type (or assuming a Mac Developer cert covers Windows, or vice versa) is a commonly cited expensive mistake since the two platforms' signing infrastructure shares nothing.
Auto-update adds another layer: the update binaries themselves must also be signed, and Electron's built-in tooling (Squirrel.Mac / electron-updater) is considerably more mature/documented for this than Tauri's newer updater ecosystem.

**Why it happens:**
Signing/notarization/distribution feels like DevOps/infra work orthogonal to "the app," so it's deprioritized until a release is imminent — at which point acquiring a hardware signing token, enrolling in the Apple Developer Program ($99/yr) and waiting on notarization turnaround, and setting up CI with a macOS runner all become last-minute blockers to actually getting the app in front of a single test user.

**How to avoid:**
- Treat "signed, notarized, distributable build on both macOS and Windows" as an early roadmap milestone (a walking-skeleton / hello-world build going through the full signing pipeline), not a final-phase task — even before most features exist. This surfaces certificate acquisition lead time and CI setup cost early, when it's cheap to absorb.
- Budget for both an Apple Developer Program membership ($99/yr) and a Windows code-signing certificate on qualifying hardware/cloud-HSM (ongoing cost, not one-time) as real project costs, not afterthoughts.
- Decide the stack (Electron vs. Tauri) partly on this axis: Electron's signing/notarization/auto-update tooling (electron-builder, Squirrel.Mac) is more mature and widely documented; Tauri offers a smaller/faster app but a younger release-engineering ecosystem, meaning more first-hand troubleshooting for a small team.
- For personal/limited-distribution use (this is explicitly a single-user personal tool per PROJECT.md), evaluate whether full notarization is required at all in early phases (self-built + Gatekeeper right-click-open workarounds may be acceptable for the developer's own use) versus deferring the full signing pipeline until/if the app is shared more broadly — but make that a conscious scope decision, not a surprise.

**Warning signs:**
- No signed/distributable build exists until late in the roadmap.
- "We'll figure out signing later" appears in planning without an owner or budget line.
- First macOS test build silently fails to open for a non-developer tester because Gatekeeper blocked it with no visible error.

**Phase to address:**
Should be validated in an early "walking skeleton" phase (first buildable, launchable, packaged app) rather than deferred to a "polish/ship" phase at the end — even a trivial blank-window app going through the full sign/notarize/package pipeline once early de-risks the rest of the roadmap.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Direct in-place `fs.writeFile` instead of atomic temp-file-then-rename | Simpler code, faster to ship | Risk of total data loss / corrupted journal file on crash or power loss | Never — this is the project's only copy of user data; atomic writes should be in place before any real usage |
| Global similarity threshold for all tag lengths | Simpler matching code, one config value | Over-merges short tags, under-merges long ones | Only for an internal prototype/spike, never for the shipped fuzzy-match feature |
| Hand-rolled contenteditable DOM manipulation for tag pills instead of an editor framework's decoration API | Avoids learning a framework's API surface | Cursor/undo/copy-paste bugs that are extremely hard to retrofit-fix once typing flow and pill rendering are entangled | Never for this feature — the cost of retrofitting decoration correctness after the fact is very high; pick the framework approach from the start |
| Skipping file-watcher/external-edit handling entirely in v1 | Removes an entire class of reload-loop bugs | User who edits the file in another app while the journal app is open may have edits silently overwritten by the next autosave | Acceptable for MVP if explicitly documented as a known limitation |
| Deferring code signing/notarization until "ready to ship" | Feels like faster feature progress early on | Certificate acquisition, CI setup, and Gatekeeper/SmartScreen troubleshooting become late-stage blockers | Acceptable only for early dev builds used solely by the developer on their own machine; not acceptable once any other person will run a build |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|-------------------|
| Editor framework (CodeMirror/ProseMirror/contenteditable) | Treating pill rendering as DOM mutation separate from the document model, causing text/decoration desync | Use the framework's native decoration/widget/mark API so decorations are derived from (never diverge from) the real document state |
| Node `fs` / Electron main-process file I/O | Performing file writes from the renderer process directly, or not awaiting async writes before allowing app quit | Route file writes through the main process (or a dedicated IPC-guarded API), and hook `before-quit` to flush pending saves before allowing the app to close |
| chokidar / file watching | Not filtering out the app's own writes, causing reload loops or clobbered edits | Track last-written content hash/mtime and ignore matching watcher events; use `awaitWriteFinish` |
| electron-builder / Tauri bundler for auto-update | Assuming auto-update "just works" without also signing the update artifact itself | Confirm the chosen framework's updater explicitly supports signed update packages for both platforms before relying on it |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Re-computing fuzzy match against the entire tag vocabulary on every keystroke of search | Search-as-you-type feels laggy as tag vocabulary grows | Pre-block/index tags (e.g., by first character or n-gram) and only run expensive edit-distance comparisons against a small candidate set | Noticeable once the user has accumulated a few hundred distinct tags over months of journaling |
| Loading/parsing the entire journal history into memory or re-parsing full files on every keystroke for entry-boundary detection | UI stutter while typing, especially in long-running daily files | Parse entry boundaries incrementally around the edit region; only reparse the current day's file, not the whole journal history, for normal typing | Becomes noticeable once a single day's file or the total file count grows large (months/years of daily use) |
| Re-rendering the entire document's decorations (all tag pills) on every keystroke instead of an incremental update | Typing feels sluggish as an entry/day grows longer | Use the editor framework's incremental decoration update (e.g., CodeMirror's RangeSet diffing) scoped to the changed range, not full-document re-decoration | Becomes noticeable in longer daily entries or after heavy tagging in one day |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Leaving `nodeIntegration: true` / `contextIsolation: false` (Electron) | Any content rendered in the window (including any future markdown/HTML rendering of user text, or a compromised dependency) gets full Node.js access — arbitrary file read/write/exec | Set `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` on every `BrowserWindow`; expose only a minimal, explicit API via `contextBridge` |
| Exposing raw `ipcRenderer` via `contextBridge.exposeInMainWorld` | Renderer gains access to every IPC channel, including internal/privileged ones, widening attack surface unnecessarily | Expose only specific, named functions (e.g., `saveEntry`, `loadDay`) through the bridge, never the raw IPC object |
| Passing user-authored text into `webContents.executeJavaScript()` or `eval()` in the main process (e.g., for some clever markdown/tag rendering trick) | Remote-code-execution path even with nodeIntegration/contextIsolation correctly configured elsewhere | Never evaluate user content as code; render tags/markdown through safe templating or a vetted parser only |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Autocomplete suggestion lingers or gets accepted after user has typed past it | Tag gets inserted the user didn't want, violating the app's explicit "never force-insert" design principle | Ghost text must be recomputed/invalidated on every keystroke and hidden immediately on any input that doesn't extend the current match |
| Fuzzy merge silently changes which "canonical" tag an entry is filed under with no visible indicator | User searches their own remembered tag spelling and gets confused when results appear under a different label | Show the canonical/matched tag alongside search results (e.g., "matched: #thought") so users understand why an entry surfaced |
| No feedback when a tag lands in the "unmatched" bucket | Entries silently become hard to find until user proactively checks the unmatched bucket | Surface unmatched tags unobtrusively (e.g., a subtle indicator near the tag) so users notice and can correct them close to the time of writing |
| Blank-line entry-splitting behaves differently for typed vs. pasted content with no explanation | User pastes a multi-paragraph note and gets a confusing single blob or unexpected fragmentation | Make paste-splitting behavior consistent and predictable with typed behavior, and treat it as a deliberately tested case, not an accident |

## "Looks Done But Isn't" Checklist

- [ ] **Autosave:** Often missing crash-safety — verify behavior when the process is force-killed (`kill -9` / Task Manager End Task) mid-save; file must not end up empty or truncated.
- [ ] **Tag pills:** Often missing full undo/redo correctness — verify undoing/redoing several steps through a tag boundary keeps text and pill rendering consistent, not just "looks right after one undo."
- [ ] **Ghost-text autocomplete:** Often missing the "no active suggestion" fallback path — verify Tab does something sane (not swallowed silently, not stuck) when no suggestion is showing.
- [ ] **Fuzzy tag merge:** Often missing a "should NOT merge" test set — verify near-miss but semantically distinct tag pairs (thought/thoughtful, plan/planning) stay separate, not just that typos merge correctly.
- [ ] **Entry boundary detection:** Often missing cross-platform line-ending and paste-path testing — verify a file with `\r\n` endings or content pasted from another app splits into entries the same way typed content would.
- [ ] **Packaging:** Often missing an actual signed, notarized, double-clickable build tested on a machine that isn't the developer's own — verify a non-technical user (or a clean VM) can open the app without a Gatekeeper/SmartScreen block.
- [ ] **Quit-time save flush:** Often missing an awaited save on app quit — verify closing the app immediately after typing (before the debounce timer would normally fire) doesn't lose the last few keystrokes.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|------------------|
| Non-atomic write corrupts a day's file | HIGH (data may be unrecoverable) | Retrofit atomic writes immediately; going forward, keep a rolling `.bak` of the last known-good save per file so a corrupted write has a fallback to restore from |
| Over-aggressive fuzzy merge collapsed distinct tags in already-written history | MEDIUM | Because storage is plain text, tags are recoverable by re-scanning raw file content independent of the merge index; provide a "rebuild tag index" action that reprocesses all files with corrected thresholds, and surface previously-merged-but-distinct tags for user review |
| Tag pill/cursor desync corrupted underlying text (e.g., stray characters left behind) | MEDIUM | Since files are plain text, a user can always manually open and fix the file in another editor; but the app should also detect and report anomalies (e.g., a `#` with a decoration but no matching text) rather than silently rendering broken state |
| Unsigned build blocks distribution close to a planned release | LOW–MEDIUM | Apple Developer enrollment and Windows cert procurement can be started in parallel with feature work once decided; if discovered late, gate release only (not development) — does not block continued feature work |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Debounced autosave races (Pitfall 1) | Core writer/autosave phase | Automated test: rapid sequential edits with artificially delayed writes resolve in the correct final order |
| Non-atomic writes / crash corruption (Pitfall 2) | Core writer/autosave phase | Manual test: force-kill the process mid-save repeatedly; file is always either fully old or fully new content, never partial |
| File watcher self-trigger loops (Pitfall 3) | Only if/when external-edit detection is built (recommend deferring) | Manual test: trigger autosave repeatedly while watcher is active; no reload/flicker occurs |
| Tag-pill cursor/undo/copy-paste desync (Pitfall 4) | Editor core phase (dedicated, before autocomplete) | UAT script covering cursor navigation across pills, multi-step undo/redo through pill boundaries, and copy-paste roundtrip fidelity |
| Ghost-text Tab conflicts (Pitfall 5) | Autocomplete phase (after editor core is stable) | UAT script covering: no-suggestion Tab, active-suggestion Tab accept, Escape dismiss, continued-typing dismiss, keyboard-only focus escape |
| Over-aggressive fuzzy tag merging (Pitfall 6) | Fuzzy search/matching phase (dedicated calibration step) | Test set of hand-picked "should merge" (typos) and "should NOT merge" (distinct-but-similar) tag pairs, including the PROJECT.md example `#thought`/`#thoughtful`, validated before shipping any threshold |
| Blank-line entry-boundary fragility (Pitfall 7) | Core parsing/entry-boundary phase (alongside autosave phase) | Test fixtures covering `\n`, `\r\n`, trailing-whitespace blank lines, and pasted multi-paragraph content |
| Packaging/signing left too late (Pitfall 8) | Early "walking skeleton" phase | A signed, notarized, installable build exists and opens cleanly on a clean/non-developer macOS and Windows environment well before feature-complete |

## Sources

- [Electron Desktop App Development Guide for Business in 2026 — Forasoft](https://www.forasoft.com/blog/article/electron-desktop-app-development-guide-for-business)
- [Code Signing | electron-builder](https://www.electron.build/docs/features/code-signing/)
- [Ship Your Tauri v2 App Like a Pro: Code Signing for macOS and Windows — DEV Community](https://dev.to/tomtomdu73/ship-your-tauri-v2-app-like-a-pro-code-signing-for-macos-and-windows-part-12-3o9n)
- [Code Signing | Electron official docs](https://www.electronjs.org/docs/latest/tutorial/code-signing)
- [Tauri v2 vs Electron 2026: The Honest Comparison — BuildMVPFast](https://www.buildmvpfast.com/blog/tauri-v2-vs-electron-desktop-apps-2026)
- [Code Signing and Notarization for Cross-Platform Desktop Apps — KeyQ](https://www.keyq.cloud/blog/code-signing-and-notarization-for-macos-desktop-apps/)
- [Electron App Code Signing Guide: Windows vs macOS Certificates Explained — CompareCheapSSL](https://comparecheapssl.com/sign-an-electron-app-for-windows-and-mac/)
- [Cursor issue with inline decoration setting contenteditable=false — ProseMirror #1069](https://github.com/ProseMirror/prosemirror/issues/1069)
- [Should restore cursor position of div.contenteditable after action — CKEditor4 #3126](https://github.com/ckeditor/ckeditor4/issues/3126)
- [Ghost text / inline suggestion API discussion — pi-mono #2355](https://github.com/badlogic/pi-mono/issues/2355)
- [Inline suggestion hides ghost text — Monaco editor #4189](https://github.com/microsoft/monaco-editor/issues/4189)
- [Inline suggestions from GitHub Copilot in VS Code — official docs](https://code.visualstudio.com/docs/editing/ai-powered-suggestions)
- [Inline suggestions block IntelliSense/Emmet — vscode #320940](https://github.com/microsoft/vscode/issues/320940)
- [File Save Operation Should Be Atomic to Prevent Data Loss — fritzing-app #4148](https://github.com/fritzing/fritzing-app/issues/4148)
- [React Query Autosave: Preventing Data Loss & Race Conditions — Patient](https://www.pz.com.au/insights/react-query-autosave-data-integrity)
- [Atomic File Write in .NET: Prevent Partial and Corrupted Files — AllCoderThings](https://allcoderthings.com/en/example/dotnet-atomic-file-write-temp-replace)
- [Towards Atomic File Modifications — DEV Community](https://dev.to/martinhaeusler/towards-atomic-file-modifications-2a9n)
- [Better File Writing in Python: Embrace Atomic Updates — Medium](https://sahmanish20.medium.com/better-file-writing-in-python-embrace-atomic-updates-593843bfab4f)
- [Fuzzy Matching Explained: Algorithms, Techniques, and How It Works — WinPure](https://winpure.com/fuzzy-matching-guide/)
- [Jaro-Winkler vs. Levenshtein in AML Screening: Choosing the Right Algorithm — Flagright](https://www.flagright.com/post/jaro-winkler-vs-levenshtein-choosing-the-right-algorithm-for-aml-screening)
- [What Is Fuzzy Matching? Algorithms, Examples & Thresholds — Match Data Pro](https://matchdatapro.com/what-is-fuzzy-matching/)
- [Chokidar change event triggers on watcher.add(path) — chokidar #780](https://github.com/paulmillr/chokidar/issues/780)
- [Electron, chokidar, and native Node.js modules: A horror story — Hendrik Erz](https://www.hendrik-erz.de/post/electron-chokidar-and-native-nodejs-modules-a-horror-story-from-integration-hell)
- [CodeMirror Decoration Example — official docs](https://codemirror.net/examples/decoration/)
- [CodeMirror 6: widget decoration that takes up space — discuss.CodeMirror](https://discuss.codemirror.net/t/codemirror-6-widget-decoration-that-takes-up-space/2592)
- [CodeMirror Huge Doc Demo — official docs](https://codemirror.net/examples/million/)
- [Keyboard Trap - Ensure Seamless Keyboard Navigation — BrowserStack Docs](https://www.browserstack.com/docs/accessibility/rules/assisted-test/keyboard-trap)
- [Accessibility: Ace traps the Tab key — ace #3149](https://github.com/ajaxorg/ace/issues/3149)
- [Trapping Focus Within An Element Using Tab-Key Navigation — Ben Nadel](https://www.bennadel.com/blog/4096-trapping-focus-within-an-element-using-tab-key-navigation-in-javascript.htm)
- [Daily Markdown Journal — GitHub (file-per-day pattern reference)](https://github.com/makalin/Daily-Markdown-Journal)
- [Keeping a Single Markdown File as Your Only Diary — Medium](https://medium.com/@tyler.cloud/keeping-a-single-markdown-file-as-your-only-diary-d05a5f893366)
- [Electron Pitfalls: Common Mistakes and How to Avoid Them — CoddyKit Blog](https://www.coddykit.com/pages/blog-detail?id=512569&slug=electron-pitfalls-common-mistakes-and-how-to-avoid-them)
- [Security | Electron official docs](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron App Security: Context Isolation, nodeIntegration, and the RCE Class That Keeps Coming Back — AppSec Brief](https://appsecbrief.com/articles/electron-app-security-context-isolation-rce/)
- [App Before-Quit Event — electron #444](https://github.com/electron/electron/issues/444)
- [app | Electron official API docs](https://www.electronjs.org/docs/latest/api/app)
- [Saving Unsaved File Changes — Electron v3, Frontend Masters](https://frontendmasters.com/courses/electron-v3/saving-unsaved-file-changes/)

---
*Pitfalls research for: Cross-platform desktop journaling app (Electron/Tauri, custom editor decorations, plain-text storage, fuzzy tag search)*
*Researched: 2026-08-28*
