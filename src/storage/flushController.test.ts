import { test } from "node:test";
import assert from "node:assert/strict";
import { createFlushController } from "../hooks/flushController.ts";

/**
 * These tests exercise the pure write-serialization core that backs
 * `useDebouncedFlush` (src/hooks/flushController.ts). They live under
 * src/storage/ — alongside the storage layer's other `node --test` coverage
 * — because the controller has no React dependency and can run directly
 * under `node --test src/storage/`, which is this plan's verify gate; a
 * React hook itself cannot be invoked outside a component without a DOM
 * renderer, so the serialization logic is tested at this pure layer instead.
 */

test("two rapid schedule() calls collapse into one save call carrying the newest text", async () => {
  const calls: string[] = [];
  const controller = createFlushController(async (text) => {
    calls.push(text);
  });

  controller.schedule("first");
  controller.schedule("second");
  await controller.flush();

  assert.deepEqual(calls, ["second"]);
});

test("flush() awaits an in-flight write, then the newest pending write, in order", async () => {
  const calls: string[] = [];
  const resolvers: Array<() => void> = [];
  const controller = createFlushController(
    (text) =>
      new Promise<void>((resolve) => {
        calls.push(text);
        resolvers.push(resolve);
      }),
  );

  controller.schedule("A");
  const firstFlush = controller.flush(); // starts save("A"); still pending

  await new Promise((resolve) => setTimeout(resolve, 0)); // let save("A") actually start

  controller.schedule("B");
  const secondFlush = controller.flush(); // must wait for "A" before starting "B"

  assert.deepEqual(calls, ["A"], "save(\"B\") must not start before save(\"A\") settles");

  resolvers[0]();
  await new Promise((resolve) => setTimeout(resolve, 0)); // drain microtasks

  assert.deepEqual(calls, ["A", "B"]);

  resolvers[1]();
  await firstFlush;
  await secondFlush;
});

test("a rejected save retains its text so the next flush() retries it", async () => {
  const calls: string[] = [];
  let shouldFail = true;
  const controller = createFlushController(async (text) => {
    calls.push(text);
    if (shouldFail) {
      shouldFail = false;
      throw new Error("simulated write failure");
    }
  });

  controller.schedule("keep me");
  await assert.rejects(() => controller.flush());
  assert.equal(controller.hasPending(), true, "the failed text must stay pending, not be dropped");

  await controller.flush();

  assert.deepEqual(calls, ["keep me", "keep me"]);
  assert.equal(controller.hasPending(), false);
});

test("flush() with nothing pending resolves without calling save at all", async () => {
  let callCount = 0;
  const controller = createFlushController(async () => {
    callCount++;
  });

  await controller.flush();

  assert.equal(callCount, 0);
});

test("hasPending() is true after schedule() and false once the write resolves", async () => {
  const controller = createFlushController(async () => {});

  assert.equal(controller.hasPending(), false);
  controller.schedule("x");
  assert.equal(controller.hasPending(), true);
  await controller.flush();
  assert.equal(controller.hasPending(), false);
});

test("cancel() clears a scheduled write so a subsequent flush() never calls save (Plan 03 delete-day)", async () => {
  const calls: string[] = [];
  const controller = createFlushController(async (text) => {
    calls.push(text);
  });

  controller.schedule("should never reach disk");
  controller.cancel();
  assert.equal(controller.hasPending(), false);

  await controller.flush();
  assert.deepEqual(calls, []);
});
