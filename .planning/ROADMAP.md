# Roadmap: Journal

## Overview

Journal ships as three vertical slices, each a usable, demoable increment of the same app rather than a horizontal technical layer. Phase 1 delivers the smallest complete loop — open to today, write freely with automatic entry segmentation, never lose a word, and browse/edit any past day — as an installable native app on macOS and Windows, unsigned for v1 with a documented first-launch bypass (D-10/D-11). This retires the highest-severity risks first (data loss, cross-platform packaging) while producing something genuinely usable on day one. Phase 2 layers inline `#hashtag` support with live visual pills on top of that stable writing surface. Phase 3 delivers the app's actual core value: a tag matching system tolerant of typos and near-duplicates that powers both search (find anything under a tag, however it was typed, with its date) and non-forcing Tab-to-accept suggestions while typing — sequenced last because it is the highest-uncertainty, highest-complexity piece, and because it depends on a stable editor and a real tag vocabulary that only the first two phases can supply.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Reliable Daily Writing & Navigation** - A packaged, dark-mode desktop app that opens to today, autosaves durably, and lets users browse/edit/delete any past day
- [ ] **Phase 2: Inline Tagging with Visual Pills** - Typed `#hashtags` render as visual pills, supporting multiple tags per entry
- [ ] **Phase 3: Reliable Tag Search & Matching** - Typo-tolerant, near-duplicate-merging tag search with an unmatched-tag review bucket and Tab-to-accept suggestions

## Phase Details

### Phase 1: Reliable Daily Writing & Navigation

**Goal**: User can open the app to a blank page for today, write freely with entries automatically segmented by blank lines, trust that nothing is ever lost, and navigate to/edit/delete any past day — as an installable native app on macOS and Windows (unsigned for v1 with a documented first-launch bypass, per D-10/D-11) with the dark, minimal notepad look.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: WRITE-01, WRITE-02, WRITE-03, WRITE-04, NAV-01, NAV-02, PLATFORM-01, PLATFORM-02, PLATFORM-03
**Success Criteria** (what must be TRUE):

  1. User opens the app and lands on a blank canvas for today's date, ready to type immediately.
  2. Typing freely and pressing Enter twice visibly splits the text into separate entries with no manual action required.
  3. Typed content is saved automatically and durably (survives an app crash or force-quit mid-write) as one plain Markdown file per day, readable in any text editor outside the app.
  4. User can open a calendar picker, jump to any previous day, and freely edit or delete that day's content — nothing is locked once the day ends.
  5. The installed app launches as a native-feeling app on both macOS and Windows with a dark-mode-only, minimal visual style.

**Plans:** 4/4 plans executed

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Walking skeleton: Rust toolchain, Tauri + React scaffold, storage-location decision, and the end-to-end write-to-disk tracer

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Durability: flush on quit and day-navigation, serialized writes, byte-fidelity round-trip, empty-day file semantics
- [x] 01-04-PLAN.md — Two-OS CI build matrix producing unsigned macOS and Windows installers, plus the README bypass docs

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Calendar picker with content dots, past-day editing, and confirmed delete-day

**UI hint**: yes

### Phase 2: Inline Tagging with Visual Pills

**Goal**: User can categorize any entry by typing `#hashtags` anywhere in the text and see them rendered immediately as clear visual pills instead of raw text, with multiple tags allowed per entry.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: TAG-01, TAG-02, TAG-03
**Success Criteria** (what must be TRUE):

  1. Typing `#word` anywhere inside an entry turns it into a recognizable visual pill as soon as it's recognized.
  2. A single entry can carry more than one tag, and each renders as its own distinct pill.
  3. Pills coexist correctly with normal editing — cursor movement, undo/redo, copy/paste — without corrupting or desyncing from the underlying plain text.

**Plans**: TBD
**UI hint**: yes

### Phase 3: Reliable Tag Search & Matching

**Goal**: No matter how a tag was typed — exact, typo'd, or a near-duplicate of an existing tag — searching or typing it reliably surfaces or suggests the right canonical tag, with anything genuinely ambiguous caught in a reviewable bucket rather than silently misfiled. This is the app's stated core value.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: SEARCH-01, SEARCH-02, SEARCH-03, SEARCH-04, SEARCH-05, TAG-04
**Success Criteria** (what must be TRUE):

  1. Searching a known tag (e.g. `#thought`) returns every entry tagged with it, each showing its date; clicking a result jumps straight to that entry's day page, editable in place.
  2. Searching a typo'd variant (e.g. `#thouhts`) still returns the entries filed under the correct tag.
  3. Near-duplicate tags (e.g. `#thought` / `#thoughts`) are automatically merged into a single searchable category.
  4. Tags that don't cleanly match any known tag land in a filterable, correctable "unmatched" bucket instead of being silently lost or misfiled.
  5. While typing a `#tag`, the app suggests a matching known tag that is inserted only via an explicit Tab press — never by continued typing or pressing space.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Reliable Daily Writing & Navigation | 4/4 | In Progress|  |
| 2. Inline Tagging with Visual Pills | 0/TBD | Not started | - |
| 3. Reliable Tag Search & Matching | 0/TBD | Not started | - |
