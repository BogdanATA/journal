# Phase 1: Reliable Daily Writing & Navigation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-29
**Phase:** 1-Reliable Daily Writing & Navigation
**Areas discussed:** Autosave durability, Entry segmentation look, Calendar & delete UX, Packaging & signing scope

---

## Autosave Durability

| Option | Description | Selected |
|--------|-------------|----------|
| Debounced (~1-2s idle) | Write to disk ~1-2s after typing stops. Standard notepad feel, small crash-loss window. | ✓ |
| Every keystroke | Write on every character. Zero data-loss window but heavy I/O and write-contention risk. | |
| Fixed interval (e.g. every 5s) | Save on a timer regardless of activity, plus on blur/close. | |

**User's choice:** Debounced (~1-2s idle)

| Option | Description | Selected |
|--------|-------------|----------|
| On window blur / app switch | Flush immediately when app loses focus. | ✓ |
| On day navigation | Flush immediately before switching days. | ✓ |
| On app close/quit | Flush immediately on quit signal. | ✓ |

**User's choice:** All three (blur, day navigation, close/quit)
**Notes:** User asked what "flush" meant — clarified as "force-write to disk now, not wait for the debounce timer."

| Option | Description | Selected |
|--------|-------------|----------|
| Fully invisible (recommended) | No indicator at all — matches frictionless philosophy. | ✓ |
| Subtle indicator | A small unobtrusive "saved" state. | |

**User's choice:** Fully invisible (recommended)

---

## Entry Segmentation Look

| Option | Description | Selected |
|--------|-------------|----------|
| Purely invisible | Blank line itself IS the boundary — no divider/extra spacing. | ✓ |
| Subtle visual cue | Faint divider or extra spacing marking the boundary. | |
| You decide | Leave to implementation-time judgment. | |

**User's choice:** Purely invisible

| Option | Description | Selected |
|--------|-------------|----------|
| Day header only | Just today's date at the top; no per-entry metadata. | ✓ |
| Per-entry timestamp | Small faint timestamp per segmented entry. | |

**User's choice:** Day header only

---

## Calendar & Delete UX

| Option | Description | Selected |
|--------|-------------|----------|
| Small icon/button in a corner | Minimal calendar icon, opens popover/panel. | |
| Keyboard shortcut + button | Corner button plus a keyboard shortcut. | ✓ |
| You decide | Leave affordance to implementation-time judgment. | |

**User's choice:** Keyboard shortcut + button

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, mark days with entries | Dot/dash under dates with content. | ✓ |
| No, plain calendar | Standard date picker, no indicators. | |

**User's choice:** Yes, mark days with entries

| Option | Description | Selected |
|--------|-------------|----------|
| Delete whole day | Deleting removes the entire day's file. | |
| Delete individual entries too | Can delete a single entry within a day. | (reframed, see notes) |

**User's choice / Notes:** User clarified that editing (and "deleting") a past day works exactly like editing today's entry — free text editing, backspace to remove characters/entries letter by letter, with no dedicated "delete entry" action. There's no special mode for old days. Only deleting the entire day's file is a distinct, dedicated action.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, confirm first | Confirmation dialog before permanent deletion. | ✓ (whole-day only) |
| No, delete immediately | No confirmation step. | ✓ (normal text edits) |

**User's choice:** Split answer — normal text editing (backspacing within a day) never asks for confirmation, since it's identical to editing today's page; confirmation is required only when deleting an entire day's file.

---

## Packaging & Signing Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Documented unsigned workaround | Unsigned/self-signed builds + README instructions to bypass Gatekeeper/SmartScreen. No cost. | ✓ |
| Full notarization/signing | Apple Developer Program ($99/yr) + Windows code-signing cert. | |
| You decide | Leave to implementation-time judgment. | |

**User's choice:** Documented unsigned workaround

**Notes:** Follow-up question about future sharing ("just for me" vs. "might share it later") was clarified by the user: the project will be a free, public GitHub repo that people can download and use. User confirmed this doesn't change anything about packaging output — it stays unsigned + documented workaround either way, since paid signing is a cost decision independent of audience size for a free personal tool.

---

## Claude's Discretion

- Exact calendar affordance styling/placement and keyboard shortcut binding.
- Exact debounce duration within ~1-2s, and calendar entry-indicator styling (dot vs. dash).

## Deferred Ideas

None — discussion stayed within phase scope.
