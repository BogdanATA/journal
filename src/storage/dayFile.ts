import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { dayFilePath } from "./dayPath";
import { ensureJournalDir, JOURNAL_BASE_DIR } from "./journalDir";

/**
 * loadDay / saveDay against plugin-fs.
 *
 * Every plugin-fs call here takes its path argument directly from
 * `dayFilePath(date)` — never a string- or template-literal-constructed
 * path, and never a path stored through an intermediate variable (T-01-01).
 */

/** Returns "" when the day file does not exist — a day never written is a blank canvas, not an error. */
export async function loadDay(date: Date): Promise<string> {
  const fileExists = await exists(dayFilePath(date), { baseDir: JOURNAL_BASE_DIR });
  if (!fileExists) return "";
  return readTextFile(dayFilePath(date), { baseDir: JOURNAL_BASE_DIR });
}

/** Whole-file overwrite, never an append — a repeated save with the same text is idempotent. */
export async function saveDay(date: Date, text: string): Promise<void> {
  await ensureJournalDir();
  await writeTextFile(dayFilePath(date), text, { baseDir: JOURNAL_BASE_DIR });
}
