import { exists, remove } from "@tauri-apps/plugin-fs";
import { dayFilePath } from "./dayPath.ts";
import { JOURNAL_BASE_DIR } from "./journalDir.ts";

/**
 * The only module in the codebase permitted to remove a day's file
 * (D-09/T-01-09). `dayFile.ts` stays provably incapable of deleting
 * anything — every write there is a whole-file overwrite, never a delete.
 *
 * Every plugin-fs call here takes its path argument directly from
 * `dayFilePath(date)` — never through an intermediate path variable — the
 * same convention `dayFile.ts` established (T-01-01), so this module can
 * never touch a path built from anything other than a validated `Date`.
 *
 * A missing file is treated as success rather than an error, so a
 * double-click (or any caller racing an already-completed delete) cannot
 * surface a confusing failure.
 */
export async function deleteDay(date: Date): Promise<void> {
  const fileExists = await exists(dayFilePath(date), { baseDir: JOURNAL_BASE_DIR });
  if (!fileExists) return;
  await remove(dayFilePath(date), { baseDir: JOURNAL_BASE_DIR });
}
