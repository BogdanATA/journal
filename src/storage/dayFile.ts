import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { dayFilePath } from "./dayPath.ts";
import { ensureJournalDir, JOURNAL_BASE_DIR } from "./journalDir.ts";

/**
 * loadDay / saveDay against plugin-fs.
 *
 * Every plugin-fs call here takes its path argument directly from
 * `dayFilePath(date)` — never a string- or template-literal-constructed
 * path, and never a path stored through an intermediate variable (T-01-01).
 *
 * This module contains no destructive filesystem call of any kind.
 * Deleting a whole day's file is an explicit, confirmed action (D-09) that
 * lives in its own module (Plan 03's `src/storage/dayDelete.ts`) — keeping
 * every destructive call out of here means the read/write path is provably
 * incapable of erasing a user's day.
 */

/**
 * Identity transform applied to text immediately before it is written to
 * disk (WRITE-03/WRITE-04's byte-fidelity contract). It exists so "what's
 * on disk is exactly what was typed" has a name and a `node --test` pin
 * (dayFile.roundtrip.test.ts) instead of being an incidental property of
 * `saveDay` never happening to call `.trim()`. Must never trim, reformat,
 * rewrite line endings, or apply Unicode normalization — today, and by
 * construction, forever, since this is the one place that guarantee could
 * be silently broken.
 */
export function normalizeForWrite(text: string): string {
  return text;
}

/**
 * Identity transform applied to text immediately after it is read from
 * disk. Same contract as `normalizeForWrite`, mirrored for the read
 * direction — must never trim a BOM-less file's first character or rewrite
 * newlines.
 */
export function normalizeForRead(text: string): string {
  return text;
}

/**
 * True only when `text` contains at least one non-whitespace character —
 * the single definition of "this day has entries" (D-07's calendar dot and
 * this module's write-skip rule below both consume it, so the dot can
 * never disagree with the file).
 */
export function dayHasContent(text: string): boolean {
  return text.trim().length > 0;
}

/** Returns "" when the day file does not exist — a day never written is a blank canvas, not an error. */
export async function loadDay(date: Date): Promise<string> {
  const fileExists = await exists(dayFilePath(date), { baseDir: JOURNAL_BASE_DIR });
  if (!fileExists) return "";
  const raw = await readTextFile(dayFilePath(date), { baseDir: JOURNAL_BASE_DIR });
  return normalizeForRead(raw);
}

/**
 * Whole-file overwrite, never an append — a repeated save with the same
 * text is idempotent. Skips writing only when the day has no content by
 * `dayHasContent` AND no file exists yet for that date — a day the user
 * merely opened and never typed into must not leave a stub `.md` file
 * behind. Once a file exists, clearing it to whitespace still writes the
 * empty content through rather than erasing the file.
 */
export async function saveDay(date: Date, text: string): Promise<void> {
  if (!dayHasContent(text)) {
    const fileExists = await exists(dayFilePath(date), { baseDir: JOURNAL_BASE_DIR });
    if (!fileExists) return;
  }
  await ensureJournalDir();
  await writeTextFile(dayFilePath(date), normalizeForWrite(text), { baseDir: JOURNAL_BASE_DIR });
}
