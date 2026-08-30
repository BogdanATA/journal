import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { EditorCanvas } from "../editor/EditorCanvas";
import { loadDay, saveDay } from "../storage/dayFile";
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

function App() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [initialText, setInitialText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const { schedule, flush } = useDebouncedFlush((text) => saveDay(currentDate, text));

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
        if (!cancelled) setInitialText(text);
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
      try {
        await flush();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return;
      }
      try {
        const text = await loadDay(next);
        setCurrentDate(next);
        setInitialText(text);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
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

  // Flush on quit (D-02): intercept the window close request, flush the
  // pending save, and only then let the window actually close. `destroy()`
  // always runs from `finally` so a rejected flush can never leave the app
  // unquittable (T-01-05). `closingRef` guards re-entry: a second close
  // request while the first flush is still running destroys immediately
  // instead of queueing a second flush.
  const closingRef = useRef(false);
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    const win = getCurrentWindow();
    void win
      .onCloseRequested(async (event) => {
        event.preventDefault();
        if (closingRef.current) {
          await win.destroy();
          return;
        }
        closingRef.current = true;
        try {
          await flush();
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

  const today = format(currentDate, "EEEE, d MMMM yyyy");

  return (
    <main className="app" ref={mainRef}>
      <div className="chrome-row">
        <h1 className="day-header">{today}</h1>
        <div className="chrome-actions">
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
          date={currentDate}
          initialText={initialText}
          onScheduleSave={(text) => {
            schedule(text);
            setError(null);
          }}
          onFlush={() => {
            void flush().catch((err: unknown) => {
              setError(err instanceof Error ? err.message : String(err));
            });
          }}
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
