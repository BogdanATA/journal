# Requirements: Journal

**Defined:** 2026-08-28
**Core Value:** Reliable tag search — no matter how a tag was typed (including typos or near-duplicates), searching it must consistently surface everything that belongs under it, with the date it was written.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Writing & Storage

- [x] **WRITE-01**: User can open the app and see a blank canvas for today's writing, ready to type immediately
- [x] **WRITE-02**: User's writing is autosaved continuously without an explicit save action
- [x] **WRITE-03**: Pressing Enter twice (a blank line) between blocks of text automatically splits them into separate, distinct entries
- [x] **WRITE-04**: Writing is saved as local plain text/Markdown files, one per day, readable outside the app without needing the app itself

### Tagging

- [ ] **TAG-01**: User can type `#hashtag` anywhere within an entry to categorize it (e.g. `#thought`)
- [ ] **TAG-02**: A single entry can carry multiple tags
- [ ] **TAG-03**: Recognized tags render as visual pills instead of raw text while writing
- [ ] **TAG-04**: While typing a tag, the app suggests a matching known tag; the suggestion is only accepted by pressing Tab — never inserted automatically by continued typing or pressing space

### Search & Tag Matching

- [ ] **SEARCH-01**: User can search for a tag (e.g. `#thought`) and see all entries tagged with it, along with the date each was written
- [ ] **SEARCH-02**: Tag search tolerates typos, matching close misspellings (e.g. `#thouhts` still finds `#thought` entries)
- [ ] **SEARCH-03**: Near-duplicate tags (e.g. `#thought` / `#thoughts`) are automatically merged into a single category
- [ ] **SEARCH-04**: Tags that don't cleanly match any known tag are placed in an "unmatched" bucket that can be filtered and corrected
- [ ] **SEARCH-05**: Clicking a search result jumps to that entry's day page so it can be edited in place

### Navigation

- [ ] **NAV-01**: User can open a calendar picker to browse to any previous day's page
- [ ] **NAV-02**: Past days are fully editable and deletable, not locked once the day has ended

### Platform & Appearance

- [ ] **PLATFORM-01**: The app runs as a native desktop application on macOS
- [ ] **PLATFORM-02**: The app runs as a native desktop application on Windows
- [x] **PLATFORM-03**: The app uses a dark-mode-only, minimal visual style

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Deferred Enhancements

- **DEFER-01**: Word count display somewhere in the UI
- **DEFER-02**: Passive "N days since your last entry" nudge (explicitly non-gamified, no streak mechanic)
- **DEFER-03**: Backup/version history for a day's file beyond OS-level undo

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multi-user accounts/login | Single-user, personal tool only |
| Cloud sync / hosted backend | Local files only, chosen explicitly over cloud storage |
| Tag directory/sidebar browsing | User wants a search-box-only workflow; a sidebar undermines that simplicity bet and duplicates the tag-taxonomy UI |
| Light mode | Dark-only for v1 |
| Linux support | Not requested — only macOS and Windows selected |
| Rich text formatting / media attachments | Contradicts the minimal notepad aesthetic and plain-text portability (embedded media breaks "readable outside the app") |
| Streaks / gamified habit tracking | Contradicts frictionless, no-pressure positioning; no reminder/streak requirement was ever scoped |
| Templates / writing prompts | Contradicts the blank-canvas philosophy — the blank page is the feature |
| Explicit export feature (export button/menu) | Entries are already plain Markdown files on disk — nothing to export from |
| Nested/hierarchical tags (e.g. `#food/french`) | Conflicts with the near-duplicate auto-merge model; introduces a second, incompatible categorization axis |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| WRITE-01 | Phase 1 | Complete |
| WRITE-02 | Phase 1 | Complete |
| WRITE-03 | Phase 1 | Complete |
| WRITE-04 | Phase 1 | Complete |
| NAV-01 | Phase 1 | Pending |
| NAV-02 | Phase 1 | Pending |
| PLATFORM-01 | Phase 1 | Pending |
| PLATFORM-02 | Phase 1 | Pending |
| PLATFORM-03 | Phase 1 | Complete |
| TAG-01 | Phase 2 | Pending |
| TAG-02 | Phase 2 | Pending |
| TAG-03 | Phase 2 | Pending |
| SEARCH-01 | Phase 3 | Pending |
| SEARCH-02 | Phase 3 | Pending |
| SEARCH-03 | Phase 3 | Pending |
| SEARCH-04 | Phase 3 | Pending |
| SEARCH-05 | Phase 3 | Pending |
| TAG-04 | Phase 3 | Pending |

**Coverage:**

- v1 requirements: 18 total
- Mapped to phases: 18 (100%)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-28*
*Last updated: 2026-08-28 after roadmap creation*
