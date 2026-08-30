import { BaseDirectory, exists, mkdir } from "@tauri-apps/plugin-fs";
import { JOURNAL_SUBDIR } from "./dayPath";

/**
 * Single source of truth for the journal's base directory.
 *
 * This is the only module in the codebase that imports a `BaseDirectory`
 * value. Storage location decided at Task 2 (project owner, orchestrating
 * session): $APPDATA/journal/YYYY-MM-DD.md via Tauri's `BaseDirectory.AppData`.
 */
export const JOURNAL_BASE_DIR = BaseDirectory.AppData;

/** Creates the journal subfolder (recursively) if it does not already exist. */
export async function ensureJournalDir(): Promise<void> {
  const dirExists = await exists(JOURNAL_SUBDIR, { baseDir: JOURNAL_BASE_DIR });
  if (!dirExists) {
    await mkdir(JOURNAL_SUBDIR, { baseDir: JOURNAL_BASE_DIR, recursive: true });
  }
}
