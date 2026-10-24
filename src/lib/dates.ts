/**
 * Calendar-day helpers.
 *
 * Expenses are stored as a **local calendar day** — `'YYYY-MM-DD'` — not as a
 * UTC timestamp. The reason is a concrete bug rather than purity: a coffee bought
 * at 23:30 in Lagos is `2026-10-24T22:30Z`, which a UTC-based `date()` would file
 * under the 24th in winter but shift a whole hour's worth of late-evening
 * expenses to the wrong day elsewhere. "Which day did I spend this?" is a
 * question about the person's wall clock, so the wall clock is what gets stored.
 */

const pad = (n: number): string => String(n).padStart(2, '0');

/** Formats a `Date` as the local calendar day, `'YYYY-MM-DD'`. */
export function toDayString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses `'YYYY-MM-DD'` as a **local** midnight, avoiding the UTC shift of `Date.parse`. */
export function fromDayString(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}

/** Today as a local calendar day. */
export function todayString(now: Date = new Date()): string {
  return toDayString(now);
}

/**
 * A month key, `'YYYY-MM'`, and the inclusive `[first, last]` day bounds.
 *
 * Returning inclusive string bounds is what lets the repository use a single
 * `spent_on BETWEEN ? AND ?`, which SQLite can answer from the `spent_on` index.
 * Computing bounds with `Date` arithmetic (rather than a month-length table)
 * means February and leap years are correct without a special case.
 */
export function monthBounds(month: string): { first: string; last: string } {
  const [year, monthIndex] = month.split('-').map(Number);
  // Day 0 of the *next* month is the last day of this one.
  const lastDay = new Date(year, monthIndex, 0).getDate();
  return { first: `${month}-01`, last: `${month}-${pad(lastDay)}` };
}

/** `'2026-10'` for the given date's local month. */
export function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** Current month key. */
export function currentMonthKey(now: Date = new Date()): string {
  return monthKeyOf(now);
}

/**
 * Shifts a month key by `delta` months, e.g. `shiftMonth('2026-01', -1) === '2025-12'`.
 *
 * Uses `Date` to normalise the wrap rather than doing month arithmetic by hand,
 * because `0` and `13` month indices are exactly where hand-rolled code breaks.
 */
export function shiftMonth(month: string, delta: number): string {
  const [year, monthIndex] = month.split('-').map(Number);
  return monthKeyOf(new Date(year, monthIndex - 1 + delta, 1));
}

/** Human label for a month key, e.g. `'October 2026'`. */
export function formatMonthLabel(month: string): string {
  const [year, monthIndex] = month.split('-').map(Number);
  const date = new Date(year, monthIndex - 1, 1);
  // `Intl` is optional here; the index fallback keeps this working without ICU.
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
  } catch {
    const names = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return `${names[monthIndex - 1]} ${year}`;
  }
}

/** Short day label for chart axes, e.g. `'24'`. */
export function dayOfMonth(day: string): number {
  return Number(day.slice(8, 10));
}

/** Every day string in an inclusive range — used to render zero-spend days on the bar chart. */
export function daysInRange(first: string, last: string): string[] {
  const out: string[] = [];
  const start = fromDayString(first);
  const end = fromDayString(last);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(toDayString(d));
  }
  return out;
}
