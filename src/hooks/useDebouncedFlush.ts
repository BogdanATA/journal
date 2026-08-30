import { useCallback, useRef } from "react";

/**
 * schedule/flush debounce pair with in-flight write serialization.
 *
 * `schedule(text)` resets a `delayMs` timer (default 1200ms, inside D-01's
 * 1-2s band). `flush()` clears the timer and awaits the save of whatever is
 * pending. Writes are serialized on an in-flight promise ref so two saves
 * can never interleave on the same file; when a save rejects, the pending
 * text is kept so the next flush retries rather than dropping it (D-01/D-02,
 * T-01-04 mitigation).
 */
export function useDebouncedFlush(
  save: (text: string) => Promise<void>,
  delayMs = 1200,
): { schedule: (text: string) => void; flush: () => Promise<void>; hasPending: () => boolean } {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null);
  const inFlight = useRef<Promise<void>>(Promise.resolve());

  const runSave = useCallback(
    (text: string): Promise<void> => {
      const next = inFlight.current
        .catch(() => {
          // A prior save's rejection must not block the next attempt.
        })
        .then(() =>
          save(text).catch((err) => {
            // Keep the text pending so the next flush retries it, rather
            // than silently dropping the user's words.
            pending.current = text;
            throw err;
          }),
        );
      inFlight.current = next;
      return next;
    },
    [save],
  );

  const flush = useCallback((): Promise<void> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current === null) {
      return inFlight.current.catch(() => {
        // Swallow: any error from a prior save was already recorded via
        // pending.current inside runSave, and will be retried by the next flush.
      });
    }
    const text = pending.current;
    pending.current = null;
    return runSave(text);
  }, [runSave]);

  const schedule = useCallback(
    (text: string) => {
      pending.current = text;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void flush();
      }, delayMs);
    },
    [delayMs, flush],
  );

  const hasPending = useCallback(() => pending.current !== null, []);

  return { schedule, flush, hasPending };
}
