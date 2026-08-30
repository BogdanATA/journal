import { useRef } from "react";
import { createFlushController, type FlushController } from "./flushController";

/**
 * React wrapper around the pure `flushController` write-serialization core
 * (src/hooks/flushController.ts).
 *
 * The controller instance is created once per component instance and never
 * replaced, so the returned `schedule`/`flush`/`hasPending` keep a stable
 * identity across renders — safe to list in an effect's dependency array
 * (e.g. the app-close interception in App.tsx) without re-registering that
 * effect on every render. The `save` callback itself is *not* captured at
 * creation time: each write reads it from `saveRef`, which is updated on
 * every render, so a `save` closure over render-scoped state (e.g. the
 * currently open day) is always current for a write that starts after that
 * render — this is what lets `goToDay` change which file `flush()` targets
 * without recreating the controller (and losing its pending/in-flight
 * state) mid-navigation.
 */
export function useDebouncedFlush(
  save: (text: string) => Promise<void>,
  delayMs = 1200,
): FlushController {
  const saveRef = useRef(save);
  saveRef.current = save;

  const controllerRef = useRef<FlushController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = createFlushController((text) => saveRef.current(text), delayMs);
  }
  return controllerRef.current;
}
