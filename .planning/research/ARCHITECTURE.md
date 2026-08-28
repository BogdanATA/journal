# Architecture Research

**Domain:** Minimal cross-platform desktop journaling app (plain-text editor + tag search)
**Researched:** 2026-08-28
**Confidence:** MEDIUM (web-sourced, cross-checked across multiple independent sources; no official case study of this exact combination found)

## Standard Architecture

### System Overview

This app is best modeled as a **local-first desktop app** with a single plain-text file store as the durable source of truth, and a derived, disposable SQLite index that exists purely to make search fast. The index is a cache, not a database of record — it can be deleted and rebuilt from the files at any time with no data loss. This is the same pattern used by note-taking tools built on "files as truth" (Obsidian-style) rather than "database as truth" (Notion-style), and it directly satisfies the project's constraint that entries must remain portable and readable outside the app.

```
┌───────────────────────────────────────────────────────────────────────┐
│                         Renderer / UI (webview)                        │
├───────────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌────────────────┐  ┌───────────────────────┐     │
│  │ Editor Canvas │  │ Search Panel   │  │ Calendar / Day Nav    │     │
│  │ (CodeMirror 6)│  │ (query + list) │  │                       │     │
│  └───────┬───────┘  └───────┬────────┘  └───────────┬───────────┘     │
│          │                  │                        │                │
│  ┌───────┴──────────────────┴────────────────────────┴───────────┐    │
│  │              Parser / Entry Model (pure JS/TS, in-process)      │    │
│  │  - blank-line entry segmentation                                │    │
│  │  - #hashtag extraction per entry                                │    │
│  │  - pill decoration + ghost-text suggestion state                │    │
│  └───────────────────────────┬──────────────────────────────────┘    │
├──────────────────────────────┼────────────────────────────────────────┤
│                        IPC boundary (invoke/commands)                  │
├──────────────────────────────┼────────────────────────────────────────┤
│  ┌───────────────┐  ┌────────┴────────┐  ┌────────────────────────┐   │
│  │ File I/O      │  │ Index Sync       │  │ Tag Matcher            │   │
│  │ (read/write/  │  │ Service          │  │ (exact + fuzzy +       │   │
│  │  watch .md)   │  │ (file → SQLite)  │  │  near-dup merge logic) │   │
│  └───────┬───────┘  └────────┬─────────┘  └───────────┬────────────┘   │
├──────────┼───────────────────┼────────────────────────┼────────────────┤
│          ▼                   ▼                        ▼                │
│  ┌────────────────┐   ┌──────────────────────────────────────────┐    │
│  │ ~/Journal/      │   │ SQLite: entries, tags, tag_aliases,       │    │
│  │  YYYY-MM-DD.md  │   │  entries_fts (FTS5 trigram), unmatched    │    │
│  │  (source of     │   │  (rebuildable cache/index)                │    │
│  │   truth)        │   │                                            │    │
│  └────────────────┘   └──────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Editor Canvas | Renders plain text, keystroke capture, hosts decorations (pills, ghost text) | CodeMirror 6 (`EditorView` + `EditorState`), not contentEditable or a rich-text framework |
| Parser / Entry Model | Pure, synchronous, no-I/O logic: splits buffer into entries on blank-line boundaries, extracts `#tag` tokens per entry, computes decoration ranges | Plain TS module, runs in the renderer on every doc change; unit-testable in isolation from the editor |
| Pill/Ghost-text Decoration Layer | Turns parser output into CodeMirror `Decoration.mark()` (pills) and `Decoration.widget()` (ghost text) without mutating the underlying text | `ViewPlugin` that recomputes decorations on `update.docChanged` |
| File I/O | Reads/writes the day's `.md` file, debounced autosave, file watching for external edits | Tauri fs plugin (`@tauri-apps/plugin-fs`) invoked from renderer, or Rust `tauri::command`s |
| Index Sync Service | Keeps SQLite in sync with files: on save, re-parses the changed file and upserts its rows; on startup, reconciles by mtime/hash to catch external edits | Rust-side (Tauri) or a background JS worker; owns the only write path into SQLite |
| Tag Matcher | Exact lookup + fuzzy/typo-tolerant matching + near-duplicate merge decisions; routes unmatchable tags to a review bucket | FTS5 trigram for candidate retrieval + string-similarity re-rank (Jaro-Winkler/Levenshtein) for final scoring and merge decisions |
| Search Panel | Takes a query, calls Tag Matcher, renders dated results, jump-to-day navigation | Renderer component, read-only consumer of the index |
| Calendar / Day Nav | Lists which day-files exist, opens one into the Editor Canvas | Reads file directory listing or `entries` table `DISTINCT date` |

## Recommended Project Structure

```
src/
├── editor/                  # Editor canvas and its CodeMirror extensions
│   ├── extensions/
│   │   ├── entryParser.ts   # blank-line segmentation (pure, testable)
│   │   ├── tagDecoration.ts # #hashtag → pill Decoration.mark()
│   │   └── ghostText.ts     # inline suggestion widget + Tab-accept keymap
│   └── EditorCanvas.tsx     # mounts CodeMirror, wires autosave debounce
├── parser/                  # Shared parsing logic (used by editor AND index sync)
│   ├── segmentEntries.ts    # text → Entry[] on blank-line boundaries
│   └── extractTags.ts       # Entry → tag[] via regex
├── search/
│   ├── tagMatcher.ts        # exact + fuzzy lookup, merge decisions
│   └── SearchPanel.tsx
├── storage/
│   ├── dayFile.ts           # path convention, read/write, frontmatter (if any)
│   └── fileWatcher.ts       # detect external edits, trigger re-index
├── index/                   # SQLite-backed derived index (rebuildable)
│   ├── schema.sql
│   ├── indexSync.ts         # file → row upsert, startup reconciliation
│   └── db.ts
├── calendar/
│   └── CalendarNav.tsx
└── app/                     # shell: routing between day view / search
```

### Structure Rationale

- **`parser/` is separated from `editor/`:** the same blank-line-segmentation and tag-extraction logic must run twice — once live in the editor (for pill rendering) and once in the index sync service (for search). Keeping it as a pure, dependency-free module (no CodeMirror types, no SQLite types) lets both consumers use the identical rules, which is critical: if the editor's idea of "an entry" ever drifts from the indexer's idea of "an entry," pill highlighting and search results will silently disagree.
- **`storage/` vs `index/` are distinct:** `storage/` owns the actual `.md` files (the truth); `index/` owns the SQLite cache (a derived, disposable artifact). This boundary is what makes "rebuild the index from files" a real, safe, always-available recovery action.
- **`search/tagMatcher.ts` is the only place fuzzy logic lives:** both the autocomplete-suggestion source (Tab-to-accept) and the search box's typo tolerance should call the same matcher so that "what autocomplete suggests" and "what search finds" stay consistent.

## Architectural Patterns

### Pattern 1: Files as source of truth, SQLite as rebuildable index

**What:** The `.md` files on disk are the only durable, authoritative data. SQLite (entries, tags, tag_aliases, FTS5 virtual table) is populated *from* the files and can be deleted and regenerated at any time by re-parsing every file. The app never writes app-state into the files that the index doesn't also know how to reconstruct from parsing.

**When to use:** Any local-first app whose core promise is "your data is a portable text file, not locked in a database." This is exactly the project's constraint.

**Trade-offs:** Pro — data survives index corruption/schema changes trivially (`rm index.db` + rebuild); files remain human-editable outside the app. Con — every index-affecting mutation must flow through a defined "sync" step; you cannot treat SQLite as free-form app state, since anything not derivable from files will be lost on rebuild.

**Example:**
```typescript
// index/indexSync.ts
async function syncFileToIndex(db: Database, filePath: string, dateKey: string) {
  const text = await readFile(filePath);
  const entries = segmentEntries(text);       // from parser/, shared with editor
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM entries WHERE date = ?', dateKey);
    for (const entry of entries) {
      const entryId = await tx.run(
        'INSERT INTO entries (date, text, position) VALUES (?, ?, ?)',
        dateKey, entry.text, entry.index
      );
      for (const rawTag of extractTags(entry.text)) {
        const tagId = await resolveOrQueueTag(tx, rawTag); // exact/fuzzy/unmatched
        await tx.run('INSERT INTO entry_tags (entry_id, tag_id) VALUES (?, ?)', entryId, tagId);
      }
    }
  });
}
```

### Pattern 2: Debounced autosave + full-file re-index on save (not per-keystroke)

**What:** The editor writes the whole day-file to disk on a debounce (e.g. 500ms–1s after the last keystroke, plus on blur/app-close), not on every keystroke. The Index Sync Service re-parses that file wholesale after each save rather than trying to diff keystrokes into SQL updates.

**When to use:** Single-user, single-file-per-day scale (dozens to low-thousands of entries per file, at most a few hundred files/year). File sizes stay tiny (KBs), so "re-parse and re-upsert the whole day" on every save is cheap and eliminates an entire class of incremental-sync bugs.

**Trade-offs:** Pro — sync logic is trivially correct (delete day's rows, re-insert from fresh parse) instead of a fragile diff/patch algorithm; pill decorations can still update live per-keystroke in the editor (that's a separate, in-memory concern) even though disk writes are debounced. Con — not suitable if files were large (MBs) or shared across processes without a lock; neither applies here.

### Pattern 3: Two-stage tag matching — deterministic first, fuzzy second, unmatched bucket as escape valve

**What:** When a `#tag` is parsed, resolution runs in stages: (1) exact match against known tag table → done; (2) case/whitespace-normalized exact match → done; (3) fuzzy candidate retrieval (FTS5 trigram or in-memory string-similarity over the small tag vocabulary) scored against a similarity threshold → if above threshold, treat as an alias of the matched canonical tag; (4) below threshold → insert into an `unmatched` bucket, visible in a review UI, and treated as its own literal tag until a human merges or confirms it.

**When to use:** Any system where the tag vocabulary is small (tens to low-hundreds of distinct tags for a personal journal) and matching must never silently drop data — the unmatched bucket is what prevents "confidently wrong" auto-merges from mangling meaning.

**Trade-offs:** Pro — never loses a typed tag; degrades gracefully to "found it eventually" via the review bucket rather than either over-merging distinct concepts or under-merging typos. Con — requires storing a `tag_aliases` mapping and a review UI; a naive "always fuzzy-merge" approach is simpler but riskier (silently merges `#thought` and `#though` when the user meant different things is the failure mode this pattern exists to prevent).

**Example:**
```typescript
// search/tagMatcher.ts
async function resolveOrQueueTag(tx: Tx, rawTag: string): Promise<TagId> {
  const normalized = normalize(rawTag); // lowercase, trim
  const exact = await tx.get('SELECT id FROM tags WHERE normalized = ?', normalized);
  if (exact) return exact.id;

  const candidates = await fuzzyCandidates(tx, normalized); // FTS5 trigram prefilter
  const best = rankBySimilarity(normalized, candidates);    // Jaro-Winkler/Levenshtein
  if (best && best.score >= MERGE_THRESHOLD) {
    await tx.run('INSERT INTO tag_aliases (raw, canonical_id) VALUES (?, ?)', rawTag, best.tagId);
    return best.tagId;
  }
  return upsertUnmatchedTag(tx, rawTag); // lands in the review bucket
}
```

## Data Flow

### Editor keystroke → pill/ghost-text (in-memory, no I/O)

```
[Keystroke]
    ↓
[CodeMirror EditorState transaction]
    ↓
[entryParser.ts: re-segment changed region into entries]
    ↓
[extractTags.ts: find #tag tokens in changed entries]
    ↓
[tagDecoration.ts ViewPlugin: recompute Decoration.mark() ranges]  → pills rendered
    ↓
[ghostText.ts: if cursor is mid-#tag, query in-memory tag list for prefix match] → widget Decoration shown
    ↓
[Tab pressed while suggestion active] → insert suggestion text, dismiss widget
[any other key / space] → dismiss widget without inserting
```

This entire path is synchronous and in-process — it must never wait on disk or SQLite, or typing will feel laggy. The known tag list used for ghost-text suggestions is a small in-memory cache (loaded once at startup, updated incrementally as new tags are confirmed), not a live SQLite query per keystroke.

### Save → index sync (debounced, async)

```
[Debounce timer fires, or blur/close]
    ↓
[storage/dayFile.ts: write full buffer to YYYY-MM-DD.md]
    ↓
[index/indexSync.ts: re-parse that file, delete+reinsert its rows in SQLite]
    ↓
[for each tag: tagMatcher.resolveOrQueueTag — exact → fuzzy → unmatched]
    ↓
[FTS5 entries table updated for that date]
```

### Search → results (read-only, index-driven)

```
[User types query in Search Panel]
    ↓
[tagMatcher.ts: normalize query → exact tag lookup, else fuzzy candidate retrieval via FTS5 trigram + similarity re-rank]
    ↓
[resolve to one or more canonical tag_ids, including merged aliases]
    ↓
[SQL: entries JOIN entry_tags WHERE tag_id IN (...) ORDER BY date DESC]
    ↓
[Search Panel renders dated results]
    ↓
[Click result → CalendarNav opens that day's file → Editor Canvas loads it from disk (not from the index — index is never the render source for content)]
```

**Critical rule:** the index is read for *search* and *tag resolution* only. The editor never renders entry text from SQLite — it always loads the raw file from disk, so a corrupted or stale index can never show the user wrong journal content, only wrong search results (which are self-healing via re-index).

### Startup reconciliation

```
[App launch]
    ↓
[Scan journal directory for *.md files, compare mtime/hash vs index's stored mtime/hash]
    ↓
[For each changed/new file not matching index: re-run syncFileToIndex]
    ↓
[For each indexed file no longer on disk: remove its rows]
```

This catches edits made outside the app (e.g. the user opened the `.md` file in a text editor) and is also the recovery path if the index file is deleted entirely — a full directory scan rebuilds it from scratch.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|---------------------------|
| Single user, <1 year of daily files (~365 files, low thousands of entries) | Full re-parse-on-save and full directory reconciliation on startup are both cheap (milliseconds); no adjustments needed |
| Several years of daily files (thousands of files, tens of thousands of entries) | Startup reconciliation should skip unchanged files via stored mtime/hash rather than re-reading every file's content; FTS5 trigram index keeps fuzzy search fast without changes |
| Very large tag vocabulary (hundreds+ distinct tags) | Fuzzy candidate retrieval must stay indexed (FTS5 trigram prefilter) rather than doing an O(n) similarity scan over every known tag on each keystroke suggestion |

### Scaling Priorities

1. **First realistic bottleneck: startup reconciliation cost as file count grows.** Mitigate early by storing `(path, mtime, size)` per file in SQLite and skipping re-parse when unchanged — cheap to build from day one, avoids a rewrite later.
2. **Second: fuzzy-match latency on the ghost-text/autocomplete path if the tag vocabulary grows large.** Mitigate by keeping the in-memory suggestion list capped/pre-sorted (e.g. by recency/frequency) rather than fuzzy-scoring the entire tag table on every keystroke; full fuzzy matching (with FTS5+similarity re-rank) is reserved for the search box, not live-typing suggestions.

Given this is a single-user personal journal, none of these bottlenecks are likely to matter within years of daily use — build the simple version first and only add the mtime/hash skip-list if startup is ever noticeably slow.

## Anti-Patterns

### Anti-Pattern 1: Making SQLite the source of truth and the files a "backup export"

**What people do:** Store entry text primarily in SQLite for convenience (easier querying, transactions) and periodically dump to `.md` files as an afterthought.
**Why it's wrong:** Directly violates the project's core constraint — files must be the portable, human-readable source of truth, editable outside the app. It also means external edits to the `.md` file (or a user restoring from a plain-text backup) can silently diverge from the "true" data in SQLite, and any index bug becomes a data-loss bug rather than a search-degradation bug.
**Do this instead:** Files are written first and are authoritative; SQLite is populated from files and is always safe to delete and rebuild.

### Anti-Pattern 2: Per-keystroke fuzzy matching or per-keystroke disk writes

**What people do:** Run the full fuzzy-match/merge pipeline or write-to-disk on every single keystroke to "keep everything always in sync."
**Why it's wrong:** Causes input lag (the one thing that will make a "notepad-like" editor feel bad immediately), and creates thousands of redundant disk writes and index churn per typing session for no benefit — a debounce of even a few hundred milliseconds is imperceptible to the user but cuts I/O by orders of magnitude.
**Do this instead:** Keystroke-level work stays in-memory only (parsing for pill/ghost-text decoration); disk writes and index sync are debounced and batched at the file level.

### Anti-Pattern 3: Auto-merging fuzzy tag matches without a review path

**What people do:** Set a fuzzy-match threshold and silently rewrite `#thouhts` to `#thought` (or merge `#thought`/`#thoughts`) with no user-visible trace.
**Why it's wrong:** Silent merges are unrecoverable without diffing file history, and false-positive merges (two genuinely distinct short tags that happen to be similar strings) permanently conflate categories the user meant to keep separate — directly undermining the stated core value of *reliable* tag search.
**Do this instead:** High-confidence merges (near-duplicate plurals/typos) can auto-merge, but anything below a strict confidence threshold goes to the "unmatched" bucket for explicit human confirmation, and even auto-merges should be reversible (keep the alias mapping, not a destructive rewrite of the original file text).

## Integration Points

### External Services

None required — this is an explicitly local-only, no-cloud, no-backend app per project constraints. No external API integration points exist in v1.

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Editor Canvas ↔ Parser/Entry Model | Direct in-process function calls (same JS/TS runtime) | Must stay synchronous and fast; no I/O allowed in this path |
| Renderer (UI/editor) ↔ File I/O | IPC (`invoke`/Tauri commands, or Electron `ipcRenderer`/`ipcMain`) | This is the one boundary that differs meaningfully between Tauri and Electron; keep it behind a thin `storage/` abstraction so the choice is swappable |
| File I/O ↔ Index Sync Service | Direct call after successful write, or a file-watcher event | Watcher catches external edits; direct call after in-app save avoids waiting for watcher debounce/latency |
| Index Sync Service ↔ SQLite | Standard SQL driver (e.g. `rusqlite` on the Rust side, or `better-sqlite3`/`sql.js`-equivalent if kept in JS) | Only this component writes to SQLite; Search Panel and Calendar Nav only read |
| Search Panel ↔ Tag Matcher ↔ SQLite | Read-only query path | Ghost-text autocomplete in the editor should reuse the same Tag Matcher module (not a separate ad hoc implementation) to keep suggestion and search behavior consistent |

## Suggested Build Order (dependency-driven)

This is the order components can be built in, based on what each depends on:

1. **App shell + Editor Canvas rendering plain text, opens to today's file, basic manual/debounced save to a single `.md` file.** Nothing else is possible without a working editor and file I/O. This is also where the Electron-vs-Tauri choice gets exercised for the first time (window shell, IPC, packaging).
2. **Blank-line entry segmentation + `#hashtag` extraction (pure parser module), unit-tested independently of the editor.** Build this as a standalone module before wiring it into decorations — it's the piece both the editor and the future index will share, so get its behavior (and edge cases: multiple blank lines, tags at entry boundaries, trailing whitespace) right in isolation first.
3. **Pill decoration in the editor**, consuming the parser module from step 2. Now typed `#tags` visually render as pills. No autocomplete yet, no persistence beyond the file.
4. **Calendar navigation across day-files.** Only needs file listing (which files exist for which dates) — no index or tagging required, so it can be built any time after step 1, but is naturally sequenced here since it rounds out "basic app usability" before tackling search.
5. **SQLite index + Index Sync Service, built from the same parser module (step 2).** This is where "files are truth, index is derived" gets implemented: on save, re-parse and upsert. Exact-match tag lookups only at this stage (no fuzzy yet) — get the sync mechanics and rebuild-from-scratch path solid before adding matching complexity.
6. **Search Panel with exact-match search over the index**, proving the read path (query → SQL → dated results → jump-to-day) works end-to-end before fuzzy logic is layered in.
7. **Fuzzy/typo-tolerant matching + near-duplicate merge + unmatched bucket (Tag Matcher), applied to both the Index Sync Service (write path, tag resolution) and Search Panel (read path, query resolution).** This is the highest-complexity, most novel piece — sequence it after the deterministic exact-match version is proven, since debugging fuzzy-match correctness on top of an already-unstable sync/search foundation is much harder than adding it to a solid one.
8. **Tab-to-accept ghost-text autocomplete in the editor**, reusing the Tag Matcher's known-tag list (or a lightweight subset of it) built in step 7. This depends on both the pill decoration layer (step 3, same decoration infrastructure) and the tag vocabulary existing (step 5+), so it is naturally one of the last pieces — it is also the most fiddly interaction (dismiss-on-any-key, only-Tab-accepts) and benefits from everything else being stable first.
9. **Unmatched-tag review UI** (filter/edit/correct) — depends on the unmatched bucket existing (step 7) and is a smaller, self-contained UI layer that can be built last without blocking anything else.

**Ordering rationale:** the parser module (step 2) is the linchpin — it's a dependency of pills, index sync, and eventually autocomplete, so isolating and testing it early de-risks everything downstream. Exact-match search (steps 5-6) is deliberately built and proven before fuzzy matching (step 7) is layered on, because fuzzy logic is the single highest-uncertainty, most failure-prone piece per the project's own stated core value ("reliable tag search... no matter how a tag was typed") — it deserves a stable foundation underneath it, not simultaneous development with the sync mechanism itself.

## Sources

- [Tauri vs Electron 2026: Bundle Size, RAM, Security and Team Fit — PkgPulse Guides](https://www.pkgpulse.com/guides/electron-vs-tauri-2026)
- [Tauri vs Electron for Desktop Apps in 2026 | Rustify](https://rustify.rs/articles/rust-tauri-vs-electron-2026)
- [Tauri vs Electron Comparison: Choose the Right Framework | RaftLabs](https://www.raftlabs.com/blog/tauri-vs-electron-pros-cons/)
- [Tauri VS. Electron - Real world application](https://www.levminer.com/blog/tauri-vs-electron)
- [Distribute | Tauri v2 docs](https://v2.tauri.app/distribute/)
- [Windows Code Signing | Tauri](https://v2.tauri.app/distribute/sign/windows/)
- [macOS Code Signing | Tauri](https://v2.tauri.app/distribute/sign/macos/)
- [File System | Tauri v2 docs](https://v2.tauri.app/plugin/file-system/)
- [Calling Rust from the Frontend | Tauri v2 docs](https://v2.tauri.app/develop/calling-rust/)
- [Sidecar or not? · tauri-apps/tauri Discussion #4331](https://github.com/tauri-apps/tauri/discussions/4331)
- [CodeMirror Decoration Example (official docs)](https://codemirror.net/examples/decoration/)
- [CodeMirror Autocompletion Example (official docs)](https://codemirror.net/examples/autocompletion/)
- [Using tab key for autocomplete suggestions — discuss.CodeMirror](https://discuss.codemirror.net/t/using-tab-key-for-autocomplete-suggestions/7234)
- [Inline suggested texts — discuss.CodeMirror](https://discuss.codemirror.net/t/inline-suggested-texts/4714)
- [codemirror/autocomplete (GitHub)](https://github.com/codemirror/autocomplete)
- [SQLite FTS5 Extension (official docs)](https://www.sqlite.org/fts5.html)
- [Full-Text Search in SQLite: Using the Trigram Tokenizer](https://davidmuraya.com/blog/sqlite-fts5-trigram-name-matching/)
- [Stop Using LIKE: How We Reduced Search Time by 99.6% with SQLite FTS5](https://medium.com/@arif.rahman.rhm/stop-using-like-how-we-reduced-search-time-by-99-6-with-sqlite-fts5-99cb136e3d00)
- [SQLite Fuzzy Search — Dom](https://tdom.dev/sqlite-fuzzy-search.html)
- [Jaro-Winkler vs. Levenshtein in AML Screening](https://www.flagright.com/post/jaro-winkler-vs-levenshtein-choosing-the-right-algorithm-for-aml-screening)
- [The Architecture Of Local-First Web Development — Smashing Magazine (2026)](https://www.smashingmagazine.com/2026/05/architecture-local-first-web-development/)
- [Why Local-First Software Is the Future and its Limitations | RxDB](https://rxdb.info/articles/local-first-future.html)
- [Using Markdown for Daily Journaling | OpenMark](https://openmarkapp.com/blog/markdown-for-journaling)
- [The Best Markdown Note-Taking Apps in 2026](https://anarlog.so/blog/markdown-note-taking-apps/)
- [contentEditable vs Draft.js/Lexical for hashtag pills — search synthesis, multiple sources](https://github.com/lovasoa/react-contenteditable)
- [Which rich text editor framework should you choose in 2025? | Liveblocks blog](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025)

---
*Architecture research for: Minimal cross-platform desktop journaling app*
*Researched: 2026-08-28*
