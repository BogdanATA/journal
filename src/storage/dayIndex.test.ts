import { test } from "node:test";
import assert from "node:assert/strict";
import { filterDaysWithContent } from "./dayIndex.ts";

/**
 * Pins the pure filtering step behind `loadDaysWithContent` (D-07's
 * calendar-dot data source): given directory entries and a text-reader
 * function, only anchored `YYYY-MM-DD.md` files whose content is non-empty
 * by `dayHasContent` end up in the result. No Tauri call is exercised here —
 * entries and file contents are passed in as plain values — so this runs
 * under plain `node --test` with no webview and no Rust core.
 */

test("an existing but blank file produces no dot — only real content counts", async () => {
  const entries = [
    { name: "2026-08-29.md", isFile: true },
    { name: "2026-08-30.md", isFile: true },
  ];
  const contents: Record<string, string> = {
    "2026-08-29.md": "hello",
    "2026-08-30.md": "   \n\n",
  };
  const days = await filterDaysWithContent(entries, async (name) => contents[name]);
  assert.deepEqual([...days], ["2026-08-29"]);
});

test("a directory entry is ignored even if its name looks like a day file", async () => {
  const entries = [{ name: "2026-08-31.md", isFile: false }];
  const days = await filterDaysWithContent(entries, async () => {
    throw new Error("must not be read — isFile is false");
  });
  assert.deepEqual([...days], []);
});

test("non-day filenames are ignored: notes.md, README, a non-zero-padded date, and .DS_Store", async () => {
  const entries = [
    { name: "notes.md", isFile: true },
    { name: "README", isFile: true },
    { name: "2026-8-1.md", isFile: true },
    { name: ".DS_Store", isFile: true },
  ];
  const days = await filterDaysWithContent(entries, async () => {
    throw new Error("must not be read — none of these are anchored YYYY-MM-DD.md names");
  });
  assert.deepEqual([...days], []);
});

test("an empty directory yields an empty set rather than throwing", async () => {
  const days = await filterDaysWithContent([], async () => {
    throw new Error("must not be read — there are no entries");
  });
  assert.deepEqual([...days], []);
});

test("a file whose read fails is skipped and the scan still returns the other days", async () => {
  const entries = [
    { name: "2026-08-29.md", isFile: true },
    { name: "2026-08-30.md", isFile: true },
  ];
  const days = await filterDaysWithContent(entries, async (name) => {
    if (name === "2026-08-30.md") throw new Error("simulated read failure");
    return "content";
  });
  assert.deepEqual([...days], ["2026-08-29"]);
});
