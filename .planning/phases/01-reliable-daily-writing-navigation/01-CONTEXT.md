# Phase 1: Reliable Daily Writing & Navigation - Context

**Gathered:** 2026-08-29
**Status:** Ready for planning

<domain>
## Phase Boundary

A packaged, dark-mode desktop app (macOS + Windows) that opens directly to a blank canvas for today's date. The user types freely; a double-Enter (blank line) marks the boundary between entries, though this boundary is structural only in Phase 1 (tag pills and search are Phase 2/3). Writing is autosaved durably to one plain Markdown file per day. A calendar picker lets the user jump to and freely edit any past day. Nothing here covers `#hashtag` parsing/rendering (Phase 2) or fuzzy tag search (Phase 3).

</domain>

<decisions>
## Implementation Decisions

### Autosave Durability
- **D-01:** Debounce writes to disk ~1-2 seconds after the user stops typing (not on every keystroke, not a fixed timer regardless of activity).
- **D-02:** In addition to the debounce, force an immediate save (flush) on: window blur/app-switch, navigating away to a different day, and app close/quit — so the debounce window is never the only thing standing between a keystroke and disk.
- **D-03:** No visible save indicator of any kind. Autosave is fully invisible — matches the frictionless "just type" philosophy in PROJECT.md. Trust comes from it never losing data, not from a UI element proving it.

### Entry Segmentation Look
- **D-04:** The entry boundary (double-Enter → blank line) is purely invisible in the UI — no divider, no extra spacing beyond the natural blank line itself. The blank line in the rendered Markdown file IS the boundary; nothing extra to render in Phase 1.
- **D-05:** No per-entry metadata is displayed. Only a day header (today's date) appears once at the top of the page — entries are otherwise just continuous paragraphs of text with no per-entry timestamp UI in this phase.

### Calendar & Delete UX
- **D-06:** Calendar picker is reached via both a small button/icon (e.g. a corner affordance) AND a keyboard shortcut, for both discoverability and fast keyboard-driven navigation.
- **D-07:** The calendar visually marks which days have entries (e.g. a dot/dash under dates with content) vs. empty days — requires scanning the journal folder for non-empty day files to build this index.
- **D-08:** Editing a past day works exactly like editing today's entry — the same free-text editing surface, same backspace/type mechanics, no read-only lock and no separate "delete entry" action. Removing a piece of text within a day IS just normal text editing (backspace/select-delete), identical to how it works on today's page.
- **D-09:** A confirmation dialog is required ONLY when deleting an entire day (i.e. deleting that day's `.md` file outright). Normal in-place text editing (including deleting words/entries by backspacing) never triggers a confirmation — confirmation exists specifically to guard the irreversible "delete the whole file" action, since there's no cloud backup.

### Packaging & Signing Scope
- **D-10:** Ship unsigned/self-signed builds for both macOS and Windows, with a documented workaround in the README (macOS: right-click → Open to bypass Gatekeeper; Windows: "More info" → "Run anyway" to bypass SmartScreen). No Apple Developer Program enrollment ($99/yr) and no Windows code-signing certificate purchase for v1.
- **D-11:** This holds regardless of audience size — the project is intended to be a public, free GitHub repo that anyone can clone/download and build/run themselves. "Might share it later" doesn't change the packaging output; paid signing is a decision to revisit only if this became a widely-distributed product where first-launch OS warnings meaningfully hurt adoption, which doesn't apply to a personal tool shared via GitHub.

### Claude's Discretion
- Exact placement/styling of the calendar affordance (icon, exact corner, exact keyboard shortcut binding) — implementation detail, not specified beyond "button + shortcut."
- Exact debounce duration within the ~1-2s range, and exact entry-indicator styling (dot vs. dash) on the calendar.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope & requirements
- `.planning/PROJECT.md` — core value, constraints, out-of-scope list
- `.planning/REQUIREMENTS.md` — WRITE-01..04, NAV-01..02, PLATFORM-01..03 (this phase's requirements)
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, dependencies

### Stack & architecture (informs packaging, storage, editor choices)
- `.claude/CLAUDE.md` — recommended stack (Tauri v2, React 19, CodeMirror 6, plugin-fs), what-not-to-use table, version compatibility
- `.planning/research/STACK.md` — stack research backing CLAUDE.md
- `.planning/research/ARCHITECTURE.md` — architecture research (e.g. file layout, plugin capability model)

[No SPEC.md exists for this phase — requirements come from REQUIREMENTS.md/ROADMAP.md directly.]

</canonical_refs>

<code_context>
## Existing Code Insights

Greenfield project — no `src/` or `src-tauri/` directories exist yet. No reusable assets, established patterns, or integration points to carry forward. This phase scaffolds the app from the `create-tauri-app` React+TypeScript template per the stack decisions in `.claude/CLAUDE.md`.

</code_context>

<specifics>
## Specific Ideas

- Editing an old day must feel identical to editing today — same editor surface, same interaction model, no special "past day" mode or lock. The only distinction between "today" and "a past day" is which file is loaded; the editing experience itself is unified.
- The unsigned-packaging decision is explicitly tied to this being a free, public GitHub project rather than a commercial release — this framing should carry forward if packaging comes up again in later phases.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Reliable Daily Writing & Navigation*
*Context gathered: 2026-08-29*
