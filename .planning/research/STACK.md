# Technology Stack

**Project:** Journal — minimal cross-platform desktop journaling app
**Researched:** 2026-08-28
**Confidence:** MEDIUM-HIGH (shell/framework choice cross-checked across multiple independent 2025/2026 sources = MEDIUM; library versions pulled live from the npm registry = HIGH)

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Tauri** | v2 (CLI `2.11.4`) | Desktop app shell (macOS + Windows) | Rust backend + OS-native WebView (WKWebView on macOS, WebView2 on Windows) instead of bundling Chromium+Node like Electron. Result: ~3–10MB installers vs Electron's 120–200MB, ~75% less idle RAM, sub-second cold start vs 1–2s for Electron. For a "minimal notepad" app this is not a marginal win — it's the difference between a multi-hundred-MB download and a single-digit-MB one for something the user expects to feel like TextEdit/Notepad. |
| **React** | `19.2.8` | UI layer inside the Tauri webview | Largest ecosystem overlap with the two hardest sub-problems here: a maintained CodeMirror 6 React wrapper (`@uiw/react-codemirror`) and battle-tested state/hook patterns for the ghost-text autocomplete interaction. Svelte is a legitimate lighter-weight alternative (see Alternatives) but React's library coverage for this specific feature set (editor decorations + fuzzy search UI) is broader, which matters more for a solo build than shaving a few KB of framework runtime. |
| **TypeScript** | `5.9.x` (latest `7.0.2` is the Vite requirement floor, not the TS version — pin TS at `^5.9`) | Type safety across editor/parsing/search code | Tag-parsing, fuzzy-matching thresholds, and file-path handling are exactly the kind of "stringly-typed" logic that benefits most from static types; this is a small app but a wrong-file-write bug (writing to the wrong day's file) is a real risk worth guarding against. |
| **Vite** | `8.2.2` (via `create-tauri-app` scaffold) | Dev server + bundler for the frontend | Default, first-class integration with `create-tauri-app`; instant HMR during development, matches the dev-server experience Electron devs are used to. |

### Tauri Plugins (Rust-side glue, driven from JS)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@tauri-apps/api` | `2.11.1` | Core JS↔Rust bridge | Required baseline for any Tauri v2 frontend. |
| `@tauri-apps/plugin-fs` | `2.5.1` | Read/write the daily plain-text/Markdown journal files | Gives JS-side `readTextFile` / `writeTextFile` / `readDir` / `exists` without writing custom Rust commands for the common path. Capability model requires **both** a permission (e.g. `fs:allow-read-file`, `fs:allow-write-file`) **and** an explicit scope allowlist (e.g. `$DOCUMENTS/**/*` or a custom app-data path) in `capabilities/*.json` — nothing is readable by default, which is a good fit for "local files only, no surprise access." |
| `@tauri-apps/plugin-dialog` | `2.x` (match plugin-fs major) | Native "choose journal folder" picker (first-run setup, or a settings screen to relocate storage) | Standard companion plugin; avoids hand-rolling a file browser for the one-time "where do you want your journal stored" choice. |
| `@tauri-apps/plugin-store` *(optional)* | `2.x` | Tiny persisted app settings (e.g. last-opened day, chosen storage folder path, autocomplete-dismissed tags) | Only for app **preferences**, never for entry content — entry content stays as plain `.md` files per the "no proprietary format" constraint. |

### Editor Component (the notepad canvas)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@codemirror/state` / `@codemirror/view` / `@codemirror/commands` | `^6.x` (CM6 core) | Underlying text-editing engine | CodeMirror 6 is a **plain-text-native** editor core (unlike ProseMirror/Lexical, which are rich-text/WYSIWYG node-tree editors). Its buffer IS the plain text you're storing — no HTML-to-Markdown serialization step, no risk of the "canonical content" drifting from the file format. This directly matches the "entries stored as local plain text/Markdown files" constraint. |
| `@codemirror/autocomplete` | `6.20.3` | Base completion infrastructure (source-of-suggestions plumbing) | Used only as scaffolding — see below, the built-in dropdown widget is explicitly NOT what gets used. |
| `@codemirror/lang-markdown` | `6.5.2` | Basic Markdown syntax awareness (optional, light styling) | Not required for correctness (files are just text), but gives cheap, real Markdown-aware line/paragraph handling if later needed for headers/emphasis. Skippable for MVP if it adds complexity. |
| `@uiw/react-codemirror` | `4.25.11` | React wrapper around CM6 | Actively maintained (CM6-based since v4), typed, standard glue code so the team doesn't hand-roll `EditorView` lifecycle management inside React's render cycle. |

**How the two hardest UX requirements map onto CodeMirror 6:**

1. **Hashtag pills rendered over plain text.** Use CM6's `Decoration` API (`Decoration.replace` / a `WidgetType`) driven by a `ViewPlugin` that regex-scans each line for `#\w+` on every doc update. The underlying buffer stays untouched plain text (`#thought`); only the *rendering* is replaced with a styled pill widget. This is the standard CM6 pattern for "syntax highlighting but with real interactive widgets" (same mechanism Obsidian's Live Preview and many CM6-based apps use for tags/mentions).
2. **Non-forcing Tab-to-accept ghost text.** CM6's `@codemirror/autocomplete` package deliberately does **not** bind `Tab` to `acceptCompletion` by default — the CM6 maintainers treat this as a considered tradeoff, not an oversight (confirmed via the project's own "Tab-handling example" documentation and discussion threads). Do **not** try to force the stock dropdown-style `autocompletion()` widget into ghost-text behavior — instead implement inline ghost text directly as a single `Decoration.widget` (a low-opacity trailing-text span, CSS class like `.cm-ghostText`) positioned at the cursor, populated by your own tag-matching function (Fuse.js, see below) after a `#` is detected. Bind `Tab` yourself via a custom `keymap.of([...])` entry that accepts the current ghost suggestion; any other keypress (including Space) simply lets CM6's normal typing take over, which naturally "dismisses" the suggestion since it's re-computed from scratch on every doc change. This is exactly the same architecture used by existing CM6 ghost-text projects (`codemirror-extension-inline-suggestion`, and Codeium's/Copilot-style CM6 integrations) — there is real prior art to reference during implementation, not a from-scratch design.

### Fuzzy / Typo-Tolerant Tag Matching

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Fuse.js** | `7.5.0` | (a) Ghost-text suggestion matching after `#`, (b) interactive fuzzy tag search box | Bitap-based approximate string matching, zero dependencies, ~8.6kB gzip. Purpose-built for exactly this shape of problem: fuzzy-matching a typed prefix against a small in-memory list (your tag vocabulary will realistically be dozens–low hundreds of tags, well within Fuse's comfortable range). `threshold` + `distance` config give direct control over "how typo-tolerant is tolerant enough" without writing matching logic by hand. |
| **fastest-levenshtein** | `1.0.16` | Deterministic near-duplicate tag **clustering** (merging `#thought`/`#thoughts` into one canonical category, "unmatched" bucket detection) | Fuse.js returns a *relevance score* tuned for ranking search results, not a clean distance metric — clustering decisions ("is this the same tag or a new one?") are easier to reason about, test, and tune with a real edit-distance number (e.g. "merge if normalized edit distance ≤ 0.2 AND raw distance ≤ 2"). `fastest-levenshtein` is the fastest pure-JS single-pair implementation available, zero-dependency, and tiny — use it as the deterministic layer underneath the tag-canonicalization algorithm, distinct from Fuse.js's job (interactive search UI). Keeping these as two narrowly-scoped libraries (search UX vs. clustering logic) is simpler to reason about than trying to force one library to do both jobs well. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `date-fns` | `4.4.0` | Daily filename generation (`YYYY-MM-DD.md`), calendar-picker date math | Lightweight, tree-shakeable, avoids hand-rolling timezone/date-boundary edge cases for "what file is today." |
| React's built-in state (`useState`/`useReducer`/Context) | — | App state (current day, search results, unmatched-tag bucket) | For an app this size, a dedicated state library (Redux/Zustand) is very likely unnecessary complexity — reach for Zustand only if cross-component state sharing gets unwieldy in practice, not up front. |

## Installation

```bash
# Scaffold (interactive: pick React + TypeScript template)
npm create tauri-app@latest

# Core frontend deps
npm install react@^19 react-dom@^19
npm install @tauri-apps/api@^2 @tauri-apps/plugin-fs@^2 @tauri-apps/plugin-dialog@^2

# Editor
npm install @uiw/react-codemirror@^4 @codemirror/state@^6 @codemirror/view@^6 \
  @codemirror/commands@^6 @codemirror/autocomplete@^6 @codemirror/lang-markdown@^6

# Fuzzy matching
npm install fuse.js@^7 fastest-levenshtein@^1

# Utilities
npm install date-fns@^4

# Dev dependencies
npm install -D typescript@^5.9 vite@^8 @vitejs/plugin-react@^4 @tauri-apps/cli@^2
```

```bash
# Tauri v2 plugin registration (Rust side) — add to src-tauri/Cargo.toml and register in src-tauri/src/lib.rs
cargo add tauri-plugin-fs
cargo add tauri-plugin-dialog
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|--------------|-------------|--------------------------|
| Tauri v2 | Electron (`electron` + `electron-builder`) | Choose Electron only if you need pixel-identical Chromium rendering across OSes (not a stated requirement here — only macOS + Windows, and this is a plain-text editor, not a canvas-heavy visual app), or you need deep Node.js-ecosystem native module access that has no Rust/webview equivalent. Neither applies to this project. |
| React | Svelte (via `create-tauri-app`'s Svelte template) | Choose Svelte if minimizing frontend runtime weight matters more than library ecosystem breadth — Svelte compiles away the framework at build time and pairs fine with Tauri, but the CodeMirror + Fuse.js pieces are framework-agnostic anyway (both are vanilla-JS libraries with thin wrappers), so the ecosystem-breadth argument for React is weaker than usual. Reasonable to pick Svelte if the developer already prefers it. |
| CodeMirror 6 (plain-text-native) | Raw `contentEditable` div (e.g. via `use-editable` or `react-contenteditable`) | Only if you want to avoid the CM6 dependency entirely for a truly bare-bones build. Real risk: `contentEditable` has notorious cross-browser/IME cursor-position and selection-range bugs, and you'd be hand-rolling the decoration/widget system CM6 already provides for tag pills and ghost text. Not recommended given the ghost-text requirement specifically — CM6's `Decoration`/`ViewPlugin` system is precisely designed for "overlay a widget without touching the underlying text," which is the exact primitive this feature needs. |
| CodeMirror 6 | Lexical (`lexical` + `@lexical/hashtag`) | Lexical ships an *official* hashtag plugin that auto-detects `#tag` patterns and styles them — genuinely tempting. But Lexical is a rich-text, node-tree editor (like ProseMirror): the "document" is a tree of typed nodes, not a plain-text buffer, so you'd need a serialize-to-Markdown step on every save and a parse-from-Markdown step on every load, adding a translation layer and edge cases (what happens to a node type with no Markdown equivalent?) that CM6 avoids by construction. Reasonable to reconsider only if the notepad canvas grows real rich-text needs (bold/italic rendering, not just tag pills) beyond what's currently scoped. |
| CodeMirror 6 | ProseMirror | Same rich-text/node-tree tradeoff as Lexical, with a steeper API learning curve. `prosemirror-autocomplete` does support `#hashtag` triggers, but there's no upside here over CM6 given the plain-text storage requirement. |
| Fuse.js + fastest-levenshtein | `natural` (full NLP toolkit incl. Jaro-Winkler) | `natural` is a much heavier, general-purpose NLP library (tokenizers, classifiers, stemmers) — overkill when you only need two narrow string-matching primitives. Only reach for it if tag matching needs grow into genuine NLP territory (stemming, phonetic matching via Soundex/Metaphone), which isn't indicated by current requirements. |
| Fuse.js + fastest-levenshtein | Jaro-Winkler-based libraries (`jaro-winkler`, `string-comparison`) | Jaro-Winkler is prefix-weighted (rewards shared beginnings), which suits things like person-name matching. For short single-word tags where the typo/pluralization difference is usually 1–2 characters anywhere in the word, plain edit-distance (Levenshtein) is simpler to reason about and tune, and threshold values map directly to "number of character edits" rather than an abstract 0–1 similarity score. Revisit only if real usage data shows Levenshtein clustering is under/over-merging. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Electron | 20–50x larger installers, far higher idle RAM, slower cold start — direct contradiction of "minimal, lightweight" for an app that is functionally a notepad. The only real advantage (guaranteed identical Chromium rendering) isn't needed for macOS+Windows-only, non-graphically-complex text UI. | Tauri v2 |
| A database (SQLite/IndexedDB/etc.) as the source of truth for entries | Directly violates the "local plain text/Markdown files, readable outside the app" constraint — a DB file is opaque and not portable/human-readable. | Plain `.md` files, one per day, on disk via `plugin-fs` |
| CM6's built-in `autocompletion()` dropdown widget for the tag suggestion UX | It's a forced, list-based completion menu (arrow keys + Enter/click to select) — the opposite of the required "ghost text, ignorable by just continuing to type or pressing space" interaction the user explicitly asked for. | Custom `Decoration.widget`-based inline ghost text + manual `Tab` keybinding (see Editor Component section) |
| Lexical / ProseMirror / Slate as the primary canvas editor | All are rich-text node-tree editors requiring a serialize/deserialize boundary to plain Markdown text — adds a whole class of "does this round-trip losslessly" bugs that a plain-text-native editor (CM6) avoids entirely. | CodeMirror 6 |
| Exact string-match-only tag search (no fuzzy layer) | Explicitly called out as insufficient in `PROJECT.md` — typo/near-duplicate tolerance is the app's stated core value, not a nice-to-have. | Fuse.js (search) + fastest-levenshtein (clustering) |

## Stack Patterns by Variant

**If bundle size and RAM footprint are the top priority (stated goal — "minimal"):**
- Use Tauri v2, not Electron.
- Because Tauri's Rust+native-webview architecture is the entire reason it exists; Electron cannot close this gap by configuration.

**If the developer strongly prefers a non-React frontend:**
- Use Svelte via `create-tauri-app`'s Svelte-TS template; keep CodeMirror 6, Fuse.js, and fastest-levenshtein unchanged (all framework-agnostic).
- Because the editor and matching libraries do the real work here — the UI framework choice is comparatively low-stakes for this project.

**If the tag vocabulary grows into the thousands (unlikely for a personal journal, but worth flagging):**
- Reconsider Fuse.js's linear-scan cost at very large N; a pre-built fuzzy index (e.g. `fuzzysort`, or Fuse's `createIndex` for pre-indexing) may be worth adding.
- Because Fuse.js is comfortable at hundreds of items but its full re-scan approach isn't optimized for tens of thousands.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `@tauri-apps/api@2.x` | `@tauri-apps/cli@2.x`, `@tauri-apps/plugin-fs@2.x`, `@tauri-apps/plugin-dialog@2.x` | Keep all Tauri packages on the same major (v2) — v1 plugins/APIs are not drop-in compatible with v2's capability/permission system. |
| `@uiw/react-codemirror@4.x` | `@codemirror/state@6.x`, `@codemirror/view@6.x` (CM6 core) | `@uiw/react-codemirror` v4+ specifically targets CM6; do not mix with CM5-era `codemirror` package (different API entirely). |
| React `19.x` | `@uiw/react-codemirror@4.25.x` | Verify the wrapper's peerDependencies allow React 19 at install time (React 19 is recent enough that some third-party wrappers may still declare a `^18` peer range — check `npm install` output for peer-dep warnings and pin to the latest wrapper patch if so). |
| Vite `8.x` | `@vitejs/plugin-react@^4` | Standard current pairing for `create-tauri-app`'s React template. |

## Sources

- npm registry (`registry.npmjs.org`) — live version lookups for `@tauri-apps/cli`, `react`, `fuse.js`, `@uiw/react-codemirror`, `fastest-levenshtein`, `vite`, `@tauri-apps/api`, `@tauri-apps/plugin-fs`, `@codemirror/autocomplete`, `@codemirror/lang-markdown`, `typescript`, `date-fns` — **HIGH confidence** (authoritative, current as of 2026-08-28).
- `https://v2.tauri.app/plugin/file-system/` (official Tauri v2 docs, fetched directly) — filesystem plugin permission/scope model — **HIGH confidence**.
- `https://www.fusejs.io/` (official Fuse.js docs, fetched directly) — Bitap algorithm, bundle size, config options — **HIGH confidence**.
- Web search, cross-checked across 2+ independent sources (Tauri vs Electron bundle/RAM/startup benchmarks; Tauri v2 code-signing/packaging flow; CM6 Tab-binding behavior and ghost-text prior art; Levenshtein vs Jaro-Winkler tradeoffs; CM6/ProseMirror/Lexical architecture comparison) — **MEDIUM confidence**. Individual article claims (e.g. "96% smaller," "75% less RAM") are marketing-adjacent and directionally consistent across sources but not independently benchmarked by this research pass — treat specific percentages as illustrative, not guaranteed.
- CodeMirror 6 official autocomplete reference (`https://codemirror.net/docs/ref/#autocomplete`) was fetched but returned only a partial excerpt; the Tab-binding and ghost-text implementation details were corroborated instead via the CodeMirror discuss forum threads ("Using tab key for autocomplete suggestions," "Implement a code hinting style... similar to GitHub Copilot") and existing open-source implementations (`codemirror-extension-inline-suggestion`, `val-town/codemirror-codeium`) — **MEDIUM confidence** on the exact API surface; verify against current `@codemirror/view` docs during phase implementation.

---
*Stack research for: minimal cross-platform desktop journaling app (macOS + Windows)*
*Researched: 2026-08-28*
