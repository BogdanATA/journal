import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { confirm } from "@tauri-apps/plugin-dialog";
import { EditorCanvas } from "../editor/EditorCanvas";
import { dayHasContent, loadDay, saveDay } from "../storage/dayFile";
import { deleteDay } from "../storage/dayDelete";
import { useDebouncedFlush } from "../hooks/useDebouncedFlush";
import { CalendarNav } from "../calendar/CalendarNav";

function CalendarIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function App() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [initialText, setInitialText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  // Tracks whether the currently loaded day has real content, purely to
  // decide whether the delete-day control is shown — never consumed by
  // save/load logic (dayHasContent in dayFile.ts remains the single
  // definition of "this day has entries" for that purpose).
  const [hasContent, setHasContent] = useState(false);
  // True for the duration of goToDay's flush->load gap — makes the editor
  // read-only so a fast typist can't type into the outgoing day's buffer
  // while it's being swapped out from under them (CR-02).
  const [navigating, setNavigating] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const { schedule, flush, cancel } = useDebouncedFlush((text) => saveDay(currentDate, text));

  // Returns focus to the editor's contenteditable surface — used whenever
  // the calendar closes, so the keyboard path (Mod-j / Escape) never traps
  // the user outside the writing surface (D-06).
  const focusEditor = useCallback(() => {
    mainRef.current?.querySelector<HTMLElement>(".cm-content")?.focus();
  }, []);

  const toggleCalendar = useCallback(() => {
    setCalendarOpen((open) => {
      const next = !open;
      if (!next) requestAnimationFrame(() => focusEditor());
      return next;
    });
  }, [focusEditor]);

  const closeCalendar = useCallback(() => {
    setCalendarOpen(false);
    requestAnimationFrame(() => focusEditor());
  }, [focusEditor]);

  // Cmd+J on macOS, Ctrl+J on Windows — chosen because it collides with
  // neither CodeMirror's default keymap nor common webview chrome bindings
  // (D-06's fast keyboard path to the calendar).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        toggleCalendar();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleCalendar]);

  // Loads only the initial (mount-time) day. Every subsequent day change
  // goes exclusively through goToDay below, which flushes the outgoing
  // day's pending save before it loads and switches to the next one — if
  // this effect also re-ran on every currentDate change, it would race a
  // second, redundant load against goToDay's own load.
  useEffect(() => {
    let cancelled = false;
    loadDay(currentDate)
      .then((text) => {
        if (!cancelled) {
          setInitialText(text);
          setHasContent(dayHasContent(text));
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setInitialText("");
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Flush-then-load day-navigation seam (D-02). Nothing else may assign
   * the current-day state — that ordering is what stops a pending debounced
   * write from landing in the wrong day's file. If the flush itself fails,
   * the write controller has already put the text back into its own
   * pending state for retry (see flushController.ts), so navigation is
   * aborted here rather than proceeding: switching `currentDate` would
   * repoint future retries at the new day's file instead of the one the
   * failed write actually belongs to.
   */
  const goToDay = useCallback(
    async (next: Date) => {
      setNavigating(true);
      try {
        await flush();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setNavigating(false);
        return;
      }
      try {
        const text = await loadDay(next);
        setCurrentDate(next);
        setInitialText(text);
        setHasContent(dayHasContent(text));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setNavigating(false);
      }
    },
    [flush],
  );
  // The calendar's day selection calls goToDay directly (see the render
  // below) — this is the only place currentDate is ever assigned, per the
  // seam's own contract above.
  const handleCalendarSelect = useCallback(
    (date: Date) => {
      setCalendarOpen(false);
      requestAnimationFrame(() => focusEditor());
      void goToDay(date);
    },
    [goToDay, focusEditor],
  );

  /**
   * The one destructive action in the app (D-09/T-01-10) — deletes the
   * currently loaded day's whole file, after an explicit confirmation
   * naming that exact date. This is the only confirmation dialog anywhere
   * in the app: ordinary editing (backspacing, select-delete, clearing the
   * buffer by hand) never prompts, because that is just normal typing and
   * the existing autosave/write-skip path already handles it (dayFile.ts).
   */
  const handleDeleteDay = useCallback(async () => {
    const dateLabel = format(currentDate, "EEEE, d MMMM yyyy");
    const confirmed = await confirm(
      `Delete the entry for ${dateLabel}? This cannot be undone — there is no backup.`,
      { title: "Delete day", kind: "warning", okLabel: "Delete", cancelLabel: "Cancel" },
    );
    if (!confirmed) return; // No partial clear, no save — do nothing at all.

    // Cancel any debounced write still pending for this date *before*
    // deleting the file — otherwise a save scheduled just before the click
    // could fire after deleteDay() resolves and silently resurrect the file
    // with stale text. Must happen only after the user confirms (cancelling
    // earlier, e.g. before the dialog opens, would silently drop their
    // pending text on a Cancel click, which the "do nothing at all"
    // contract above forbids). cancel() alone does not touch a write that
    // is already in flight (its own promise settles independently), so a
    // debounce timer that had already fired right before the click could
    // still land after deleteDay() and resurrect the file — await flush()
    // as well, which waits out anything already in flight before deleting
    // (CR-04). A failed flush here just means nothing new landed on disk;
    // proceed to delete regardless.
    cancel();
    try {
      await flush();
    } catch {
      // Intentionally ignored — see comment above.
    }
    try {
      await deleteDay(currentDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    setInitialText("");
    setHasContent(false);
    setError(null);
    // The now-empty buffer's own change still schedules a debounced save
    // via EditorCanvas's updateListener, but saveDay's write-skip rule
    // (dayFile.ts: !dayHasContent(text) && !exists()) already refuses to
    // write when there is no content and no file — so that scheduled save
    // can never recreate the file we just removed (Plan 02's write-skip
    // rule, asserted explicitly here per this task's own requirement).
  }, [currentDate, cancel, flush]);

  // Flush on quit (D-02): intercept the window close request, flush the
  // pending save, and only then let the window actually close. `destroy()`
  // always runs from `finally` so a rejected flush can never leave the app
  // unquittable (T-01-05). `closingRef` guards re-entry: a second close
  // request while the first flush is still running awaits that same
  // in-flight flush (via `flushPromiseRef`) rather than destroying the
  // window while its write is still outstanding (CR-03).
  const closingRef = useRef(false);
  // Tracks the in-flight close-time flush so a second close request (a
  // double Cmd+Q/Alt+F4, or an OS logout sending the close event twice)
  // awaits the first flush's write instead of destroying the window out
  // from under it (CR-03).
  const flushPromiseRef = useRef<Promise<void> | null>(null);
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    const win = getCurrentWindow();
    void win
      .onCloseRequested(async (event) => {
        event.preventDefault();
        if (closingRef.current) {
          try {
            await flushPromiseRef.current;
          } catch (err) {
            console.error("Flush failed on quit; last edit may not be saved", err);
          }
          await win.destroy();
          return;
        }
        closingRef.current = true;
        flushPromiseRef.current = flush();
        try {
          await flushPromiseRef.current;
        } catch (err) {
          console.error("Flush failed on quit; last edit may not be saved", err);
        } finally {
          await win.destroy();
        }
      })
      .then((un) => {
        if (cancelled) {
          un();
        } else {
          unlisten = un;
        }
      });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [flush]);

  // Stable identities for the handlers passed into <EditorCanvas>, so
  // EditorCanvas's own useMemo over its behavior extensions isn't
  // invalidated on every App render (App re-renders on every keystroke via
  // handleScheduleSave itself) — otherwise a new extensions array would be
  // handed to @uiw/react-codemirror on every keystroke (WR-01).
  const handleScheduleSave = useCallback(
    (text: string) => {
      schedule(text);
      setHasContent(dayHasContent(text));
      setError(null);
    },
    [schedule],
  );
  const handleEditorFlush = useCallback(() => {
    void flush().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [flush]);

  const today = format(currentDate, "EEEE, d MMMM yyyy");

  return (
    <main className="app" ref={mainRef}>
      <div className="chrome-row">
        <h1 className="day-header">{today}</h1>
        <div className="chrome-actions">
          {hasContent && (
            <button
              type="button"
              className="icon-button delete-button"
              onClick={() => void handleDeleteDay()}
              aria-label={`Delete entry for ${today}`}
              title="Delete this day"
            >
              <TrashIcon />
            </button>
          )}
          <button
            type="button"
            className="icon-button"
            onClick={toggleCalendar}
            aria-label="Open calendar"
            title="Calendar (Cmd/Ctrl+J)"
          >
            <CalendarIcon />
          </button>
        </div>
      </div>
      {error !== null && <p className="error">{error}</p>}
      {initialText !== null && (
        <EditorCanvas
          key={format(currentDate, "yyyy-MM-dd")}
          date={currentDate}
          initialText={initialText}
          readOnly={navigating}
          onScheduleSave={handleScheduleSave}
          onFlush={handleEditorFlush}
        />
      )}
      <CalendarNav
        open={calendarOpen}
        currentDate={currentDate}
        onSelect={handleCalendarSelect}
        onClose={closeCalendar}
      />
    </main>
  );
}

export default App;
