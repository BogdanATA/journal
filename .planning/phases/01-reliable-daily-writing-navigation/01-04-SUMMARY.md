---
phase: 01-reliable-daily-writing-navigation
plan: 04
subsystem: packaging, ci, docs
tags: [tauri, github-actions, tauri-bundle, dmg, msi, nsis, unsigned-build, readme]

requires:
  - phase: 01-reliable-daily-writing-navigation
    provides: "confirmed-working cargo build / tauri build --debug --no-bundle from 01-01; stable app shell, storage, and calendar from 01-01/01-02/01-03"
provides:
  - "Two-OS GitHub Actions build matrix (.github/workflows/build.yml) producing unsigned macOS .dmg and Windows .msi/.exe on every push, PR, and manual dispatch"
  - "Explicit bundle.targets (app, dmg, msi, nsis) in src-tauri/tauri.conf.json, replacing the implicit 'all' target list"
  - "SHA256SUMS.txt checksum file per platform leg, uploaded alongside installers"
  - "README.md — install, unsigned first-launch bypass (Gatekeeper/SmartScreen), unsigned rationale, journal file location, day-to-day usage, build-from-source"
affects: ["end-of-phase UAT (macOS/Windows launch human-check items)", "Phase 2 (tag pills) — README's 'not in this release' framing will need updating once Phase 2 lands"]

actuals:
  tokens: 2339
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "CI staging directory must never be named 'dist' when frontendDist in tauri.conf.json resolves to the repo-root dist/ folder — Vite's own build output lands there first via beforeBuildCommand, and a same-named staging directory silently merges installer artifacts with frontend build output. Use a distinctly-named staging directory (release-artifacts/) for anything uploaded via actions/upload-artifact."
    - "fail-fast: false GitHub Actions matrix with per-OS conditional steps (if: matrix.os == '...') lets one job definition serve two structurally different platforms (universal-target macOS build with an extra rustup target-add step vs. a plain windows-latest build) without duplicating the job."

key-files:
  created:
    - .github/workflows/build.yml
    - README.md
  modified:
    - src-tauri/tauri.conf.json

key-decisions:
  - "Bundle targets pinned explicitly to [\"app\", \"dmg\", \"msi\", \"nsis\"] instead of the scaffold's \"all\" — Tauri only builds the targets valid for the host OS from this one list, so it serves both matrix legs without per-OS config branching."
  - "CI staging directory named release-artifacts/, not dist/ — see tech-stack patterns above; discovered as a Rule 1 bug on the first green CI run (artifacts included the frontend's index.html/assets/svg) and fixed before Task 2 began."
  - "Workflow token scoped to permissions: contents: read only (least-privilege) — no write scopes needed since the workflow only builds and uploads artifacts, never pushes or creates releases."
  - "gh CLI's default OAuth token lacked the 'workflow' scope required to push a new/modified .github/workflows/*.yml file — resolved via an interactive gh auth refresh -h github.com -s workflow device-code flow (one-time human browser action), not worked around. This is a one-time repo-setup cost, not a recurring one — the token now carries the scope for all future workflow-file pushes."

patterns-established:
  - "Pattern: any future CI staging/output directory name must be checked against tauri.conf.json's build.frontendDist and build.beforeBuildCommand before use, to avoid silently merging unrelated build outputs."

requirements-completed: [PLATFORM-01, PLATFORM-02]

coverage:
  - id: D26
    description: "The macos-latest CI leg produces a genuine universal (Apple Silicon + Intel) macOS installer — Journal_0.1.0_universal.dmg containing Journal.app — from the two-OS build matrix (PLATFORM-01)"
    requirement: "PLATFORM-01"
    verification:
      - kind: ci
        ref: "gh run 33320154520 (https://github.com/BogdanATA/journal/actions/runs/33320154520), build (macos-latest) job: success, 6m39s"
        status: pass
      - kind: unit
        ref: "lipo -info on the downloaded artifact's Contents/MacOS/tauri-app binary: 'Architectures in the fat file: ... x86_64 arm64' — both slices genuinely present, not just requested"
        status: pass
      - kind: unit
        ref: "codesign -dv on the downloaded Journal.app: Format=app bundle with Mach-O universal (x86_64 arm64), flags=0x20002(adhoc,linker-signed), TeamIdentifier=not set — confirms unsigned-by-real-identity as intended (D-10), only the OS-required ad-hoc signature Apple mandates to run on Apple Silicon at all"
        status: pass
    human_judgment: true
    rationale: "Artifact production, universal-binary integrity, and unsigned status are all confirmed against the real downloaded CI artifact from this session — stronger evidence than the plan's own 'backstop' framing anticipated (RESEARCH.md flagged assumption #2 expected the Intel slice to be entirely untestable in CI; this session verified the Intel slice is genuinely embedded, just not launched). Actually mounting the .dmg, dragging to Applications, and confirming a native dark window opens (not a browser tab) requires GUI interaction the executor agent cannot perform — deferred to end-of-phase UAT per workflow.human_verify_mode=end-of-phase, matching the plan's own instruction that the macOS-artifact-launch item is human_judgment:true."
  - id: D27
    description: "The windows-latest CI leg produces native Windows installers — Journal_0.1.0_x64_en-US.msi and Journal_0.1.0_x64-setup.exe — built on an actual Windows runner rather than cross-compiled from this macOS machine (PLATFORM-02)"
    requirement: "PLATFORM-02"
    verification:
      - kind: ci
        ref: "gh run 33320154520, build (windows-latest) job: success, 6m29s"
        status: pass
      - kind: unit
        ref: ".github/workflows/build.yml: the Windows leg has no --target flag and no cross-compilation toolchain step — it runs npm run tauri build directly on windows-latest, using that runner's own native Rust toolchain"
        status: pass
    human_judgment: true
    rationale: "CI production of the installers is fully automated-verified against two consecutive green runs. Actually installing the .msi/.exe and confirming a native window launches on real Windows hardware cannot be performed from this macOS-only development machine — an explicit, unavoidable open Windows UAT item, per the plan's own flagged assumption #3 (Windows launch verification)."
  - id: D28
    description: "Every push to the default branch runs the two-OS build matrix with fail-fast: false, so a Windows-breaking regression is caught on the next push rather than at release time"
    requirement: "PLATFORM-02"
    verification:
      - kind: unit
        ref: "grep -q 'push:' .github/workflows/build.yml && grep -q 'pull_request' .github/workflows/build.yml && grep -q 'workflow_dispatch' .github/workflows/build.yml && grep -q 'fail-fast: false' .github/workflows/build.yml"
        status: pass
      - kind: ci
        ref: "Two consecutive real pushes (13e6084, 7958f76) each triggered an automatic matrix run (33319748941, 33320154520) with both legs independent — the second run's Windows leg completed even though nothing about it changed, confirming fail-fast:false does not couple the legs' outcomes"
        status: pass
    human_judgment: false
  - id: D29
    description: "Every uses: entry in the workflow is a first-party actions/* action — no third-party action is introduced into a workflow that builds a binary users run unsigned (T-01-14)"
    requirement: "PLATFORM-02"
    verification:
      - kind: unit
        ref: "[ \"$(grep -oE 'uses: *[^ ]+' .github/workflows/build.yml | grep -cv 'uses: *actions/')\" = \"0\" ]"
        status: pass
    human_judgment: false
  - id: D30
    description: "package-lock.json is committed and tracked, so npm ci succeeds in CI against the exact audited dependency tree"
    requirement: "PLATFORM-02"
    verification:
      - kind: unit
        ref: "test -f package-lock.json && git ls-files --error-unmatch package-lock.json"
        status: pass
      - kind: ci
        ref: "Both matrix legs' 'Install dependencies' step (npm ci) succeeded on both CI runs"
        status: pass
    human_judgment: false
  - id: D31
    description: "Each leg writes a SHA256SUMS.txt and uploads it alongside the installers under journal-macos / journal-windows, so a downloaded artifact can be matched to the CI build that produced it (T-01-15)"
    requirement: "PLATFORM-01"
    verification:
      - kind: ci
        ref: "gh run download 33320154520 -R BogdanATA/journal — journal-macos/SHA256SUMS.txt contains one 64-hex-char line for Journal_0.1.0_universal.dmg; journal-windows/SHA256SUMS.txt contains two 64-hex-char lines for the .msi and .exe"
        status: pass
    human_judgment: false
  - id: D32
    description: "README.md documents the exact Gatekeeper (right-click then Open) and SmartScreen (More info then Run anyway) first-launch bypass click-paths, per D-10's exact wording"
    requirement: "PLATFORM-01"
    verification:
      - kind: unit
        ref: "grep -qi 'gatekeeper\\|right-click' README.md && grep -qi 'smartscreen\\|run anyway' README.md"
        status: pass
    human_judgment: false
  - id: D33
    description: "README.md states the journal folder path for both platforms with YYYY-MM-DD.md naming, names rustup as a build-from-source prerequisite, and states the Windows cross-compilation limitation — while making no claim about notarization, auto-update, Linux, light mode, tag pills, or tag search"
    requirement: "PLATFORM-01"
    verification:
      - kind: unit
        ref: "grep -q 'YYYY-MM-DD.md' README.md && grep -qi 'rustup' README.md && grep -q 'npm run tauri dev' README.md"
        status: pass
      - kind: unit
        ref: "! grep -qiE \"notariz|auto-?update|linux|light mode|hashtag pill|fuzzy search\" README.md"
        status: pass
      - kind: unit
        ref: "Journal folder path in README (~/Library/Application Support/com.journal.desktop/journal/ on macOS, %APPDATA%\\com.journal.desktop\\journal\\ on Windows) cross-checked against src/storage/journalDir.ts (BaseDirectory.AppData) and src/storage/dayPath.ts (JOURNAL_SUBDIR = \"journal\"), and tauri.conf.json's identifier: com.journal.desktop"
        status: pass
    human_judgment: false

duration: 24min
completed: 2026-08-30
status: complete
---

# Phase 1 Plan 4: Installable Build Artifacts Summary

**Two-OS GitHub Actions matrix producing an unsigned universal macOS `.dmg` and native Windows `.msi`/`.exe` with SHA256 checksums, verified green on both legs across two consecutive CI runs, plus a README documenting the Gatekeeper/SmartScreen first-launch bypass and the exact `$APPDATA/journal/` storage path.**

## Performance

- **Duration:** 24 min (commit-to-commit span across this plan's 3 task commits, 11:20:56 to 11:45:10 local time; includes two real CI matrix runs of ~6-7 min per leg plus a one-time interactive `gh auth refresh` browser step — excludes upfront required-reading time)
- **Started:** 2026-08-30T11:20:56-04:00
- **Completed:** 2026-08-30T11:45:10-04:00
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- Set `src-tauri/tauri.conf.json`'s `bundle.targets` explicitly to `["app", "dmg", "msi", "nsis"]` (replacing the scaffold's implicit `"all"`), with every signing field left empty per D-10.
- Built `.github/workflows/build.yml`: a `fail-fast: false` matrix over `macos-latest` and `windows-latest`, triggered on push/PR/manual dispatch, using only first-party `actions/*` actions (`checkout@v4`, `setup-node@v4`, `upload-artifact@v4`) with `permissions: contents: read` — no third-party action, no toolchain action (both runners ship Rust preinstalled).
- Pushed, watched, and got a fully green run on the first attempt (`33319748941`: windows-latest 6m33s, macos-latest 7m20s) — then caught a real bug in the artifact contents on inspection (see Deviations) and pushed a fix, re-verified fully green on a second run (`33320154520`: windows-latest 6m29s, macos-latest 6m39s).
- Downloaded and inspected the actual CI-produced artifacts: confirmed the macOS binary is a genuine universal Mach-O (both `x86_64` and `arm64` slices present via `lipo -info`, not just requested in build flags), confirmed it carries only an ad-hoc/linker signature with no Apple Developer team identity (`codesign -dv`), and confirmed both `SHA256SUMS.txt` files contain valid checksums for their respective installers.
- Wrote `README.md` covering all seven required sections (what Journal is, install, first-launch bypass, why unsigned, where writing lives, using it, build from source), using the real produced artifact filenames and the exact `$APPDATA/journal/` path resolved from `journalDir.ts`/`dayPath.ts`/`tauri.conf.json`'s `identifier`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Two-OS GitHub Actions build matrix producing unsigned installers**
   - `13e6084` (feat) — `bundle.targets` config + `.github/workflows/build.yml`, first green CI run
   - `7958f76` (fix, Rule 1 deviation) — renamed CI staging directory from `dist` to `release-artifacts` to stop colliding with Vite's frontend build output, second green CI run confirms clean artifacts
2. **Task 2: README covering install, the unsigned first-launch bypass, and where the files live**
   - `ae7a11c` (docs) — `README.md`

**Plan metadata:** commit hash recorded after this SUMMARY is written (see below).

## Files Created/Modified

- `.github/workflows/build.yml` - New: two-OS build matrix (checkout, setup-node w/ npm cache, `npm ci`, platform-specific `tauri build`, checksum + stage, upload-artifact)
- `src-tauri/tauri.conf.json` - `bundle.targets` changed from `"all"` to `["app", "dmg", "msi", "nsis"]`
- `README.md` - New: install, first-launch bypass, unsigned rationale, journal file location, usage, build-from-source

## Decisions Made

- Explicit bundle target list instead of `"all"` — see key-decisions above.
- CI staging directory named `release-artifacts/`, not `dist/` — see key-decisions above and Deviations below.
- Workflow token scoped to `contents: read` only.
- The `gh` CLI's stored OAuth token needed the `workflow` scope added via a one-time interactive `gh auth refresh -h github.com -s workflow` device-code flow before `.github/workflows/build.yml` could be pushed — a genuine authentication gate handled via `checkpoint:human-action`, not worked around.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CI staging directory `dist/` collided with Vite's frontend build output, polluting both uploaded artifacts**
- **Found during:** Task 1, after the first green CI run (`33319748941`), while downloading and inspecting the actual artifacts before writing the README's filename references
- **Issue:** `tauri.conf.json`'s `build.frontendDist` is `"../dist"`, which resolves to the repo-root `dist/` directory — already populated by `npm run build` (the `beforeBuildCommand`) before `tauri build` runs. The workflow's checksum/staging step also created a directory named `dist/` and copied the installer files into it, so `actions/upload-artifact` picked up the pre-existing frontend build output (`index.html`, `assets/*.js`/`*.css`, `vite.svg`, `tauri.svg`) alongside the real installers in both `journal-macos` and `journal-windows`.
- **Fix:** Renamed the staging directory to `release-artifacts/` in both matrix legs (macOS `run:` step and Windows `pwsh` step), so it never overlaps with the frontend's own `dist/` output.
- **Files modified:** `.github/workflows/build.yml`
- **Verification:** Pushed the fix, re-ran the full CI matrix (`33320154520`, both legs green), re-downloaded both artifacts via `gh run download` — confirmed `journal-macos/` now contains only `Journal_0.1.0_universal.dmg`, `Journal.app`, `SHA256SUMS.txt`, and `journal-windows/` now contains only `Journal_0.1.0_x64_en-US.msi`, `Journal_0.1.0_x64-setup.exe`, `SHA256SUMS.txt` — no frontend build artifacts.
- **Commit:** `7958f76`

---

**Total deviations:** 1 auto-fixed (Rule 1 bug).
**Impact on plan:** Caught and fixed before Task 2 began, using the plan's own budgeted iteration allowance for CI fix-push-rewatch cycles. Does not change the plan's architecture, bundle target list, or action supply-chain surface (still first-party `actions/*` only). No re-planning needed.

## Issues Encountered

**Authentication gate (not a deviation, expected per the executor's auth-gate protocol):** `git push origin master` was initially rejected — `refusing to allow an OAuth App to create or update workflow .github/workflows/build.yml without workflow scope`. The `gh` CLI's existing token (scopes `gist, project, read:org, repo`) predates this plan's need to push a `.github/workflows/*.yml` file for the first time, and GitHub requires a dedicated `workflow` scope specifically for that. Resolved via `gh auth refresh -h github.com -s workflow`, which required a one-time human action (visiting `https://github.com/login/device` and entering a one-time code in a browser) — surfaced as a `checkpoint:human-action`, completed by the user, then the plan resumed from the push step. This is a one-time repo-setup cost: the token now carries the `workflow` scope for all future pushes.

## User Setup Required

None beyond the one-time `gh auth refresh` step already completed above (see Issues Encountered). The GitHub repository, `origin` remote, and Actions-enabled status were already set up by the orchestrator before this plan began, per the plan's own `precondition_status`.

## Next Phase Readiness

This is the last plan in Phase 1's sequence (walking skeleton → durability hardening → calendar navigation → build artifacts). All four plans have landed; Phase 1's full success-criteria set (blank canvas autosave, durable writes, calendar navigation with delete, cross-platform packaging) is ready for the phase's own end-to-end UAT pass before transitioning to Phase 2 (tag pills).

**Human-check items carried to end-of-phase UAT from this plan** (per `workflow.human_verify_mode=end-of-phase`, D26/D27 above):
- Mount `Journal_0.1.0_universal.dmg` on this machine, drag `Journal.app` to Applications, and launch it following the README's Gatekeeper right-click-then-Open steps — confirm it opens as a native dark window titled Journal, not a browser tab. (The artifact itself is downloaded and verified to be a genuine universal, unsigned-by-identity Mach-O bundle; only the actual GUI launch remains unconfirmed.)
- If a Windows machine becomes available: install `Journal_0.1.0_x64_en-US.msi` (or the `.exe`), follow the README's SmartScreen More-info-then-Run-anyway steps, and confirm it launches. This cannot be performed at all from this macOS-only development machine — an explicit, structural open item, not a gap in this plan's execution.
- Re-run the workflow once more at the start of end-of-phase UAT if any further Phase 1 changes land, per the plan's own `<verify><human-check>` instruction to re-check after the whole phase (all 4 plans) is in.

**Human-check items carried forward from earlier plans in this phase, still pending the same end-of-phase UAT pass** (unchanged by this plan, listed here for a single consolidated UAT entry point):
- 01-01: blinking caret on launch, real disk round-trip after typing/quit/relaunch, byte-identical idempotent save, plain-UTF8-no-BOM file content (D7-D10).
- 01-02: (durability hardening — see its own SUMMARY for the specific human-check items, not restated here since this plan did not touch that surface).
- 01-03: calendar open via button/Cmd-J, content dots rendering under the correct day, cross-day navigation never landing text in the wrong file, past-day editing parity, single delete-confirmation dialog, post-delete dot removal, Escape-dismiss-and-refocus (D19-D25) — plus the Windows-only Ctrl+J and native-confirm-dialog verification this plan's README documents but cannot itself test.

No blockers for Phase 2. The README's "not in this release" framing for tag pills/search will need a small update once Phase 2 lands, noted here so it isn't forgotten mid-phase.

## Self-Check: PASSED

All 3 created/modified files listed in `key-files` were verified present on disk (`.github/workflows/build.yml`, `README.md`, `src-tauri/tauri.conf.json` with the updated `bundle.targets`), and all 3 task commit hashes (`13e6084`, `7958f76`, `ae7a11c`) were verified present in `git log --oneline --all`. Both referenced CI runs (`33319748941`, `33320154520`) were independently re-queried via `gh run list`/`gh run view` and confirmed `conclusion: success` with both matrix legs green on the final run.

---
*Phase: 01-reliable-daily-writing-navigation*
*Completed: 2026-08-30*
