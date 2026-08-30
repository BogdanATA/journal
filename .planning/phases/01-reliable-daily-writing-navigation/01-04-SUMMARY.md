---
phase: 01-reliable-daily-writing-navigation
plan: 04
subsystem: ci, packaging, docs
tags: [github-actions, tauri-bundler, dmg, msi, nsis, unsigned-build, readme]

requires:
  - phase: 01-reliable-daily-writing-navigation
    provides: "working Tauri v2 + React shell from 01-01, storage location decision, calendar shortcut from 01-03"
provides:
  - "Two-OS GitHub Actions build matrix (.github/workflows/build.yml) producing an unsigned macOS universal .dmg and a Windows .msi/.exe on every push, pull_request, and manual dispatch"
  - "src-tauri/tauri.conf.json bundle.targets = [app, dmg, msi, nsis], bundle.active true, no signing fields"
  - "README.md covering install, the unsigned first-launch bypass (Gatekeeper/SmartScreen), why it's unsigned, the on-disk journal file location, day-to-day usage, and build-from-source"
affects: []

actuals:
  tokens: 12200
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "CI artifact staging directory named release-artifacts/, deliberately distinct from Vite's frontendDist (../dist) so uploaded artifacts never carry the frontend's raw web assets alongside the installers"
    - "fail-fast: false matrix over macos-latest/windows-latest so one platform's break never hides the other's result"
    - "First-party actions/* only in the workflow (checkout, setup-node, upload-artifact) — no third-party action, no signing step"
    - "Per-leg SHA256SUMS.txt (shasum on macOS, Get-FileHash on Windows) uploaded inside each platform's artifact as the only integrity signal available without code signing"

key-files:
  created:
    - .github/workflows/build.yml
    - README.md
  modified:
    - src-tauri/tauri.conf.json
    - package-lock.json

key-decisions:
  - "Bundle targets set to [app, dmg, msi, nsis] with bundle.active true and every signing field left empty, per D-10 — no Apple Developer identity, no Windows certificate."
  - "Artifact staging directory renamed from dist/ to release-artifacts/ (Rule 1 bug fix, this continuation) after the first successful CI run (33319748941) confirmed the frontend's own dist/ build output (index.html, assets/*.js, svgs) was being swept into both journal-macos and journal-windows artifacts alongside the real installers."
  - "README states the journal-file path using the app's real bundle identifier, com.journal.desktop, taken from tauri.conf.json and matching Plan 01's $APPDATA/journal/ decision: macOS ~/Library/Application Support/com.journal.desktop/journal/, Windows %APPDATA%\\com.journal.desktop\\journal\\."
  - "README's unsigned-rationale paragraph avoids the word 'notariz(e/ation)' entirely — the plan's own verify gate blind-greps for that substring anywhere in the file (to prevent promising a notarized build), so the explanation uses 'Apple Developer Program enrollment' instead of naming notarization by name."

patterns-established:
  - "Pattern: any future CI staging step must use a directory name that cannot collide with an existing build-output path (frontendDist, dist, target, etc.) — established here after the collision bug, applies to any future artifact-producing workflow step."

requirements-completed: [PLATFORM-01, PLATFORM-02]

coverage:
  - id: D26
    description: "A macOS bundle (.app inside a universal .dmg) is produced by the macos-latest runner on every push (PLATFORM-01)"
    requirement: "PLATFORM-01"
    verification:
      - kind: ci
        ref: "gh run view 33320154520 (https://github.com/BogdanATA/journal/actions/runs/33320154520) — build (macos-latest) job concluded success in 6m39s, produced Journal_0.1.0_universal.dmg and Journal.app"
        status: pass
      - kind: unit
        ref: "node -e assertion on src-tauri/tauri.conf.json — bundle.active true, bundle.targets includes dmg/msi/nsis"
        status: pass
    human_judgment: true
    rationale: "Requires downloading and launching a real installer on physical hardware — deferred to end-of-phase UAT; CI proves the artifact is produced and green, not that it visibly opens as a native window."
  - id: D27
    description: "A Windows installer (.msi and .exe) is produced natively by the windows-latest runner, not cross-compiled from macOS (PLATFORM-02)"
    requirement: "PLATFORM-02"
    verification:
      - kind: ci
        ref: "gh run view 33320154520 — build (windows-latest) job concluded success in 6m29s, produced Journal_0.1.0_x64_en-US.msi and Journal_0.1.0_x64-setup.exe"
        status: pass
      - kind: unit
        ref: "grep -q 'windows-latest' .github/workflows/build.yml (no cross-compilation target, native windows-latest runner used)"
        status: pass
    human_judgment: true
    rationale: "Requires downloading and launching a real installer on physical hardware — deferred to end-of-phase UAT; the Windows leg additionally cannot be launch-tested on this macOS-only dev machine."
  - id: D28
    description: "Every uses: entry in build.yml is a first-party actions/* action; no third-party action or signing step is introduced (T-01-14)"
    requirement: null
    verification:
      - kind: unit
        ref: "[ \"$(grep -oE 'uses: *[^ ]+' .github/workflows/build.yml | grep -cv 'uses: *actions/')\" = \"0\" ]"
        status: pass
    human_judgment: false
  - id: D29
    description: "Each matrix leg emits a SHA256SUMS.txt beside its installers, uploaded in the same artifact (T-01-15)"
    requirement: null
    verification:
      - kind: ci
        ref: "gh run download 33320154520 — journal-macos/SHA256SUMS.txt and journal-windows/SHA256SUMS.txt both present, matching the .dmg / .msi+.exe checksums"
        status: pass
    human_judgment: false
  - id: D30
    description: "package-lock.json is committed and tracked so npm ci succeeds in CI"
    requirement: null
    verification:
      - kind: unit
        ref: "git ls-files --error-unmatch package-lock.json"
        status: pass
      - kind: ci
        ref: "Install dependencies step (npm ci) succeeded on both legs of run 33320154520"
        status: pass
    human_judgment: false
  - id: D31
    description: "README covers install, first-launch bypass (Gatekeeper + SmartScreen), why unsigned, journal file location, day-to-day usage, and build-from-source, with no promise of notarization/auto-update/Linux/light-mode/tag-pills/tag-search"
    requirement: "PLATFORM-01, PLATFORM-02"
    verification:
      - kind: unit
        ref: "grep -qi 'gatekeeper\\|right-click' README.md && grep -qi 'smartscreen\\|run anyway' README.md"
        status: pass
      - kind: unit
        ref: "grep -q 'YYYY-MM-DD.md' README.md && grep -qi rustup README.md && grep -q 'npm run tauri dev' README.md"
        status: pass
      - kind: unit
        ref: "! grep -qiE 'notariz|auto-?update|linux|light mode|hashtag pill|fuzzy search' README.md"
        status: pass
    human_judgment: true
    rationale: "Requires reading the README as if you had just downloaded the app and your OS refused to open it, and confirming the bypass steps are followable without a search — deferred to end-of-phase UAT."

duration: 27min
completed: 2026-08-30
status: complete
---

# Phase 1 Plan 4: Installable Build Artifacts Summary

**Two-OS GitHub Actions matrix producing an unsigned universal macOS `.dmg` and Windows `.msi`/`.exe` with SHA256 checksums, plus a README documenting the Gatekeeper/SmartScreen first-launch bypass and the on-disk journal file location.**

## Performance

- **Duration:** ~27 min (commit span 11:18:14 to 11:45:10 local time on 2026-08-30, across two executor sessions separated by a real GitHub OAuth-scope auth gate; CI wall-clock included below)
- **Started:** 2026-08-30T15:20:56Z (first Task 1 commit, prior executor session)
- **Completed:** 2026-08-30T15:45:10Z (README commit, this continuation)
- **Tasks:** 2
- **Files modified:** 4 (`.github/workflows/build.yml`, `README.md` created; `src-tauri/tauri.conf.json`, `package-lock.json` modified)

## Accomplishments

- Configured `src-tauri/tauri.conf.json` with `bundle.active: true` and `bundle.targets: [app, dmg, msi, nsis]`, every signing field left empty per D-10.
- Created `.github/workflows/build.yml`: a `fail-fast: false` matrix over `macos-latest`/`windows-latest`, triggered on `push`, `pull_request`, and `workflow_dispatch`, using only first-party `actions/*` actions (`checkout@v4`, `setup-node@v4`, `upload-artifact@v4`) — no third-party action, no signing step. The macOS leg adds the `x86_64-apple-darwin` target and builds `--target universal-apple-darwin` so the `.dmg` covers both Apple Silicon and Intel Macs.
- Ran the workflow to completion twice via `gh run watch`: the first run (`33319748941`) went green on both legs, producing `Journal_0.1.0_universal.dmg`/`Journal.app` (macOS) and `Journal_0.1.0_x64_en-US.msi`/`Journal_0.1.0_x64-setup.exe` (Windows), each with a `SHA256SUMS.txt`.
- Found and fixed a real bug in the first green run: the artifact staging directory was named `dist/`, colliding with `tauri.conf.json`'s `frontendDist: "../dist"` (already populated by `npm run build` before `tauri build` runs), so both artifacts silently included the frontend's raw web assets (`index.html`, `assets/*.js`, svgs) alongside the actual installers. Renamed the staging directory to `release-artifacts/` in both legs and re-ran; the second run (`33320154520`) confirmed clean artifacts containing only the installer(s) and `SHA256SUMS.txt`.
- Wrote `README.md` (75 lines) covering, in order: what Journal is, install instructions pointing at the Actions-tab artifacts with real filenames, the exact Gatekeeper (right-click → Open → Open) and SmartScreen (More info → Run anyway) click-paths, why the build is unsigned (free public GitHub project, no paid developer enrollment, build-from-source as the alternative), the real on-disk journal folder path for both platforms (`~/Library/Application Support/com.journal.desktop/journal/` on macOS, `%APPDATA%\com.journal.desktop\journal\` on Windows), day-to-day usage (blank-line entries, invisible autosave, Cmd+J/Ctrl+J calendar, confirmed delete), and build-from-source prerequisites/commands.

## Task Commits

Each task was committed atomically:

1. **Task 1: Two-OS GitHub Actions build matrix producing unsigned installers**
   - `13e6084` (feat, prior executor session) — `bundle.targets`/`bundle.active` in `tauri.conf.json`, `.github/workflows/build.yml` created, `package-lock.json` committed
   - `7958f76` (fix, this continuation, Rule 1 deviation) — staging-directory collision fix (`dist/` → `release-artifacts/`)
2. **Task 2: README covering install, the unsigned first-launch bypass, and where the files live**
   - `ae7a11c` (docs) — `README.md` created

**Plan metadata:** commit hash recorded after this SUMMARY is written (see below).

## Files Created/Modified

- `.github/workflows/build.yml` - Two-OS build matrix: checkout → setup-node (Node 22, npm cache) → `npm ci` → platform-specific `tauri build` → stage artifacts + `SHA256SUMS.txt` into `release-artifacts/` → upload as `journal-macos`/`journal-windows`
- `src-tauri/tauri.conf.json` - `bundle.active: true`, `bundle.targets: [app, dmg, msi, nsis]`, no signing fields
- `package-lock.json` - Committed and tracked so `npm ci` succeeds in CI
- `README.md` - New: install, first-launch bypass, why unsigned, journal file location, usage, build-from-source (7 sections)

## Decisions Made

- Bundle targets and empty signing fields per D-10 (see key-decisions above).
- Artifact staging directory renamed to `release-artifacts/` to avoid the `dist/` collision with Vite's `frontendDist` — see Deviations.
- README's unsigned-rationale wording avoids the literal substring "notariz" anywhere in the file, since the plan's own automated verify gate blind-greps for it — see key-decisions above.

## Authentication Gates

**GitHub Actions workflow-scope OAuth gate** (encountered by the prior executor session, resolved before this continuation began):

- **What was needed:** `git push origin master` was rejected with `refusing to allow an OAuth App to create or update workflow .github/workflows/build.yml without workflow scope` — the `gh` CLI's cached token lacked the `workflow` OAuth scope required to push a new/changed `.github/workflows/*.yml` file.
- **What was attempted:** `gh auth refresh -h github.com -s workflow`, which started a device-authorization flow requiring a one-time browser approval from the actual human user. The prior executor correctly recognized this as a genuine auth gate (not a bug) and returned a `checkpoint:human-action` rather than guessing or working around it.
- **Outcome:** The human approved the device-authorization request in their browser. The orchestrator verified via `gh auth status` that the token gained the `workflow` scope (final scopes: `gist, project, read:org, repo, workflow`). This continuation confirmed the scope was present, then `git push origin master` for all subsequent commits succeeded without further prompting.

This is documented as normal flow per the golden rule that auth gates are not deviations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CI artifact staging directory collided with Vite's frontend build output**
- **Found during:** Task 1, after the first successful CI run (`33319748941`) — confirmed by downloading both `journal-macos` and `journal-windows` artifacts and inspecting their contents.
- **Issue:** The workflow's staging steps (`mkdir -p dist`, then `cp ... dist/`) used a directory literally named `dist`, which is also the output directory `tauri.conf.json`'s `build.frontendDist: "../dist"` resolves to at the repo root. Because `beforeBuildCommand: "npm run build"` runs `vite build` into that same `dist/` before the Rust bundler runs, the staging step's `mkdir -p`/`cp` added the installer files into an already-populated directory instead of a clean one. Both `journal-macos` and `journal-windows` artifacts ended up containing the frontend's `index.html`, `assets/index-*.js`, `assets/index-*.css`, `tauri.svg`, and `vite.svg` alongside the real installers — confusing for anyone downloading the artifact expecting only an installer and a checksum file.
- **Fix:** Renamed the staging directory from `dist` to `release-artifacts` in both the macOS (`cp`/`shasum`) and Windows (`Copy-Item`/`Get-FileHash`) staging steps, and updated both `upload-artifact` `path:` values to match. This directory never collides with any existing build-output path.
- **Files modified:** `.github/workflows/build.yml`
- **Verification:** Re-ran the workflow (`gh run watch 33320154520`), both legs concluded `success`; downloaded both artifacts via `gh run download` and confirmed `journal-macos` contains only `Journal_0.1.0_universal.dmg`, `Journal.app/`, and `SHA256SUMS.txt`, and `journal-windows` contains only `Journal_0.1.0_x64_en-US.msi`, `Journal_0.1.0_x64-setup.exe`, and `SHA256SUMS.txt` — no frontend web assets in either.
- **Commit:** `7958f76`

---

**Total deviations:** 1 auto-fixed (Rule 1 bug fix). The authentication gate above is documented separately as normal flow, not a deviation.
**Impact on plan:** The fix is confined to the CI workflow's artifact-staging step; it changes no bundle configuration, no application code, and no README claim (the README was written after the fix landed, so it never described the stale, colliding-directory behavior). No re-planning needed.

## Issues Encountered

None beyond the one deviation and the one (pre-resolved) authentication gate documented above.

## User Setup Required

None remaining — the `origin` remote and Actions-enabled repository named in the plan's `user_setup` block were already configured before this continuation began (`git remote -v` confirms `origin` → `https://github.com/BogdanATA/journal.git`), and the workflow-scope auth gate was resolved by the human before this continuation started.

## CI Run Details

- **Final green run:** [`33320154520`](https://github.com/BogdanATA/journal/actions/runs/33320154520), triggered by the `7958f76` push, concluded `success` on both legs.
  - `build (macos-latest)`: 6m39s (15:37:17Z–15:43:56Z)
  - `build (windows-latest)`: 6m29s (15:37:16Z–15:43:45Z)
- **First green run (superseded by the staging-directory fix):** [`33319748941`](https://github.com/BogdanATA/journal/actions/runs/33319748941), triggered by the `13e6084` push, also concluded `success` on both legs (macOS 7m20s, Windows 6m33s) but its artifacts contained the frontend-asset pollution described in the Deviations section above — not linked as the canonical run for that reason.
- **Produced artifact filenames** (from the final green run, downloaded and inspected directly):
  - macOS (`journal-macos`): `Journal_0.1.0_universal.dmg`, `Journal.app/` (Contents/Info.plist, Contents/MacOS/tauri-app, Contents/Resources/icon.icns), `SHA256SUMS.txt`
  - Windows (`journal-windows`): `Journal_0.1.0_x64_en-US.msi`, `Journal_0.1.0_x64-setup.exe`, `SHA256SUMS.txt`

## Next Phase Readiness

- Phase 1's full plan sequence (01-01 through 01-04) is now complete. All of Phase 1's success criteria have either automated CI/grep-backed verification (this plan) or are deferred to end-of-phase UAT per `workflow.human_verify_mode=end-of-phase` (this plan's own `<human-check>` items plus every prior plan's carried-forward `human_judgment: true` coverage entries).
- **Open UAT items carried into end-of-phase verification** (per `workflow.human_verify_mode=end-of-phase`, not resolved by this plan):
  - Mount the `.dmg` on this (or any) Mac, drag `Journal.app` to Applications, and launch it via the README's right-click → Open path — confirm it opens as a native dark window titled "Journal", not a browser tab.
  - If a Windows machine is available: install the `.msi`, confirm the SmartScreen → More info → Run anyway path works as documented, and confirm the app launches and behaves identically to the macOS build. This machine is macOS-only, so the Windows launch path is untestable here — remains an explicit open item, not a silently assumed pass (per RESEARCH.md's Windows-launch flagged assumption).
  - Intel-Mac launch verification for the universal `.dmg` — `macos-latest` runners are Apple Silicon, so the Intel half of the universal binary is built but never launched by any automated check (declared a `backstop` truth in the plan's own `must_haves`).
  - Read the README end-to-end as if downloading the app cold, to confirm the bypass steps and journal-folder path are followable without a search (the plan's own `<human-check>` for Task 2).
- Phase 2 (Inline Tagging with Visual Pills) is unblocked — it depends only on Phase 1 as a whole, not specifically on this plan's CI/README work, and can begin planning once end-of-phase UAT is scheduled or waived.

## Self-Check: PASSED

Verified `.github/workflows/build.yml`, `README.md`, and `src-tauri/tauri.conf.json` present on disk with the expected content (bundle targets, matrix legs, README sections). Verified all three commit hashes (`13e6084`, `7958f76`, `ae7a11c`) present in `git log --oneline --all`. Verified both CI runs (`33319748941`, `33320154520`) via `gh run view`, both `conclusion: success`. Verified via `gh run download` that the final run's artifacts contain exactly the expected installer files plus `SHA256SUMS.txt`, with no frontend-asset pollution.

---
*Phase: 01-reliable-daily-writing-navigation*
*Completed: 2026-08-30*
