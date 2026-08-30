import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeForWrite, normalizeForRead, dayHasContent } from "./dayFile.ts";

/**
 * Proves the text transform applied on save and load is the identity
 * function (WRITE-03/WRITE-04). No Tauri call is exercised here — only the
 * two pure passthroughs and dayHasContent — so this runs under plain
 * `node --test` with no webview and no Rust core.
 */

test("normalizeForWrite/normalizeForRead preserve a single blank-line boundary exactly", () => {
  const text = "First paragraph.\n\nSecond paragraph.";
  assert.equal(normalizeForWrite(text), text);
  assert.equal(normalizeForRead(text), text);
});

test("normalizeForWrite/normalizeForRead preserve four consecutive newlines verbatim", () => {
  const text = "One\n\n\n\nTwo";
  assert.equal(normalizeForWrite(text), text);
  assert.equal(normalizeForRead(text), text);
});

test("normalizeForWrite does not append a trailing newline to text that lacks one", () => {
  const text = "no trailing newline here";
  assert.equal(normalizeForWrite(text), text);
  assert.ok(!normalizeForWrite(text).endsWith("\n"));
});

test("normalizeForWrite keeps exactly one trailing newline when the text already ends with one", () => {
  const text = "ends with exactly one newline\n";
  assert.equal(normalizeForWrite(text), text);
  assert.ok(!normalizeForWrite(text).endsWith("\n\n"));
});

test("CRLF input survives unchanged in both directions", () => {
  const text = "line one\r\nline two\r\n\r\nline three";
  assert.equal(normalizeForWrite(text), text);
  assert.equal(normalizeForRead(text), text);
});

test("emoji, CJK, and RTL text round-trip with identical code points", () => {
  const text = "emoji \u{1F600} CJK 日本語 RTL مرحبا";
  assert.equal(normalizeForWrite(text), text);
  assert.equal(normalizeForRead(text), text);
});

test("a combining-accent sequence is not folded into its precomposed form", () => {
  // "e" (U+0065) followed by COMBINING ACUTE ACCENT (U+0301) — two distinct
  // code points, not the single precomposed U+00E9 an NFC normalization
  // would fold them into. Sanity-check the fixture itself actually
  // exercises that gap before asserting the transform leaves it alone.
  const decomposed = "é";
  const precomposed = "é";
  assert.notEqual(decomposed, precomposed);
  assert.equal(decomposed.normalize("NFC"), precomposed);

  assert.equal(normalizeForWrite(decomposed), decomposed);
  assert.equal(normalizeForRead(decomposed), decomposed);
  assert.notEqual(normalizeForWrite(decomposed), precomposed);
});

test("leading and trailing spaces on a line are preserved", () => {
  const text = "   leading spaces\ntrailing spaces   \n   both   ";
  assert.equal(normalizeForWrite(text), text);
  assert.equal(normalizeForRead(text), text);
});

test("dayHasContent is false for empty or whitespace-only text", () => {
  assert.equal(dayHasContent(""), false);
  assert.equal(dayHasContent("   "), false);
  assert.equal(dayHasContent("\n\n\t\n"), false);
});

test("dayHasContent is true when any non-whitespace character is present", () => {
  assert.equal(dayHasContent("a"), true);
  assert.equal(dayHasContent("\n\nx\n"), true);
});
