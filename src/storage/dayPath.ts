import { format } from "date-fns";

/**
 * Pure day-file path construction and validation.
 *
 * This module imports only `date-fns` — never a Tauri package — so it can
 * run directly under `node --test` with no webview and no Rust core.
 * `src/storage/journalDir.ts` is the only module allowed to import a
 * `BaseDirectory` value; this module only ever produces a relative path
 * string within the journal subfolder.
 */

/** Plain folder-name string for the journal subfolder (appdata storage choice). */
export const JOURNAL_SUBDIR = "journal";

const DAY_FILENAME_PATTERN = /^(\d{4}-\d{2}-\d{2})\.md$/;

function assertValidDate(date: Date): void {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError(
      "dayFilePath/dayFileName require a valid Date instance",
    );
  }
}

/** "2026-01-05.md" — zero-padded month and day, local calendar date. */
export function dayFileName(date: Date): string {
  assertValidDate(date);
  return `${format(date, "yyyy-MM-dd")}.md`;
}

/** "<JOURNAL_SUBDIR>/2026-01-05.md" — never contains "..", a leading "/", or a backslash. */
export function dayFilePath(date: Date): string {
  assertValidDate(date);
  return `${JOURNAL_SUBDIR}/${dayFileName(date)}`;
}

/**
 * "2026-01-05.md" -> "2026-01-05", else null.
 * Validated against an anchored YYYY-MM-DD.md pattern rather than by
 * stripping a suffix, so a malformed or path-traversal-shaped name can
 * never smuggle a non-day string through.
 */
export function dayFromFileName(name: string): string | null {
  const match = DAY_FILENAME_PATTERN.exec(name);
  return match ? match[1] : null;
}
