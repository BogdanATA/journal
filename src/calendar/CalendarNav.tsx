import { useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import { loadDaysWithContent } from "../storage/dayIndex";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Hand-rolled month-grid calendar (no calendar/date-picker package — see
 * RESEARCH.md's "Don't Hand-Roll" table). `date-fns` supplies the month
 * math; the remaining work is a plain CSS grid plus one directory scan.
 *
 * `onSelect` is wired to the existing `goToDay(date)` seam in App.tsx — this
 * component never sets the app's current day itself, because `goToDay` is
 * what flushes the outgoing day's pending save before the new file loads
 * (D-02). Selecting a day here must never become a second navigation path.
 */
export function CalendarNav(props: {
  open: boolean;
  currentDate: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
}) {
  const { open, currentDate, onSelect, onClose } = props;
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(currentDate));
  const [daysWithContent, setDaysWithContent] = useState<Set<string>>(new Set());
  // Captured once per open, not re-evaluated on every render, so "today's"
  // ring doesn't jitter across a long-open session.
  const today = useMemo(() => new Date(), [open]);

  // Every time the calendar opens: jump the view back to the currently
  // loaded day's month, and reload the content set with a fresh
  // loadDaysWithContent() scan so the dots are never stale (T-01-12).
  useEffect(() => {
    if (!open) return;
    setViewMonth(startOfMonth(currentDate));
    let cancelled = false;
    loadDaysWithContent()
      .then((days) => {
        if (!cancelled) setDaysWithContent(days);
      })
      .catch((err: unknown) => {
        // A scan failure (e.g. a permissions error reading the journal
        // directory) is otherwise indistinguishable from a genuinely empty
        // journal — log it so it's diagnosable rather than silently
        // rendering as "no days have content" (WR-03).
        console.error("Failed to scan journal directory for calendar dots", err);
        if (!cancelled) setDaysWithContent(new Set());
      });
    return () => {
      cancelled = true;
    };
    // Deliberately open-only: re-running this on every currentDate change
    // would rescan mid-session; the calendar already reopens fresh each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Escape closes the calendar and hands focus back to the editor (via
  // App.tsx's onClose) — the keyboard path must never trap the user.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingBlanks = getDay(monthStart);

  return (
    <div className="calendar-popover" role="dialog" aria-label="Calendar">
      <div className="calendar-header">
        <button
          type="button"
          onClick={() => setViewMonth((month) => subMonths(month, 1))}
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="calendar-month-label">{format(viewMonth, "MMMM yyyy")}</span>
        <button
          type="button"
          onClick={() => setViewMonth((month) => addMonths(month, 1))}
          aria-label="Next month"
        >
          ›
        </button>
      </div>
      <div className="calendar-grid">
        {WEEKDAY_LABELS.map((label, index) => (
          <div key={`weekday-${index}`} className="calendar-weekday">
            {label}
          </div>
        ))}
        {Array.from({ length: leadingBlanks }).map((_, index) => (
          <div key={`blank-${index}`} className="calendar-day calendar-day-blank" />
        ))}
        {daysInMonth.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const hasContent = daysWithContent.has(key);
          const isSelected = isSameDay(day, currentDate);
          const isToday = isSameDay(day, today);
          const classNames = ["calendar-day"];
          if (isSelected) classNames.push("calendar-day-selected");
          if (isToday) classNames.push("calendar-day-today");
          return (
            <button
              key={key}
              type="button"
              className={classNames.join(" ")}
              onClick={() => onSelect(day)}
              aria-label={format(day, "EEEE, d MMMM yyyy") + (hasContent ? " — has entries" : "")}
            >
              {format(day, "d")}
              {hasContent && <span className="calendar-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
