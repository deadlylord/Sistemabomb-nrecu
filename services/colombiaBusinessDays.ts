import { bogotaDateKey } from './incomeChart';

const DAY = 86_400_000;
const holidaysByYear = new Map<number, Set<number>>();
const dayNumber = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day) / DAY;
const weekday = (day: number) => new Date(day * DAY).getUTCDay();
const nextMonday = (day: number) => day + (8 - weekday(day)) % 7;

// Gregorian Easter (integer computus), kept local: no calendar API or Firebase reads.
function easterDay(year: number): number {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const value = h + l - 7 * m + 114;
  return dayNumber(year, Math.floor(value / 31), value % 31 + 1);
}

function holidays(year: number): Set<number> {
  const cached = holidaysByYear.get(year);
  if (cached) return cached;
  // Colombian national holidays, Ley 51 de 1983 art. 1:
  // https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4954
  const days = new Set<number>();
  for (const [month, day] of [[1, 1], [5, 1], [7, 20], [8, 7], [12, 8], [12, 25]]) {
    days.add(dayNumber(year, month, day));
  }
  for (const [month, day] of [[1, 6], [3, 19], [6, 29], [8, 15], [10, 12], [11, 1], [11, 11]]) {
    days.add(nextMonday(dayNumber(year, month, day)));
  }
  const easter = easterDay(year);
  days.add(easter - 3); // Maundy Thursday
  days.add(easter - 2); // Good Friday
  for (const offset of [39, 60, 68]) days.add(nextMonday(easter + offset));
  holidaysByYear.set(year, days);
  return days;
}

// Elapsed business dates in Bogotá: (creation date, today's date].
// Whole weeks are counted arithmetically, then at most six remaining dates.
// Only the small cached holiday set is examined for each affected year.
export function colombiaBusinessDaysSince(createdAt: string, now: Date): number | null {
  const startKey = bogotaDateKey(createdAt), endKey = bogotaDateKey(now);
  if (!startKey || !endKey || new Date(createdAt).getTime() > now.getTime()) return null;
  const start = Date.parse(startKey) / DAY, end = Date.parse(endKey) / DAY;
  if (end < start) return null;
  const length = end - start;
  let total = Math.floor(length / 7) * 5;
  const remainderStart = start + Math.floor(length / 7) * 7;
  for (let day = remainderStart + 1; day <= end; day++) {
    if (weekday(day) !== 0 && weekday(day) !== 6) total++;
  }
  for (let year = Number(startKey.slice(0, 4)); year <= Number(endKey.slice(0, 4)); year++) {
    for (const day of holidays(year)) {
      if (day > start && day <= end && weekday(day) !== 0 && weekday(day) !== 6) total--;
    }
  }
  return total;
}
