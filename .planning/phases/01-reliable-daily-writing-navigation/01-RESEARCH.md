# Phase 1: Reliable Daily Writing & Navigation - Research

**Researched:** 2026-08-29
**Domain:** Tauri v2 + React 19 desktop app scaffolding, plugin-fs capability config, CodeMirror 6 autosave, unsigned cross-platform packaging
**Confidence:** MEDIUM (npm registry versions and package-legitimacy signals = HIGH; official Tauri docs fetched directly = MEDIUM; CM6 debounce/flush pattern and unsigned-build UX details = MEDIUM, cross-checked but not independently reproduced this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Autosave Durability**
- D-01: Debounce writes to disk ~1-2 seconds after the user stops typing (not on every keystroke, not a fixed timer regardless of activity).
- D-02: In addition to the debounce, force an immediate save (flush) on: window blur/app-switch, navigating away to a different day, and app close/quit — so the debounce window is never the only thing standing between a keystroke and disk.
- D-03: No visible save indicator of any kind. Autosave is fully invisible — matches the frictionless "just type" philosophy in PROJECT.md.

**Entry Segmentation Look**
- D-04: The entry boundary (double-Enter → blank line) is purely invisible in the UI — no divider, no extra spacing beyond the natural blank line itself. Nothing extra to render in Phase 1.
- D-05: No per-entry metadata is displayed. Only a day header (today's date) appears once at the top of the page.

**Calendar & Delete UX**
- D-06: Calendar picker is reached via both a small button/icon AND a keyboard shortcut.
- D-07: The calendar visually marks which days have entries (dot/dash) vs. empty days — requires scanning the journal folder for non-empty day files.
- D-08: Editing a past day works exactly like editing today's entry — same free-text surface, no read-only lock, no separate "delete entry" action.
- D-09: A confirmation dialog is required ONLY when deleting an entire day's `.md` file outright. Normal in-place text editing never triggers confirmation.

**Packaging & Signing Scope**
- D-10: Ship unsigned/self-signed builds for both macOS and Windows, with a documented workaround in the README (macOS: right-click → Open; Windows: "More info" → "Run anyway"). No paid signing for v1.
- D-11: This holds regardless of audience size — public, free GitHub repo, self-build assumption. Not revisited unless distribution scale changes dramatically.

### Claude's Discretion
- Exact placement/styling of the calendar affordance (icon, exact corner, exact keyboard shortcut binding).
- Exact debounce duration within the ~1-2s range, and exact entry-indicator styling (dot vs. dash) on the calendar.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WRITE-01 | Open to blank canvas for today, ready to type immediately | App shell + Editor Canvas pattern (Architecture Patterns); default-to-today file resolution via `date-fns` |
| WRITE-02 | Autosaved continuously, no explicit save action | Debounced-autosave-with-flush pattern (Code Examples); D-01/D-02 |
| WRITE-03 | Enter twice splits into distinct entries | Structural-only in Phase 1 (D-04) — no parser/decoration code needed; blank line is the raw text itself, CM6 requires zero special handling |
| WRITE-04 | Saved as local plain Markdown, one file per day, readable outside app | `@tauri-apps/plugin-fs` + capability/scope config (Standard Stack, Code Examples); file path convention `YYYY-MM-DD.md` |
| NAV-01 | Calendar picker to browse any previous day | Calendar day-picker library options + directory-scan-for-content-marker pattern |
| NAV-02 | Past days fully editable and deletable | Same editor surface reload-by-path; delete-file + confirmation dialog pattern (D-09) |
| PLATFORM-01 | Runs as native app on macOS | `tauri build` targets `app`/`dmg`; Environment Availability — Rust toolchain missing locally |
| PLATFORM-02 | Runs as native app on Windows | `tauri build` targets `msi`/`nsis`; cross-compile limitation — needs Windows runner/CI, not buildable from this macOS machine |
| PLATFORM-03 | Dark-mode-only, minimal visual style | Known WebView `prefers-color-scheme` propagation bug (Common Pitfalls) — must hardcode dark CSS, not rely on OS theme detection |
</phase_requirements>

## Summary

Phase 1 is the initial `create-tauri-app` scaffold: a Tauri v2 + React 19 + TypeScript shell wrapping a single CodeMirror 6 editor, backed by `@tauri-apps/plugin-fs` writing one Markdown file per day. Nothing here requires the parser/decoration machinery that Phases 2-3 will need — per CONTEXT.md D-04/D-05, the double-Enter entry boundary is *only* the raw blank line in plain text, which CodeMirror renders with zero custom code. This significantly narrows Phase 1's real engineering surface to four things: (1) getting the Tauri capability/permission JSON right so `plugin-fs` can actually read/write day files (a common early-adopter stumbling block — permissions and scopes are two separate, both-required layers), (2) a debounce-plus-forced-flush autosave scheme that also intercepts the Tauri window-close event so nothing is lost on quit, (3) a calendar UI that answers "which days have content" via a directory scan, and (4) producing genuinely unsigned, working `.dmg`/`.app` and `.msi`/`.exe` artifacts and documenting the Gatekeeper/SmartScreen bypass.

The single highest-impact planning fact from this research: **this development machine has no Rust toolchain installed** (`cargo`/`rustc`/`rustup` all absent), which blocks `tauri dev`/`tauri build` entirely until installed — this must be an explicit early task, not an assumed prerequisite. Second: **Windows installers cannot be reliably cross-compiled from macOS** — Tauri's own docs describe macOS→Windows cross-compilation as a "last resort," so PLATFORM-02 realistically requires either a Windows machine/VM or a CI pipeline (GitHub Actions matrix with a `windows-latest` runner) to produce the `.msi`/`.exe`. Both should be surfaced as planning blockers, not implementation details to discover mid-execution.

**Primary recommendation:** Scaffold with `npm create tauri-app@latest` (React + TypeScript template), wire `@tauri-apps/plugin-fs` against a capability file with explicit `$APPDATA` (or `$DOCUMENT`) scope, wrap CodeMirror 6 in a debounce+flush autosave hook keyed off `EditorView.updateListener` + `domEventHandlers({blur})` + Tauri's `onCloseRequested`, hand-roll a small calendar grid from `date-fns` + a directory listing (no new dependency required), and build/test unsigned artifacts via a GitHub Actions matrix rather than relying on local cross-compilation.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Blank-canvas-for-today resolution | Frontend (React shell) | — | Pure client-side date logic (`date-fns`), no backend needed |
| Text editing surface | Browser/Client (webview) | — | CodeMirror 6 `EditorView` lives entirely in the renderer |
| Debounced autosave trigger | Frontend (React/CM6 hook) | — | In-memory timer logic, no I/O until flush fires |
| File read/write (day `.md` files) | API/Backend (Tauri Rust core via plugin-fs) | Browser/Client (invokes via JS bridge) | `plugin-fs` commands execute in the Rust process; JS only invokes them — this is the OS-filesystem boundary and must respect the capability/scope model |
| Window-close interception | API/Backend (Tauri window/event system) | Frontend (registers the async handler) | `onCloseRequested` is a Tauri-core event; the async flush logic it triggers is frontend/business logic |
| Calendar content index (which days have entries) | Frontend (directory scan via plugin-fs `readDir`) | API/Backend (plugin-fs executes the actual `readDir`) | No database/index tier in Phase 1 — a live directory scan on calendar open is sufficient at this data scale |
| Delete-day + confirmation | Frontend (confirm dialog UI) | API/Backend (`remove` file command) | UI decision (D-09) lives in the renderer; the actual unlink goes through plugin-fs |
| Packaging / signing | Build/CI tier (Rust toolchain + `tauri build`, GitHub Actions) | — | Entirely outside the running app; a build-time concern only |
| Dark-mode-only styling | Browser/Client (CSS) | — | Must be hardcoded CSS, not a `prefers-color-scheme` media query (see Pitfall 4) |

## Standard Stack

### Core (already selected project-wide — confirmed current for this phase's scaffolding)

| Library | Version (verified 2026-08-29) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tauri-apps/cli` | `2.11.4` `[VERIFIED: npm registry]` | Scaffold + build tooling | Matches CLAUDE.md; `npm view` confirms current |
| `@tauri-apps/api` | `2.11.1` `[VERIFIED: npm registry]` | Core JS↔Rust bridge, `window`/`path` namespaces | Required baseline for `onCloseRequested`, `appDataDir()` |
| `@tauri-apps/plugin-fs` | `2.5.1` `[VERIFIED: npm registry]` | Day-file read/write/readDir/exists/mkdir/remove | Confirmed on registry; 401K weekly downloads, official `tauri-apps` org repo |
| `@tauri-apps/plugin-dialog` | `2.7.2` `[VERIFIED: npm registry]` | Confirmation dialog for D-09 delete-day flow; optional folder picker | Confirmed on registry, 1M+ weekly downloads |
| `react` / `react-dom` | `19.2.8` `[VERIFIED: npm registry]` | UI layer | Confirmed on registry, 173M/162M weekly downloads |
| `@uiw/react-codemirror` | `4.25.11` `[VERIFIED: npm registry]` | React wrapper for CM6 | Confirmed on registry; peerDependency is `react: >=17.0.0` `[VERIFIED: npm view peerDependencies]` — no conflict with React 19 |
| `@codemirror/state` | `6.x` (registry shows `6.5.x`+ line current) `[VERIFIED: npm registry]` | CM6 core | Package created 2020-12-29 — long-established, not actually new despite legitimacy-check flag (see Package Legitimacy Audit) |
| `@codemirror/view` | `6.x` current `[VERIFIED: npm registry]` | CM6 core — `EditorView`, `domEventHandlers`, `updateListener` | Same as above |
| `@codemirror/commands` | `6.x` current `[VERIFIED: npm registry]` | Default keymaps | Same as above |
| `date-fns` | `4.4.0` `[VERIFIED: npm registry]` | `YYYY-MM-DD` filename generation, calendar month-grid math | Confirmed current; already in project stack |
| `typescript` | `5.9.x`/latest `[VERIFIED: npm registry]` | Type safety | Confirmed current |
| `vite` | `8.x` current `[VERIFIED: npm registry]` | Dev server/bundler | Confirmed current; `create-tauri-app` wires this automatically |

### Supporting (new for this phase)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| No new runtime dependency required for the calendar. | — | Month-grid rendering + "has content" dots | Hand-roll using `date-fns` (`startOfMonth`, `eachDayOfInterval`, `format`) — see Don't Hand-Roll below for why this is the *correct* call, not a shortcut |
| `react-day-picker` `[ASSUMED — package name from training knowledge/WebSearch, not yet confirmed authoritative]` | `10.0.1` `[VERIFIED: npm registry exists]` but package-name discovery itself is `[ASSUMED]` per provenance rule | Fallback option only if the hand-rolled grid proves insufficient (keyboard nav, a11y) | Only reach for this if the planner/executor decides a full picker's accessibility semantics are worth the dependency; not the default recommendation |

**Installation (this phase's additions on top of the already-scaffolded project):**
```bash
npm create tauri-app@latest
# select: TypeScript / npm / React / TypeScript flavor

cd <project>
npm install react@^19 react-dom@^19
npm install @tauri-apps/api@^2 @tauri-apps/plugin-fs@^2 @tauri-apps/plugin-dialog@^2
npm install @uiw/react-codemirror@^4 @codemirror/state@^6 @codemirror/view@^6 @codemirror/commands@^6
npm install date-fns@^4
npm install -D typescript@^5.9 vite@^8 @vitejs/plugin-react@^4 @tauri-apps/cli@^2

# Rust-side plugin registration (src-tauri/)
cargo add tauri-plugin-fs
cargo add tauri-plugin-dialog
```

**Version verification performed:** `npm view <pkg> version` run live against the registry for all 15 packages above (2026-08-29) — see Package Legitimacy Audit for full signal set including download counts and package age.

## Package Legitimacy Audit

Ran `gsd-tools query package-legitimacy check --ecosystem npm` against every package this phase installs.

| Package | Registry | Age (via `npm view time.created`) | Weekly Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `react` | npm | long-established | 173,164,181 | github.com/react/react | OK | Approved |
| `react-dom` | npm | long-established | 162,029,750 | github.com/react/react | OK | Approved |
| `@tauri-apps/api` | npm | long-established | 2,447,314 | github.com/tauri-apps/tauri | OK | Approved |
| `@tauri-apps/plugin-fs` | npm | long-established | 401,746 | github.com/tauri-apps/plugins-workspace | OK | Approved |
| `@tauri-apps/plugin-dialog` | npm | created 2023-05-24 `[VERIFIED: npm view time.created]` | 1,030,550 | github.com/tauri-apps/plugins-workspace | OK | Approved |
| `@tauri-apps/cli` | npm | long-established | 2,247,676 | github.com/tauri-apps/tauri | OK | Approved |
| `@uiw/react-codemirror` | npm | long-established | 4,453,201 | github.com/uiwjs/react-codemirror | OK | Approved |
| `@codemirror/state` | npm | created 2020-12-29 `[VERIFIED: npm view time.created]` | 12,683,258 | code.haverbeke.berlin/codemirror/state | OK | Approved |
| `@codemirror/view` | npm | created 2020-12-29 `[VERIFIED: npm view time.created]` | 14,310,465 | code.haverbeke.berlin/codemirror/view | SUS (reason: `too-new`) | **Flagged — false positive** (see note below); Approved after manual check |
| `@codemirror/commands` | npm | created 2020-12-29 (same repo family) | 13,414,889 | code.haverbeke.berlin/codemirror/commands | SUS (reason: `too-new`) | **Flagged — false positive**; Approved after manual check |
| `date-fns` | npm | long-established | 100,855,210 | github.com/date-fns/date-fns | OK | Approved |
| `typescript` | npm | long-established | 274,198,210 | github.com/microsoft/TypeScript | OK | Approved |
| `vite` | npm | created 2020-04-21 `[VERIFIED: npm view time.created]` | 176,223,418 | github.com/vitejs/vite | SUS (reason: `too-new`) | **Flagged — false positive**; Approved after manual check |
| `@vitejs/plugin-react` | npm | same repo family as vite | 84,087,839 | github.com/vitejs/vite-plugin-react | SUS (reason: `too-new`) | **Flagged — false positive**; Approved after manual check |
| `react-day-picker` (optional fallback only) | npm | created 2014-12-29 `[VERIFIED: npm view time.created]` | 45,513,810 | github.com/gpbl/react-day-picker | OK | Approved if used |

**Packages removed due to `[SLOP]` verdict:** none.

**Packages flagged as suspicious `[SUS]`:** `@codemirror/view`, `@codemirror/commands`, `vite`, `@vitejs/plugin-react` — all four flagged for reason `too-new`. **Manual verification performed this session:** `npm view <pkg> time.created` shows all four packages were *first published* between 2020-04-21 and 2020-12-29 — years old, not new. The `too-new` signal is a false positive produced because the seam's heuristic keys off the *latest version's* publish date (all four ship frequent releases, e.g. `@codemirror/view` had a release on 2026-08-16), not the package's true age. All four have 10M+ weekly downloads and an official/canonical source repo. **Disposition: Approved without a `checkpoint:human-verify` gate** — the planner should note this reasoning inline if a plan-checker flags it again, rather than re-litigating. This is a documented limitation of the legitimacy heuristic, not a real slopsquatting risk.

**Packages discovered via WebSearch and not independently confirmed against an authoritative source (per package-name provenance rule):** `react-day-picker` — the package name itself came from WebSearch/training knowledge, not from official Tauri/React docs. It exists on the registry and passes `OK`, but per the provenance rule this is still `[ASSUMED]` for the *name discovery* even though the registry lookup is `[VERIFIED]`. **The planner must add a `checkpoint:human-verify` task before installing `react-day-picker`, if the hand-rolled calendar approach is rejected in favor of it.**

## Architecture Patterns

### System Architecture Diagram (Phase 1 slice only)

```
[App launch]
     │
     ▼
[React shell: resolve today's date via date-fns]
     │
     ▼
[plugin-fs: exists(YYYY-MM-DD.md, {baseDir})] ──no──▶ [render blank CodeMirror buffer]
     │yes
     ▼
[plugin-fs: readTextFile(YYYY-MM-DD.md)] ──▶ [render CodeMirror buffer with file contents]
     │
     ▼
[User types] ──▶ [EditorView.updateListener fires on docChanged]
     │                         │
     │                         ▼
     │                 [debounce timer (1-2s) resets]
     │                         │
     │                 (timer fires OR blur OR day-nav OR onCloseRequested)
     │                         │
     │                         ▼
     │                 [plugin-fs: writeTextFile(YYYY-MM-DD.md, buffer)]
     │
     ▼
[User opens Calendar (button or shortcut)]
     │
     ▼
[plugin-fs: readDir(journal folder)] ──▶ [mark days whose file exists & is non-empty]
     │
     ▼
[User clicks a day] ──▶ [flush current day's pending save] ──▶ [load clicked day into same Editor Canvas]
     │
     ▼
[User deletes a whole day] ──▶ [confirm dialog (D-09)] ──confirmed──▶ [plugin-fs: remove(file)]
```

### Recommended Project Structure

```
src/
├── editor/
│   └── EditorCanvas.tsx       # mounts CodeMirror, wires debounce+flush autosave
├── storage/
│   ├── dayFile.ts             # path convention (YYYY-MM-DD.md), read/write/exists/remove wrappers
│   └── journalDir.ts          # resolves base journal directory (BaseDirectory.AppData or .Document)
├── calendar/
│   └── CalendarNav.tsx        # hand-rolled month grid (date-fns) + directory-scan-driven dots
├── app/
│   └── App.tsx                # shell: today vs. selected-day routing, close-intercept registration
src-tauri/
├── capabilities/
│   └── default.json           # fs + dialog permissions and scopes
├── tauri.conf.json            # window config (theme, decorations), bundle targets
└── Cargo.toml                 # tauri-plugin-fs, tauri-plugin-dialog registered
```

### Pattern 1: Capability + scope are two separate, both-required layers

**What:** A `plugin-fs` permission identifier (e.g. `fs:allow-write-text-file`) grants nothing by itself — it must be paired with an explicit `allow` scope array of paths in the same capability file, or every call throws a permission-denied error at runtime.
**When to use:** Any `plugin-fs` (or other Tauri v2 plugin) usage — this is the standard v2 security model, not specific to this project.
**Example:**
```json
// Source: https://v2.tauri.app/plugin/file-system/ (official docs, fetched 2026-08-29) [CITED: v2.tauri.app/plugin/file-system/]
// src-tauri/capabilities/default.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Journal day-file read/write access",
  "windows": ["main"],
  "permissions": [
    "fs:default",
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [{ "path": "$APPDATA" }, { "path": "$APPDATA/**/*" }]
    },
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [{ "path": "$APPDATA" }, { "path": "$APPDATA/**/*" }]
    },
    {
      "identifier": "fs:allow-mkdir",
      "allow": [{ "path": "$APPDATA" }, { "path": "$APPDATA/**/*" }]
    },
    {
      "identifier": "fs:allow-read-dir",
      "allow": [{ "path": "$APPDATA" }, { "path": "$APPDATA/**/*" }]
    },
    {
      "identifier": "fs:allow-remove",
      "allow": [{ "path": "$APPDATA" }, { "path": "$APPDATA/**/*" }]
    }
  ]
}
```
Deny scopes take precedence over allow scopes when both match a path `[CITED: v2.tauri.app/plugin/file-system/]`.

### Pattern 2: Debounce + explicit flush points, not a single timer

**What:** A debounce hook that (a) resets a `setTimeout` on every `docChanged` update, (b) exposes a `flush()` that immediately runs the pending save and clears the timer, and (c) is called from three places: the debounce timer itself, `EditorView.domEventHandlers({ blur })`, and the parent component's day-navigation/unmount logic.
**When to use:** Exactly D-01/D-02's requirement — debounce is the common case, flush is the safety net.
**Example:**
```typescript
// Source: pattern synthesized from CM6 updateListener + domEventHandlers docs and community examples [CITED: discuss.codemirror.net/t/domeventhandlers-blur/8356; codiga.io/blog/implement-codemirror-6-in-react]
function useDebouncedFlush(save: (text: string) => Promise<void>, delayMs = 1500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null);

  const schedule = (text: string) => {
    pending.current = text;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flush(), delayMs);
  };

  const flush = async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (pending.current !== null) {
      const text = pending.current;
      pending.current = null;
      await save(text);
    }
  };

  return { schedule, flush };
}

// In the CodeMirror extension array:
EditorView.updateListener.of((update) => {
  if (update.docChanged) schedule(update.state.doc.toString());
});
EditorView.domEventHandlers({
  blur: () => { flush(); return false; },
});
```
**Do not add `lodash` for this** — see Don't Hand-Roll below.

### Pattern 3: Flush before quit via `onCloseRequested`

**What:** Register `getCurrentWindow().onCloseRequested(async (event) => { event.preventDefault(); await flush(); await getCurrentWindow().destroy(); })` (or close after flush completes) so the pending debounce is never lost on quit.
**When to use:** App-level, registered once near the app shell root; unlisten on unmount.
**Example:**
```typescript
// Source: https://v2.tauri.app/reference/javascript/api/namespacewindow/ (fetched 2026-08-29) [CITED: v2.tauri.app/reference/javascript/api/namespacewindow/]
import { getCurrentWindow } from "@tauri-apps/api/window";

useEffect(() => {
  let unlisten: (() => void) | undefined;
  (async () => {
    unlisten = await getCurrentWindow().onCloseRequested(async (event) => {
      event.preventDefault();
      await flush();          // your debounce hook's flush()
      await getCurrentWindow().destroy();
    });
  })();
  return () => unlisten?.();
}, []);
```
**Correction to a common web-search result:** several sources (including one fetched this session) show `import { confirm } from '@tauri-apps/api/dialog'` — that import path is **Tauri v1**. In v2, dialog APIs live in the separate `@tauri-apps/plugin-dialog` package (`import { confirm } from '@tauri-apps/plugin-dialog'`). `[CITED: version-compatibility cross-check against @tauri-apps/plugin-dialog package existing on npm and plugin-dialog's role in CLAUDE.md's stack table]` — verify the exact import against the installed plugin's TypeScript types during implementation.

### Pattern 4: Atomic-ish day-file writes via write-then-verify (optional hardening)

**What:** `plugin-fs`'s `writeTextFile` has no documented atomicity/fsync guarantee `[CITED: GitHub tauri-apps/plugins-workspace issue discussion — no official durability guarantee found in docs]`. For a single-writer desktop app (no concurrent processes touching the same file), the dominant real risk covered by D-01/D-02 is "was `writeTextFile` even called before the process died," not mid-write corruption — the flush-on-blur/close/day-nav pattern above already addresses that. If stronger crash-mid-write safety is wanted, write to a temp file in the same directory and rely on the OS rename being effectively atomic, then rename over the real file.
**When to use:** Consider only if success-criterion-3 ("survives an app crash... mid-write") is interpreted to include a crash *during* the disk write itself, not just before it starts. Flag this interpretation question in Open Questions below.

### Anti-Patterns to Avoid
- **Per-keystroke disk writes:** causes I/O storms and perceptible input lag; always debounce (Architecture research, already established project-wide).
- **Relying on CM6's built-in `autocompletion()` dropdown for anything in Phase 1:** not needed this phase at all (no tag suggestions yet), but worth noting so it isn't accidentally pulled in early — CLAUDE.md already excludes this for Phase 3's ghost-text feature.
- **Building a parser/segmentation module in Phase 1:** per D-04/D-05, the blank line needs zero rendering treatment. Do not port Phase 2/3's `entryParser.ts` forward early — it has no job to do until tag pills exist.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| CodeMirror lifecycle inside React (mount/unmount/state sync) | Manual `EditorView` constructor management in a `useEffect` | `@uiw/react-codemirror` | Already selected project-wide; avoids a well-known class of "editor recreated on every render" bugs |
| Tauri↔JS file I/O primitives | Custom Rust `tauri::command`s for basic read/write/list/remove | `@tauri-apps/plugin-fs` | Covers the full CRUD surface needed here (`readTextFile`, `writeTextFile`, `readDir`, `exists`, `remove`, `mkdir`) without hand-written Rust for the common path |
| Debounce-with-flush | Adding `lodash`/`lodash.debounce` as a dependency for one function | A ~15-line custom hook (Pattern 2 above) | This is explicitly **not** a "deceptively complex" problem — a debounce+flush pair is trivial to implement correctly and adding a dependency (even a small one) for it contradicts the project's stated minimal-footprint philosophy. This is the inverse case of the "don't hand-roll" rule: sometimes hand-rolling *is* the standard-expert choice. |
| Calendar month-grid date math | A full calendar UI library for a single month grid + dots | `date-fns` (`startOfMonth`, `endOfMonth`, `eachDayOfInterval`, `getDay`, `format`) — already a project dependency | The actual complexity (leap years, month boundaries, locale week-start) is already solved by `date-fns`; the remaining work is a plain CSS grid + one `readDir` scan. A full picker library (react-day-picker, react-datepicker) adds bundle weight and its own theming surface to override for the dark-minimal look, for a feature whose hard part is already outsourced. |

**Key insight:** Phase 1's "don't hand-roll" list is short because most of the hard problems (fuzzy matching, rich decorations) don't arrive until Phase 2/3. The temptation in Phase 1 is the opposite failure mode — reaching for a library (a full calendar picker, a debounce utility package) where the project's own already-selected dependencies (`date-fns`, vanilla `setTimeout`) are sufficient and better aligned with "minimal."

## Common Pitfalls

### Pitfall 1: Permission granted but scope forgotten (or vice versa)
**What goes wrong:** `plugin-fs` calls throw a permission-denied error at runtime even though the permission identifier is listed in capabilities.
**Why it happens:** Tauri v2's model requires *both* the permission AND a matching `allow` scope path — omitting either fails silently until the first file operation is attempted `[CITED: v2.tauri.app/plugin/file-system/]`.
**How to avoid:** Always pair every `fs:allow-*` permission with an explicit scope block during capability-file authoring (see Pattern 1); test read+write+readDir+remove against the real target directory before building UI on top.
**Warning signs:** "not allowed" or "forbidden path" errors from `plugin-fs` calls that look syntactically correct.

### Pitfall 2: No Rust toolchain on this development machine
**What goes wrong:** `npm create tauri-app@latest` and `npm run tauri dev` will fail at the Rust-compilation step.
**Why it happens:** `cargo`, `rustc`, and `rustup` were confirmed absent on this machine this session (`command -v cargo` / `rustc` / `rustup` all returned not-found). Xcode Command Line Tools ARE present (`/Library/Developer/CommandLineTools`), which covers the macOS-native-linking half of the prerequisite, but not the Rust compiler itself.
**How to avoid:** Install Rust via `rustup` (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`) as an explicit, early plan task — before any scaffold/build step — not an assumed environment precondition.
**Warning signs:** `cargo: command not found` or a `create-tauri-app` failure partway through Rust dependency resolution.

### Pitfall 3: Windows installers cannot be reliably built from this macOS machine
**What goes wrong:** Attempting `tauri build --target x86_64-pc-windows-msvc` (or similar) from macOS either fails outright or produces an installer Tauri's own docs describe as under-tested.
**Why it happens:** Tauri's official guidance treats macOS/Linux→Windows cross-compilation (especially for NSIS) as "a last resort... not tested as much" `[CITED: WebSearch synthesis of Tauri cross-platform build docs/discussion — treat as MEDIUM confidence, verify against current v2.tauri.app/distribute/ pages at plan time]`.
**How to avoid:** Plan for a GitHub Actions matrix build (`windows-latest` + `macos-latest` runners) to produce the two native installers, rather than a single local build step. This is a **planning blocker** — it changes PLATFORM-02's implementation from "run tauri build" to "set up CI."
**Warning signs:** Any task that assumes `tauri build` alone, run once on the dev machine, produces both a `.dmg` and a `.msi`.

### Pitfall 4: Dark-mode-only doesn't survive OS theme detection alone
**What goes wrong:** Setting `"theme": "Dark"` in `tauri.conf.json`'s window config, or relying on a CSS `prefers-color-scheme: dark` media query, does not reliably force dark styling — there is a known WebView issue where `prefers-color-scheme` reflects the OS theme regardless of the Tauri window's configured theme.
**Why it happens:** The webview's CSS media-query resolution is independent of Tauri's own window-theme setting `[CITED: WebSearch synthesis of tauri-apps/wry issue #806 and tauri-apps/tauri issue #5802 — MEDIUM confidence, GitHub issue discussion not an official doc guarantee]`.
**How to avoid:** Write all styles as literal dark values (no `prefers-color-scheme` branching, no light-theme CSS to override) — PLATFORM-03 wants dark-only regardless of OS setting anyway, which conveniently sidesteps needing the propagation to work correctly at all. Add `<meta name="color-scheme" content="dark">` for correct native scrollbar/form-control rendering.
**Warning signs:** Native form widgets (scrollbars, `<select>` etc., if any are used) rendering in light chrome despite dark app CSS.

### Pitfall 5: `writeTextFile` has no documented atomicity guarantee
**What goes wrong:** A crash or force-quit at the exact instant `writeTextFile` is mid-flight could theoretically leave a truncated/corrupt day file.
**Why it happens:** No official Tauri doc found this session states `writeTextFile` is atomic or fsync'd `[CITED: GitHub tauri-apps/plugins-workspace issue discussion noting a race on concurrent writes to the same path — no atomicity guarantee documented]`.
**How to avoid:** For MVP, the flush-on-blur/close/day-nav strategy (D-02) minimizes the *window* in which this could occur (no write is ever in-flight for more than one small file's worth of bytes); if the planner wants stronger guarantees, write-to-temp-then-rename is the standard mitigation (see Pattern 4). Flagged as an Open Question below since it affects how literally "survives a crash mid-write" is interpreted.
**Warning signs:** N/A for MVP scope — this is a preventive note, not an observed failure.

## Code Examples

### Loading and resolving today's file path
```typescript
// Source: date-fns official API + @tauri-apps/plugin-fs official API (fetched 2026-08-29) [CITED: v2.tauri.app/reference/javascript/fs/]
import { format } from "date-fns";
import { exists, readTextFile, writeTextFile, BaseDirectory } from "@tauri-apps/plugin-fs";

const JOURNAL_SUBDIR = "journal"; // e.g. $APPDATA/journal/YYYY-MM-DD.md

function dayFilePath(date: Date): string {
  return `${JOURNAL_SUBDIR}/${format(date, "yyyy-MM-dd")}.md`;
}

async function loadDay(date: Date): Promise<string> {
  const path = dayFilePath(date);
  const fileExists = await exists(path, { baseDir: BaseDirectory.AppData });
  if (!fileExists) return "";
  return readTextFile(path, { baseDir: BaseDirectory.AppData });
}

async function saveDay(date: Date, text: string): Promise<void> {
  await writeTextFile(dayFilePath(date), text, { baseDir: BaseDirectory.AppData });
}
```

### Scanning the journal directory for the calendar's content dots
```typescript
// Source: @tauri-apps/plugin-fs readDir signature (fetched 2026-08-29) [CITED: v2.tauri.app/reference/javascript/fs/]
import { readDir, BaseDirectory } from "@tauri-apps/plugin-fs";

async function daysWithContent(): Promise<Set<string>> {
  const entries = await readDir(JOURNAL_SUBDIR, { baseDir: BaseDirectory.AppData });
  const days = new Set<string>();
  for (const entry of entries) {
    if (entry.isFile && entry.name?.endsWith(".md")) {
      days.add(entry.name.replace(".md", ""));
    }
  }
  return days;
}
```
Note: this marks a day as "has content" purely by file existence. If an empty file is ever written (e.g. autosave fires on an all-whitespace buffer), it will show a false dot — the planner should decide whether `saveDay` should skip writing (or should `remove()`) when the trimmed buffer is empty, to keep the calendar's dot semantics accurate to D-07 ("days with entries" vs "empty days").

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Tauri v1 `@tauri-apps/api/fs`, `@tauri-apps/api/dialog` (bundled into core API) | Tauri v2 splits filesystem/dialog into separate `@tauri-apps/plugin-fs` / `@tauri-apps/plugin-dialog` packages with an explicit capability/permission/scope model | Tauri v2 release | Any v1-era tutorial or web-search result showing `import ... from '@tauri-apps/api/fs'` or `@tauri-apps/api/dialog` is stale for this project — always cross-check import paths against the v2 plugin packages actually installed |

**Deprecated/outdated:** Tauri v1's implicit `allowlist`-only permission model — v2 requires the two-layer permission+scope capability files shown in Pattern 1.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Default journal storage location should be `$APPDATA` (a Tauri-managed, OS-appropriate app-data directory) rather than a more user-visible `$DOCUMENT/Journal` folder, and no folder-picker UI is needed in Phase 1. | Code Examples, Architectural Responsibility Map | If wrong, the capability-file scope, the code examples' `BaseDirectory`, and possibly a Phase-1 "choose folder" UI task would all need to change. This is a genuine product decision not locked in CONTEXT.md — flag to the user/planner explicitly (see Open Questions). |
| A2 | `writeTextFile`'s durability is "good enough" for D-01/D-02's crash-survival requirement without adding a write-temp-then-rename step. | Pitfall 5, Pattern 4 | If the success criterion is interpreted strictly (survives a crash *during* the write itself, not just before it), the plan needs an extra atomic-write task. |
| A3 | Cross-compiling the Windows installer from this macOS machine is not viable for regular use, and CI (GitHub Actions) is the correct mechanism instead of a local Windows VM. | Pitfall 3, Standard Stack | If the user has (or plans to acquire) a Windows machine/VM instead, the planner may prefer a simpler manual-build task over a CI pipeline setup task. |
| A4 | `react-day-picker` is the right fallback name if a calendar library is needed at all (package name sourced via WebSearch/training, not an official Tauri/React doc). | Standard Stack, Package Legitimacy Audit | Low risk — registry-verified to exist and is long-established/high-download, but per provenance rule still counts as unverified name discovery; gate behind `checkpoint:human-verify` if used. |

## Open Questions

1. **Where should journal files actually live on disk?**
   - What we know: `plugin-fs`'s default permission set covers `AppData`/`AppConfig`/etc. out of the box; `$DOCUMENT` requires the same capability-scope work but is more consistent with "readable outside the app" being an easily *discoverable* location, not just a technically-readable one.
   - What's unclear: CONTEXT.md never locked this; STACK.md mentions `plugin-dialog` for a "choose journal folder" first-run flow as a project-wide idea but doesn't scope it to Phase 1.
   - Recommendation: Default to `$APPDATA/<bundle-id>/journal/*.md` for Phase 1 (simplest, no picker UI needed) and treat "let the user choose/relocate the folder" as an explicit deferred idea for a later phase, unless the planner/user prefers `$DOCUMENT/Journal` for discoverability — either is a one-line change to the `BaseDirectory` constant, so low cost to decide later, but the capability file's scope needs to match whichever is chosen.

2. **Does "survives an app crash or force-quit mid-write" require atomic (temp+rename) writes, or is flush-on-blur/close sufficient?**
   - What we know: The debounce+flush design (D-01/D-02) already minimizes how often a write is in-flight at all; there's no documented atomicity guarantee on `writeTextFile` itself.
   - What's unclear: Whether success-criterion-3 is testing "did we lose keystrokes typed before the crash" (answered by flush-on-close) vs. "can the file itself become corrupted mid-write" (would need temp+rename).
   - Recommendation: Treat flush-on-blur/close as sufficient for MVP (matches the "invisible, no indicator" simplicity philosophy in D-03); add temp+rename only if verification/UAT surfaces an actual corruption case.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Frontend build, `npm create tauri-app` | ✓ | v26.5.0 | — |
| npm | Package management | ✓ | 11.17.0 | — |
| Rust (`rustc`/`cargo`) | Tauri core compilation (`tauri dev`/`tauri build`) | ✗ | — | **No fallback — must install via `rustup` before any Tauri work begins.** Blocking. |
| `rustup` | Rust toolchain management/updates | ✗ | — | Install alongside Rust; no viable substitute for managing the Rust version Tauri needs |
| Xcode Command Line Tools | macOS native linking for Tauri | ✓ | present at `/Library/Developer/CommandLineTools` | — |
| Windows build environment (native Windows machine, VM, or CI runner) | Producing the `.msi`/`.exe` (PLATFORM-02) | ✗ (this machine is macOS-only) | — | GitHub Actions `windows-latest` runner in a CI matrix — cross-compiling from macOS is explicitly discouraged by Tauri's own docs |

**Missing dependencies with no fallback:**
- Rust toolchain (`cargo`/`rustc`/`rustup`) — must be installed as an explicit first task before scaffolding or building anything.

**Missing dependencies with fallback:**
- Native Windows build capability — use a GitHub Actions CI matrix (`macos-latest` + `windows-latest`) instead of a local Windows machine.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Single-user local app, no auth surface in v1 (explicitly out of scope per REQUIREMENTS.md) |
| V3 Session Management | No | No sessions — local desktop app |
| V4 Access Control | No | No multi-user/role concept |
| V5 Input Validation | Yes | The day-file path must be derived only from a validated `Date` object via `date-fns` `format()`, never from arbitrary user-supplied strings, to prevent path-traversal into unintended files. The calendar UI should never let a user type a free-form filename. |
| V6 Cryptography | No | No secrets, no encryption need — plain Markdown files by design (PROJECT.md constraint) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Path traversal via a malformed date/filename reaching `plugin-fs` calls | Tampering | Always construct file paths through the single `dayFilePath(date: Date)` helper (Code Examples) — never interpolate raw strings from UI input into a `plugin-fs` path argument. Tauri's capability scope (`$APPDATA/**/*`) is a second layer of defense but should not be the *only* one. |
| Overly broad `plugin-fs` capability scope (e.g. `"$HOME/**/*"` instead of a narrow app subfolder) | Elevation of Privilege | Scope the capability file's `allow` entries as narrowly as possible — to the specific journal subfolder, not the entire `$APPDATA` or `$DOCUMENT` root, once the exact storage location decision (Open Question 1) is made. |
| Unsigned binary distribution (D-10/D-11, accepted risk) | Spoofing | Not mitigated by design (explicit product decision) — document the Gatekeeper/SmartScreen bypass in the README per D-10 so users make an informed choice; this is a deliberate, scoped acceptance of risk, not an oversight. |

## Sources

### Primary (HIGH confidence)
- npm registry (`registry.npmjs.org`) via `npm view <pkg> version` / `time.created` / `peerDependencies` — live lookups for all 15 packages listed in Standard Stack and Package Legitimacy Audit, run 2026-08-29.
- `gsd-tools query package-legitimacy check` — structured verdicts for all 15 packages, run 2026-08-29.

### Secondary (MEDIUM confidence — official docs fetched directly this session)
- [File System | Tauri v2 docs](https://v2.tauri.app/plugin/file-system/) — permission/scope model, capability file example
- [Create a Project | Tauri v2 docs](https://v2.tauri.app/start/create-project/) — scaffold command and project structure
- [window namespace | Tauri v2 docs](https://v2.tauri.app/reference/javascript/api/namespacewindow/) — `onCloseRequested` signature
- [@tauri-apps/plugin-fs | Tauri v2 docs](https://v2.tauri.app/reference/javascript/fs/) — `readTextFile`/`writeTextFile`/`readDir`/`exists`/`mkdir` signatures
- [Distribute | Tauri v2 docs](https://v2.tauri.app/distribute/) — bundle target list (`app`, `dmg`, `msi`, `nsis`)
- [macOS Code Signing | Tauri](https://v2.tauri.app/distribute/sign/macos/) — ad-hoc signing / Gatekeeper whitelist reference
- [Windows Code Signing | Tauri](https://v2.tauri.app/distribute/sign/windows/) — SmartScreen behavior for unsigned builds

### Tertiary (LOW confidence — WebSearch synthesis, not independently verified against an official doc this session)
- CodeMirror 6 debounce+flush-on-blur pattern (community blog posts, CodeMirror discuss forum threads) — verify exact `domEventHandlers`/`updateListener` API surface against installed `@codemirror/view` types during implementation.
- Windows cross-compilation-from-macOS discouragement (GitHub discussions/dev.to articles) — verify against current `v2.tauri.app/distribute/` pages if this becomes a blocking decision.
- WebView `prefers-color-scheme` propagation bug (GitHub issue threads on `tauri-apps/wry` and `tauri-apps/tauri`) — treat as a real, currently-open issue but re-check issue status at implementation time since it could be patched.
- macOS Gatekeeper / Windows SmartScreen exact end-user click-path wording ("right-click → Open", "More info → Run anyway") — corroborated across multiple independent web sources and consistent with D-10's own README wording, but not reproduced by actually building and testing an unsigned artifact this session (blocked by missing Rust toolchain).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package version/existence/age fact verified live against the npm registry this session.
- Architecture: MEDIUM — official Tauri v2 docs fetched directly for the capability/permission/window-event/fs-API surfaces; CM6 debounce pattern is community-sourced, not from an official CM6 doc page.
- Pitfalls: MEDIUM — the two most consequential pitfalls (missing Rust toolchain, Windows cross-compile limitation) were verified directly on this machine / via official Tauri guidance; the WebView theme-propagation bug and `writeTextFile` atomicity gap are sourced from GitHub issue discussions, not confirmed-current official docs.

**Research date:** 2026-08-29
**Valid until:** ~2026-09-28 (30 days — Tauri v2 and its plugin ecosystem ship frequent point releases; re-verify exact versions at plan/execute time if this research is more than a few weeks old)
