import { readDir, readTextFile } from "@tauri-apps/plugin-fs";
import { dayFromFileName, JOURNAL_SUBDIR } from "./dayPath.ts";
import { dayHasContent } from "./dayFile.ts";
import { ensureJournalDir, JOURNAL_BASE_DIR } from "./journalDir.ts";

/**
 * Journal-folder scan producing the set of days that have non-empty content
 * (D-07's calendar-dot data source). File existence alone is not enough —
 * that is what would put a dot on a day the user opened and never wrote in,
 * or one whose text was cleared to whitespace. `dayHasContent` (dayFile.ts)
 * is the single definition of "this day has entries", reused here rather
 * than reimplemented, so the dot can never disagree with the file.
 *
 * This is a live scan, run fresh every time the calendar opens (T-01-12) —
 * no persisted index is built or cached, so the dots can never disagree
 * with the folder, which is the actual source of truth.
 */

/** The subset of a plugin-fs `DirEntry` this module actually needs. */
export interface ScannableEntry {
  name: string;
  isFile: boolean;
}

/**
 * Pure filtering step, separated from the Tauri-calling `loadDaysWithContent`
 * below so it is directly `node --test`-able with no webview and no Rust
 * core: entries and a text-reader function are passed in as plain values
 * (see `src/storage/dayIndex.test.ts`). A failed per-file read is caught and
 * that day is skipped rather than failing the whole scan (T-01-11) — one
 * unreadable file cannot break navigation to every other day.
 */
export async function filterDaysWithContent(
  entries: ScannableEntry[],
  readText: (name: string) => Promise<string>,
): Promise<Set<string>> {
  const days = new Set<string>();
  for (const entry of entries) {
    if (!entry.isFile) continue;
    const day = dayFromFileName(entry.name);
    if (day === null) continue;
    let text: string;
    try {
      text = await readText(entry.name);
    } catch {
      continue;
    }
    if (dayHasContent(text)) {
      days.add(day);
    }
  }
  return days;
}

/** Scans the journal folder and returns the set of "YYYY-MM-DD" days that have real content. */
export async function loadDaysWithContent(): Promise<Set<string>> {
  await ensureJournalDir();
  const entries = await readDir(JOURNAL_SUBDIR, { baseDir: JOURNAL_BASE_DIR });
  return filterDaysWithContent(entries, (name) =>
    readTextFile(`${JOURNAL_SUBDIR}/${name}`, { baseDir: JOURNAL_BASE_DIR }),
  );
}
