# Feature Research

**Domain:** Minimal cross-platform desktop journaling / daily-notes app
**Researched:** 2026-08-28
**Confidence:** MEDIUM (cross-checked web sources on Day One, Obsidian, Bear, Apple Notes, Diarium, Journey, Stoic; no official vendor API docs needed — these are consumer product feature sets, verified across multiple independent write-ups)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any writing/note app. Missing these makes the app feel broken or unsafe to use, even though none of them are this app's differentiator.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Autosave (no explicit save action) | Every notepad-style and journaling app saves continuously (Chronicle, Diarium, browser notepads); users will lose trust instantly if a crash loses text | LOW | Debounced write-to-disk on keystroke pause; this app's plain-text local storage makes this simple (no server round-trip) |
| Crash/data-loss protection | Same expectation as autosave — local file must never be corrupted by a crash mid-write | LOW-MEDIUM | Write-to-temp-then-rename (atomic write) pattern; not explicitly scoped in PROJECT.md, should be an implementation default, not a "feature" decision |
| Undo/redo within the current editing session | Every text editor has it; its absence in a writing-focused app is jarring | LOW | Native to any standard text-editing widget/textarea component — comes for free with most rich-text or contenteditable components; still worth confirming for the chosen editor library |
| Search-as-you-type | Day One, Bear, Obsidian, Apple Notes all filter live as you type in the search box; a submit-to-search flow reads as dated | LOW-MEDIUM | PROJECT.md scopes fuzzy tag search but doesn't say live-filter vs submit; should default to live-filter given "search box only" UX (no sidebar to fall back on) |
| Calendar/date navigation | PROJECT.md already scopes a calendar picker — flagging only to confirm it's non-negotiable: Day One's calendar view and Obsidian's daily-notes date picker are the standard pattern here | LOW-MEDIUM | Already in active scope |
| Cross-platform native feel (macOS + Windows) | PROJECT.md already scopes this; noting it's table stakes because a web-wrapper that looks foreign on either OS will read as broken, not minimal | MEDIUM | Framework choice (Electron/Tauri) affects this significantly — see STACK.md |
| Human-readable / non-proprietary storage | PROJECT.md already scopes plain text/Markdown; flagging because it's also a trust signal users explicitly look for (no lock-in fear) | LOW | Already in active scope |

**Explicitly NOT table stakes for this app** (present in competitors, but PROJECT.md already excludes or the app's model makes them irrelevant — listed so the roadmap doesn't accidentally re-add them):

| Feature | Where it's common | Why it doesn't apply here |
|---------|--------------------|-----------------------------|
| Word count | Chronicle, Diarium (daily goal tracking) | No goal/streak mechanic in this app's model; word count is trivial to add later if requested but isn't implied by any scoped requirement |
| Streaks / calendar heatmap of activity | Day One, Diarium, Stoic — a core habit-formation hook in nearly every journaling app | Explicitly absent from PROJECT.md scope; the app opens to today automatically regardless of streak, so there's no "did I write yesterday" gamification loop being built |
| Reminders / notifications to write | Day One (programmable), Journey, Diarium, Stoic (all lead with this) | Not scoped; app has no background process model implied (calendar picker is pull, not push) |
| Export (PDF/Markdown/plain text bundle) | Day One, Diarium, Stoic all list export as a feature — but only meaningful when the native format is proprietary or app-locked | **Not needed as a "feature"** — entries are already plain Markdown files on disk from day one, so there's nothing to "export from." This is a structural advantage, not a gap. Worth stating explicitly in UX copy/docs so users don't go looking for an export button that doesn't need to exist |
| Rich text formatting / multiple journals / media attachments / metadata (weather, location) / encryption / multi-device sync | Day One's full feature set | Explicitly out of scope (single-user, no cloud, "minimal notepad aesthetic") — do not accidentally reintroduce during roadmap phase design |

### Differentiators (Competitive Advantage)

Features that set this app apart. Should map directly to the Core Value in PROJECT.md: reliable tag search regardless of how a tag was typed.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Blank-line auto-segmentation into entries | No competitor found does this. Day One/Obsidian/Bear all use one text blob per note/day; splitting is manual (separate notes) or absent. This app turns free-flowing stream-of-consciousness typing into structured, individually taggable/searchable units with zero explicit action from the user | MEDIUM | Core mechanic; needs a clear, deterministic parsing rule (what counts as "blank line" — one Enter vs two, trailing whitespace, etc.) and needs to be visually legible (entries should look separated, not just logically separated) |
| Typo-tolerant fuzzy tag search | Confirmed via research: Obsidian, Bear, Apple Notes, Day One all use **exact-string** tag matching with plain autocomplete. None do edit-distance/fuzzy matching on tags. This is a genuine, verified product gap | MEDIUM-HIGH | Standard technique (Levenshtein/Damerau-Levenshtein, or a JS fuzzy-search lib) but applying it *specifically to a controlled tag vocabulary* rather than full-text search is a narrower, well-scoped problem — lower risk than it sounds |
| Automatic near-duplicate tag merging | No competitor auto-merges `#thought` and `#thoughts` into one canonical tag. Bear's nested tags and Obsidian's plugins require the user to manually structure the hierarchy; this app infers it | HIGH | Highest-complexity, highest-differentiation feature. Needs a similarity threshold, a canonicalization strategy (which spelling "wins"), and must avoid false-positive merges (e.g. `#work` and `#worry` should NOT merge) — flag for deeper research at roadmap/phase level |
| "Unmatched tags" review bucket | No competitor has anything equivalent — closest analogue is nothing; even fuzzy-search products (Algolia, Meilisearch) surface fuzzy results but don't ask the user to reconcile a canonical taxonomy after the fact | MEDIUM | This is what makes the fuzzy-merge safe to ship (imperfect auto-merge + human review loop beats either pure-exact or pure-auto-merge alone) |
| Non-forcing Tab-to-accept autocomplete | Obsidian and Apple Notes autocomplete tags but generally insert/confirm more eagerly (space-activates in Apple Notes); this app's explicit "never auto-insert without Tab" is a smaller but real UX differentiator for users who found other apps' autocomplete "forcing" | LOW-MEDIUM | Already scoped in PROJECT.md; noted here because it reinforces the "frictionless but not presumptuous" positioning shared with the blank-line segmentation feature |
| Search box only, no tag directory/sidebar | Obsidian, Bear, Apple Notes, Day One all provide a browsable tag list/sidebar as the primary navigation. This app deliberately omits it | LOW (it's a subtraction) | This is a positioning bet, not a technical feature — worth flagging as a real risk: if fuzzy search + merging isn't reliable, users have no fallback way to browse tags. This raises the stakes on the fuzzy-match quality bar (see PITFALLS.md) |

### Anti-Features (Commonly Requested, Often Problematic)

Features that appear in nearly every competitor and will feel like "obvious gaps" during roadmap review, but actively work against this app's minimal, single-purpose positioning.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Tag directory / sidebar browsing | Every competitor researched (Bear, Apple Notes, Obsidian) has one; feels like an obvious omission | PROJECT.md explicitly excludes it; adding it undermines the "search box only" simplicity bet and doubles the tag-taxonomy UI surface to maintain (sidebar list must also reflect fuzzy-merge state) | Trust the fuzzy search box; if users can't find a tag, that's a search-quality bug to fix, not a reason to add a directory |
| Cloud sync / multi-device | Nearly universal in commercial journaling apps (Day One, Diarium, Journey) | Explicitly out of scope; reintroducing it adds accounts, conflict resolution, and backend infrastructure that contradicts "local files only" | User can sync the plain-text folder themselves via Dropbox/iCloud Drive/Syncthing if they want — app doesn't need to know |
| Rich text / media attachments (photos, audio, drawings) | Day One's headline features | Contradicts "minimal notepad aesthetic" and plain-text portability requirement (embedding media in a `.md` file breaks the "readable outside the app" goal) | If ever needed, image links to a sibling assets folder — but not scoped for v1 |
| Streaks / gamified habit tracking | Nearly every commercial journaling app leads with this for retention | This is a single-user personal tool, not a habit-formation product; adding pressure/guilt mechanics contradicts "frictionless" positioning and the explicit lack of any reminder/streak requirement | If desired later, a passive "last entry was N days ago" note is far lower-risk than a streak counter with loss-aversion framing |
| Templates / prompts | Day One, Diarium, Journey all offer these | Adds structure to what's explicitly meant to be a blank canvas — the whole point of this app is *removing* friction/ceremony from starting to write | None needed — blank page IS the feature |
| Export feature (explicit export button/menu) | Standard checklist item for "serious" note apps | Files are already plain Markdown on disk — building an "export" UI implies the native format isn't already portable, which contradicts a core design decision | Document that entries are already `.md` files in a known folder; no export UI needed |
| Nested/hierarchical tags (Bear-style `#food/french`) | Power users expect this from Bear/Obsidian | Directly conflicts with the fuzzy near-duplicate-merge model — a nesting syntax introduces a second, incompatible categorization axis (is `#food/french` a typo-variant of `#food` or a distinct child category?) and complicates the "unmatched" bucket logic | Keep tags flat; let fuzzy matching + merge review handle the "should these be one category" question implicitly, rather than asking users to design a hierarchy up front |

## Feature Dependencies

```
Blank-canvas daily writing view (opens to today)
    └──requires──> Local plain-text file storage (one file/entry-set per day)

Blank-line auto-segmentation into entries
    └──requires──> Blank-canvas daily writing view
    └──enables──> Inline #hashtag detection scoped per-entry (not per-day)

Inline #hashtag detection + pill rendering
    └──requires──> Blank-line auto-segmentation (tags need an entry boundary to attach to)
    └──enables──> Tab-to-accept autocomplete (needs a known-tag list to suggest from)

Tab-to-accept autocomplete
    └──requires──> A running index/list of previously used tags across all days

Fuzzy/typo-tolerant tag search
    └──requires──> Inline #hashtag detection (tags must exist to search)
    └──requires──> An index of all tags across all days (same index autocomplete uses)

Near-duplicate tag auto-merging
    └──requires──> Fuzzy/typo-tolerant matching (same similarity engine, applied proactively vs. reactively)
    └──enables──> "Unmatched tags" review bucket (the bucket catches what auto-merge declines to merge)

"Unmatched tags" review bucket
    └──requires──> Near-duplicate tag auto-merging (bucket = output of a similarity threshold decision)

Search results jump-to-day
    └──requires──> Fuzzy/typo-tolerant tag search
    └──requires──> Calendar picker / per-day file addressing

Calendar picker (browse past days)
    └──requires──> Local plain-text file storage (one file per day to navigate to)

Nested/hierarchical tags ──conflicts──> Near-duplicate tag auto-merging
Tag directory/sidebar ──conflicts──> "search box only" positioning (explicitly excluded)
```

### Dependency Notes

- **Fuzzy search and autocomplete share one tag index.** Building the tag-index/aggregation layer (scan all daily files, extract tags, dedupe) is a single piece of infrastructure that both non-forcing autocomplete and fuzzy search depend on. It should be planned as one phase-level building block, not duplicated.
- **Auto-merge and the unmatched bucket are two outputs of the same decision, not two features.** Whatever similarity engine decides "close enough to merge," the *same* threshold check produces the unmatched bucket as its "no" branch. Plan them together; do not sequence unmatched-bucket UI far away from the merge logic itself.
- **Blank-line segmentation is a hard prerequisite for tag-to-entry association.** Tags need to belong to a specific entry (for "jump to that day's page to edit in place" to feel precise, not just day-level). Segmentation logic must land before tag-pill rendering is meaningful, even though both could technically be built in parallel on paper.
- **Nested tags conflict with the merge model.** If nested/hierarchical tags are ever considered post-v1, they need a design decision on how they interact with fuzzy merging — don't add nesting as a "quick win" later without revisiting the merge logic.

## MVP Definition

### Launch With (v1)

Everything already in PROJECT.md's Active Requirements is the MVP; nothing found in this research should be added to that list. Restated in dependency order for phase planning:

- [ ] Local plain-text/Markdown storage, one addressable unit per day — foundation everything else depends on
- [ ] Blank-canvas daily writing view, opens to today automatically
- [ ] Blank-line (double Enter) auto-segmentation into entries
- [ ] Inline `#hashtag` detection + pill rendering, multiple tags per entry
- [ ] Tag index (all tags across all days) — shared infrastructure for autocomplete + search
- [ ] Non-forcing Tab-to-accept tag autocomplete
- [ ] Fuzzy/typo-tolerant tag search
- [ ] Near-duplicate tag auto-merge + "unmatched" review bucket
- [ ] Search results with dates, jump-to-day-in-place editing
- [ ] Calendar picker to browse/edit any past day
- [ ] Dark-mode-only minimal styling
- [ ] macOS + Windows desktop packaging

### Add After Validation (v1.x)

Not requested, but flagged by this research as plausible near-term additions if user feedback demands them — none should be pulled into v1 without a signal:

- [ ] Word count (trigger: users ask "how much have I written")
- [ ] "Last entry was N days ago" passive nudge, non-gamified (trigger: users report forgetting to open the app — a lower-pressure alternative to streaks)
- [ ] Explicit backup/versioned-history beyond OS-level undo (trigger: a real data-loss incident report, not speculative)

### Future Consideration (v2+)

Deliberately deferred; revisit only if the core value (reliable fuzzy tag search) is validated and users are asking for more:

- [ ] Tag directory/sidebar as an *optional* power-user view (trigger: fuzzy search proves insufficiently discoverable for large tag vocabularies — but try improving search first)
- [ ] Manual tag merge/rename UI as a complement to automatic merging (trigger: auto-merge false-positives or false-negatives become a recurring complaint)
- [ ] Cross-device sync via user-provided folder (e.g. pointing the app at a Dropbox/iCloud folder) — NOT app-managed cloud sync, just "storage location is configurable" (trigger: explicit multi-device request)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Blank-canvas daily writing view | HIGH | LOW | P1 |
| Blank-line auto-segmentation | HIGH | MEDIUM | P1 |
| Inline hashtag detection + pills | HIGH | MEDIUM | P1 |
| Non-forcing autocomplete | MEDIUM | LOW-MEDIUM | P1 |
| Fuzzy tag search | HIGH | MEDIUM-HIGH | P1 |
| Near-duplicate auto-merge | HIGH | HIGH | P1 |
| Unmatched tags bucket | MEDIUM-HIGH | MEDIUM | P1 |
| Calendar picker | MEDIUM | LOW-MEDIUM | P1 |
| Local plain-text storage | HIGH | LOW | P1 |
| Autosave / crash safety | HIGH | LOW-MEDIUM | P1 (implicit table stakes) |
| Dark mode styling | MEDIUM | LOW | P1 |
| Word count | LOW | LOW | P3 |
| "Days since last entry" nudge | LOW-MEDIUM | LOW | P3 |
| Manual tag merge/rename UI | MEDIUM | MEDIUM | P3 |
| Tag directory/sidebar | LOW (conflicts with positioning) | MEDIUM | P3 (only if search fails) |
| Streaks/reminders | LOW (out of scope) | MEDIUM | Excluded |
| Export UI | LOW (redundant with plain-text storage) | LOW | Excluded |
| Cloud sync | LOW (out of scope) | HIGH | Excluded |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Day One | Obsidian (daily notes) | Bear | Apple Notes | Our Approach |
|---------|---------|--------------------------|------|--------------|--------------|
| Entry structure | One entry per save action, browsed as a list | One file per day, freeform within | One note per topic, tagged | One note per topic, tagged | **Novel:** one file per day, auto-split into multiple entries by blank line — no competitor does this |
| Tagging | Exact-string hashtags + favorites | Exact-string tags, nested via `/`, plugin-extensible | Exact-string hashtags, infinite nesting via `/` | Exact-string hashtags, single-token only | Exact-string entry, but **fuzzy-matched + auto-merged** at search/index time — no competitor does this |
| Tag autocomplete | Standard suggest-as-you-type | Standard suggest, generally accepts more eagerly | Standard suggest | Space activates the tag immediately | Non-forcing, Tab-only accept — closer to a "suggestion" than an "insertion" |
| Tag browsing | Sidebar tag list + favorites | Sidebar/graph view, plugin-extensible | Sidebar with nested tag tree | Dedicated Tags Browser view | **Deliberately excluded** — search box only |
| Search | Keyword + tag filters, exact match | Full-text + tag search, exact match, powerful query syntax via plugins | Keyword + phrase + exclusion + special @-tags, exact match | Keyword + tag search via search bar or Tags Browser | Fuzzy/typo-tolerant on tags specifically, with near-duplicate merge and an unmatched-tag review bucket |
| Storage | Proprietary DB (with export) | Plain Markdown files (native) | Proprietary DB (with export) | iCloud-synced proprietary store | Plain Markdown/text files (native, like Obsidian) |
| Streaks/reminders | Yes, prominent | No (not journal-specific) | No | No | Explicitly excluded |
| Platform | iOS/Android/Mac/Web/Watch | Cross-platform (Electron-based) | Mac/iOS only (no Windows) | Apple ecosystem only (no Windows) | macOS + Windows required — rules out Bear/Apple Notes as direct competitors on distribution alone |

## Sources

- [Features of Day One App](https://dayoneapp.com/features/) — MEDIUM confidence (official vendor page, cross-checked against independent reviews)
- [10 Features Which Make Day One a Great Journaling App](https://medium.com/illumination/10-features-which-make-day-one-a-great-journaling-app-e0fa57ca55e4) — MEDIUM confidence
- [Day One: Daily Journal & Diary | Review 2026 — Reflection](https://www.reflection.app/journaling-apps/day-one) — MEDIUM confidence
- [Bear Tips: Organize notes with tags and infinite nested tags](https://blog.bear.app/2017/08/bear-tips-organize-notes-with-tags-and-infinite-nested-tags/) — MEDIUM confidence (official Bear blog)
- [How to search notes in Bear: Go beyond keywords](https://blog.bear.app/2022/05/how-to-search-notes-in-bear-go-beyond-keywords/) — MEDIUM confidence (official Bear blog)
- [How to Make Nested Tags — Bear FAQ](https://bear.app/faq/nested-tags/) — MEDIUM confidence (official)
- [Organize your notes with tags on iPhone — Apple Support](https://support.apple.com/guide/iphone/organize-with-tags-iphedddbfdf9/ios) — MEDIUM confidence (official Apple docs)
- [iOS 15: How to Use Tags to Organize Your Notes — MacRumors](https://www.macrumors.com/how-to/use-tags-organize-notes-ios/) — MEDIUM confidence
- [The 4 best journal apps — Zapier](https://zapier.com/blog/best-journaling-apps/) — MEDIUM confidence (comparison across Day One, Journey, Diarium, Stoic)
- [Diarium Journal App](https://diariumapp.com/en) — MEDIUM confidence (official vendor page)
- [Obsidian plugins tagged #daily-note — Obsidian Stats](https://www.obsidianstats.com/tags/daily-note) — MEDIUM confidence (community plugin directory)
- [There's more to fuzzy search than correcting typos — Algolia](https://www.algolia.com/blog/engineering/fuzzy-search-101) — MEDIUM confidence (industry search-vendor engineering blog, general fuzzy-search technique background, not journaling-specific)
- [What is fuzzy search? — Typesense](https://typesense.org/learn/fuzzy-search/) — MEDIUM confidence (same, general technique background)

---
*Feature research for: minimal cross-platform desktop journaling app*
*Researched: 2026-08-28*
