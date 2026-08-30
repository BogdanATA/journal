---
status: testing
phase: 01-reliable-daily-writing-navigation
source: [01-VERIFICATION.md]
started: 2026-08-30T16:38:03Z
updated: 2026-08-30T16:38:03Z
---

## Current Test

number: 1
name: Launch to today's blank canvas
expected: |
  Run `npm run tauri dev`. Confirm a dark window titled Journal opens showing today's date with a caret already blinking in an empty canvas — no click, menu action, or file prompt needed.
awaiting: user response

## Tests

### 1. Launch to today's blank canvas
expected: Blank canvas for today, ready to type immediately (WRITE-01, SC1). A dark window titled Journal opens with a caret already blinking — no click, menu action, or file prompt needed.
result: [pending]

### 2. Double-Enter entry boundary + external file round-trip
expected: Type two paragraphs separated by a blank line (press Enter twice between them). Wait ~2s, blur the window. Open the day file (`~/Library/Application Support/com.journal.desktop/journal/YYYY-MM-DD.md` on macOS, `%APPDATA%\com.journal.desktop\journal\YYYY-MM-DD.md` on Windows) in an external editor. The blank line is exactly where typed; file opens fine in a plain text editor; no "saving/saved" indicator ever appeared; exactly one date header on screen (WRITE-03, SC2).
result: [pending]

### 3. Durable autosave across quit/relaunch
expected: Type a sentence and immediately close the window (red button / Cmd+Q) without waiting for the debounce. Reopen — the sentence is present. Repeat waiting 3s before closing. Also, if feasible, force-kill the process mid-typing-burst and reopen. No text loss on a normal quick quit or a normal delayed quit; a hard force-kill mid-write is an explicitly accepted, unproven "backstop" risk per the plan's own must_haves, not a guarantee this phase makes (WRITE-02, SC3).
result: [pending]

### 4. Calendar navigation, content dots, and free past-day editing
expected: Press Cmd+J / Ctrl+J to open the calendar. Confirm today is highlighted, dotted days have content and undotted days don't (including a day whose file exists but is blank), click a past dotted day, edit it (type + backspace) with no lock/prompt, press Escape and confirm focus returns to the editor, and confirm the calendar icon button opens the same picker. Full calendar navigation, dot accuracy, and past-day free editing work as today's page does (NAV-01, NAV-02, SC4).
result: [pending]

### 5. Confirmed whole-day delete, and only that action prompts
expected: On a day with text, select-all + Backspace — confirm no dialog appears. Undo. Click the delete-day control — confirm a native dialog names the exact date, Cancel leaves the file untouched, and confirming deletes the file and clears the calendar dot. Retype and confirm the file is recreated. Confirmation gates only whole-day deletion, never in-place editing (NAV-02, D-09, SC4).
result: [pending]

### 6. Installed-artifact launch on macOS and Windows
expected: From the Actions tab, download `journal-macos` and `journal-windows` artifacts. Mount the `.dmg`, drag to Applications, follow the README's Gatekeeper bypass, and launch — confirm a native dark window titled Journal opens (not a browser tab). If a Windows machine is available, install and launch the `.msi`/`.exe` and confirm the same. Both platforms launch as native, dark-themed apps (PLATFORM-01, PLATFORM-02, PLATFORM-03, SC5). **Priority: Windows has never been launch-tested on real hardware from this macOS-only dev machine — this is the highest-priority item to close before shipping.**
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
