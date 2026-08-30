# Journal

A minimal, dark-mode-only desktop journal for macOS and Windows. It opens straight to a blank page for today — you just type. Pressing Enter twice (a blank line) marks the boundary between one thought and the next, so free-flowing writing splits itself into distinct entries with no extra effort. Every day is saved automatically, with no save button and no status indicator, to a plain Markdown file you own on your own disk.

Tag pills, typo-tolerant tag search, and near-duplicate tag merging are **not** part of this release — they land in a later phase. This build covers writing, durable autosave, and calendar navigation between days.

## Install

There is no release page yet — builds come from the [Actions tab](../../actions/workflows/build.yml) of this repository. Every push to `master` runs a build; open the most recent successful **Build** run and download the artifact for your platform:

- **macOS:** download the `journal-macos` artifact. Inside is `Journal_0.1.0_universal.dmg` (a universal binary — runs on both Apple Silicon and Intel Macs) plus a `SHA256SUMS.txt`.
- **Windows:** download the `journal-windows` artifact. Inside is `Journal_0.1.0_x64_en-US.msi` (installer) and `Journal_0.1.0_x64-setup.exe` (alternative NSIS installer — you only need one of the two), plus a `SHA256SUMS.txt`.

To verify a download against the build that produced it, compute its checksum and compare it to the matching line in `SHA256SUMS.txt`:

- **macOS:** `shasum -a 256 Journal_0.1.0_universal.dmg`
- **Windows (PowerShell):** `Get-FileHash -Algorithm SHA256 Journal_0.1.0_x64_en-US.msi`

## First launch on an unsigned build

Journal is not code-signed. That means macOS Gatekeeper and Windows SmartScreen will both warn you the first time you try to open it — this is expected, not a sign anything is wrong (see "Why it is unsigned" below).

**On macOS:**
1. Open the `.dmg` and drag `Journal.app` into `Applications`.
2. Do **not** double-click it the first time — Gatekeeper will refuse to open it and just show a generic "can't be opened" dialog.
3. Instead, right-click (or Control-click) `Journal.app` in `Applications` and choose **Open**.
4. A dialog appears warning that the developer cannot be verified. Click **Open** again. macOS remembers this choice — every launch after this one works normally, including double-click.

**On Windows:**
1. Run the `.msi` (or the `.exe`, whichever you downloaded).
2. SmartScreen shows a blue "Windows protected your PC" screen.
3. Click **More info**, then click the **Run anyway** button that appears.
4. The installer proceeds normally from there.

What the warning actually means: neither OS detected anything harmful in the app. It means the binary isn't signed with a paid developer identity (an Apple Developer Program certificate or a Windows code-signing certificate) that lets the OS attribute it to a known publisher. That's it — see below for why.

## Why it is unsigned

Journal is a free, public, clone-and-build GitHub project, not a commercial release. Apple Developer Program enrollment costs $99/year and a Windows code-signing certificate costs money too — neither is justified for a personal tool distributed this way, regardless of how many people end up using it. "Might share it later" doesn't change that; this is a decision about what kind of project this is, not an oversight.

If you'd rather not trust a downloaded, unsigned binary at all, you don't have to: build it yourself from source (see below) and you know exactly what ran. This stance would only be revisited if the project ever became a widely distributed product where first-launch OS warnings meaningfully hurt adoption — not a concern for a personal journaling tool shared via GitHub.

## Where your writing lives

Journal writes one plain Markdown file per day, named `YYYY-MM-DD.md`, to your OS's standard app-data folder:

- **macOS:** `~/Library/Application Support/com.journal.desktop/journal/`
- **Windows:** `%APPDATA%\com.journal.desktop\journal\` (typically `C:\Users\<you>\AppData\Roaming\com.journal.desktop\journal\`)

These are ordinary UTF-8 Markdown files. Open, edit, back up, sync, or grep them with any text editor or tool you like — the app never sends them anywhere, and nothing about them requires the app to be installed to read or edit them.

## Using it

- Launch the app and it opens directly to today's page with the cursor ready — just start typing.
- Press Enter twice (leaving a blank line) to start a new entry; the blank line itself is the boundary, nothing extra is drawn.
- There is no save button. Typing is saved automatically a moment after you pause, and immediately when the window loses focus or you navigate to a different day — saving is deliberately invisible.
- Open the calendar with the button in the top-right corner of the window, or with **Cmd+J** (macOS) / **Ctrl+J** (Windows), to jump to any previous day. Days with content are marked with a dot.
- A past day opens in the exact same editable surface as today — there's no read-only mode. Editing text within a day (including backspacing) never asks for confirmation.
- Deleting an entire day's file does ask for confirmation, because that action is irreversible and there is no cloud backup — everything else does not.

## Build from source

Prerequisites:
- [Node.js](https://nodejs.org/) (v22 or later recommended)
- A Rust toolchain via [rustup](https://rustup.rs/) — Tauri's native shell is written in Rust, so this is required, not optional

Then:

```bash
npm install
npm run tauri dev    # run the app locally with hot reload
npm run tauri build  # produce an installer for your own platform
```

`npm run tauri build` produces an installer only for the platform you run it on. Building the Windows installer specifically requires either a Windows machine or the CI matrix in `.github/workflows/build.yml` — cross-compiling it from macOS is not reliable enough to rely on (Tauri's own guidance treats it as a last resort), which is why this project builds Windows installers in CI rather than locally.
