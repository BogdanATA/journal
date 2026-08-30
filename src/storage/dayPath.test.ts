import { test } from "node:test";
import assert from "node:assert/strict";
import { dayFileName, dayFilePath, dayFromFileName } from "./dayPath.ts";

test("dayFileName zero-pads month and day using the local calendar date", () => {
  assert.equal(dayFileName(new Date(2026, 0, 5)), "2026-01-05.md");
});

test("dayFilePath joins the journal subfolder to the filename with no traversal", () => {
  const path = dayFilePath(new Date(2026, 0, 5));
  assert.match(path, /2026-01-05\.md$/);
  assert.ok(!path.includes(".."), "must not contain a .. segment");
  assert.ok(!path.startsWith("/"), "must not have a leading /");
  assert.ok(!path.includes("\\"), "must not contain a backslash");
});

test("dayFilePath throws TypeError for a non-Date argument", () => {
  // @ts-expect-error - intentionally passing a string to prove the runtime guard
  assert.throws(() => dayFilePath("2026-01-05"), TypeError);
});

test("dayFilePath throws TypeError for an Invalid Date", () => {
  assert.throws(() => dayFilePath(new Date("not-a-date")), TypeError);
});

test("dayFromFileName parses a well-formed day filename", () => {
  assert.equal(dayFromFileName("2026-01-05.md"), "2026-01-05");
});

test("dayFromFileName rejects a path-traversal attempt", () => {
  assert.equal(dayFromFileName("../../etc/passwd"), null);
});

test("dayFromFileName rejects a non-day filename", () => {
  assert.equal(dayFromFileName("notes.md"), null);
});

test("dayFromFileName rejects a non-zero-padded date", () => {
  assert.equal(dayFromFileName("2026-1-5.md"), null);
});
