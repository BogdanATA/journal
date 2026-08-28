# Journal

## What This Is

A minimal desktop journaling app for macOS and Windows that opens to a blank, notepad-style canvas each day. You just type — pressing Enter twice (a blank line) marks the boundary between one thought and the next, so free-flowing writing automatically splits into distinct entries with no extra effort. Any entry can carry one or more inline `#hashtags` (e.g. `#thought`, `#projectIdea`) to categorize it; tags render as visual pills as you type. A search box finds everything under a tag — tolerating typos and near-duplicate tags — and shows matches with their dates, jumping straight to that day's page to edit in place.

## Core Value

Reliable tag search: no matter how a tag was typed (including typos or near-duplicates), searching it must consistently surface everything that belongs under it, with the date it was written.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Blank-canvas daily writing view that opens to today automatically
- [ ] Double-Enter (blank line) detected as the boundary between separate entries/sections
- [ ] Inline `#hashtag` detection anywhere within a block of text; multiple tags per entry allowed
- [ ] Tags render as visual pills while typing, not left as raw plain text
- [ ] Non-forcing tag autocomplete: suggests a known tag after `#`, only accepted via Tab — typing past it or pressing space dismisses the suggestion without inserting it
- [ ] Fuzzy/typo-tolerant tag search (e.g. `#thouhts` still finds `#thought` entries)
- [ ] Near-duplicate tags (e.g. `#thought` / `#thoughts`) are merged into a single category automatically
- [ ] "Unmatched" bucket for tags that don't cleanly match any known tag — filterable and editable so they can be corrected later
- [ ] Search results show matching entries with their dates; clicking a result jumps to that day's page to edit in place
- [ ] Calendar picker to browse to any previous day's page
- [ ] Past days are fully editable and deletable, not locked once the day ends
- [ ] Entries stored as local plain text/Markdown files, readable outside the app (not a proprietary format)
- [ ] Dark-mode-only visual style, minimal and notepad-like
- [ ] Runs as a native-feeling desktop app on both macOS and Windows

### Out of Scope

- Multi-user accounts/login — single-user, personal tool only
- Cloud sync / hosted backend — local files only, chosen explicitly over cloud storage
- A home view/sidebar listing all tags — user wants just a search box, not a tag directory
- Light mode — dark-only for v1
- Linux support — not requested; only macOS and Windows selected

## Context

Replaces scattered note-taking in a general-purpose notes app, where thoughts and ideas get lost with no reliable way to find them later by category. This is a greenfield project — no existing codebase.

The tech stack for cross-platform desktop delivery (e.g. Electron vs. Tauri) was deliberately deferred — user asked to settle it during research/roadmap rather than during questioning, since it's a build detail that doesn't change app behavior.

## Constraints

- **Platform**: Desktop app, macOS + Windows — needs one codebase covering both, not two native apps
- **Storage**: Local plain text/Markdown files, no cloud — entries must be portable and readable in any text editor outside the app
- **UX**: Autocomplete must never auto-insert on its own — only accepted via explicit Tab press, per user's explicit rejection of "forcing" autocomplete UX seen in other apps
- **Search**: Must tolerate typos and merge near-duplicate tags — exact-string tag matching alone is insufficient for the core value

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Desktop app over web/hosted | Local file storage, no server/backend needed, feels like a native notepad | — Pending |
| Local plain text/Markdown files over a database | Portable, human-readable without the app, no cloud dependency | — Pending |
| Fuzzy tag matching + "unmatched" review bucket | Fast, unedited typing shouldn't require perfect tag spelling; still needs a way to catch and fix stragglers | — Pending |
| Non-forcing Tab-to-accept autocomplete | User explicitly rejected autocomplete that inserts without confirmation | — Pending |
| Dark mode only (v1) | User preference; simpler v1 scope | — Pending |
| Electron vs. Tauri (or other) left open | Doesn't change app behavior — deferred to research/roadmap phase | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-28 after initialization*
