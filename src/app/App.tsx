import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { EditorCanvas } from "../editor/EditorCanvas";
import { loadDay, saveDay } from "../storage/dayFile";
import { useDebouncedFlush } from "../hooks/useDebouncedFlush";

function App() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [initialText, setInitialText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { schedule, flush } = useDebouncedFlush((text) => saveDay(currentDate, text));

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
  // Plan 03's calendar will call goToDay; no calendar UI exists yet in this
  // plan (per its scope), so this reference exists only to keep goToDay
  // from being flagged as an unused local under tsconfig's noUnusedLocals
  // until that caller exists. It performs no work at runtime.
  void goToDay;

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
    <main className="app">
      <h1 className="day-header">{today}</h1>
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
    </main>
  );
}

export default App;
