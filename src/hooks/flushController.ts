/**
 * Pure, framework-free debounce+flush write-serialization core.
 *
 * No React and no Tauri imports, so this runs directly under `node --test`
 * (see src/storage/flushController.test.ts, colocated with the storage
 * layer's other `node --test` coverage per this plan's verify gate — the
 * controller has no filesystem dependency itself, but a React hook cannot
 * be invoked outside a component without a DOM renderer, so this pure core
 * is what gets unit-tested). The React-facing wrapper that persists one
 * instance of this per component is `src/hooks/useDebouncedFlush.ts`.
 *
 * `schedule(text)` resets a `delayMs` timer (default 1200ms, inside D-01's
 * 1-2s band). `flush()` clears the timer and awaits the save of whatever is
 * pending, chained after any write already in flight so two writes are
 * never outstanding against the same file at once and the last one always
 * carries the newest text. A rejected save puts its text back into pending
 * so the next flush retries it instead of silently dropping it (D-01/D-02,
 * T-01-06 mitigation).
 */
export interface FlushController {
  schedule: (text: string) => void;
  flush: () => Promise<void>;
  hasPending: () => boolean;
  cancel: () => void;
}

export function createFlushController(
  save: (text: string) => Promise<void>,
  delayMs = 1200,
): FlushController {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: string | null = null;
  let inFlight: Promise<void> = Promise.resolve();

  function runSave(text: string): Promise<void> {
    const next = inFlight
      .catch(() => {
        // A prior save's rejection must not block the next attempt.
      })
      .then(() =>
        save(text).catch((err: unknown) => {
          // Keep the text pending so the next flush retries it, rather
          // than silently dropping the user's words.
          pending = text;
          throw err;
        }),
      );
    inFlight = next;
    return next;
  }

  function flush(): Promise<void> {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending === null) {
      return inFlight.catch(() => {
        // Swallow: any error from a prior save was already recorded via
        // `pending` inside runSave, and will be retried by the next flush.
      });
    }
    const text = pending;
    pending = null;
    return runSave(text);
  }

  function schedule(text: string): void {
    pending = text;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void flush();
    }, delayMs);
  }

  function hasPending(): boolean {
    return pending !== null;
  }

  /**
   * Clears a scheduled write without ever invoking `save` — used by the
   * delete-day flow (Plan 03) so a debounce timer queued just before a
   * confirmed delete can never fire afterward and resurrect the just-removed
   * file with stale text. Does not touch a write already in flight; that
   * write's own promise settles normally (see `runSave`).
   */
  function cancel(): void {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    pending = null;
  }

  return { schedule, flush, hasPending, cancel };
}
