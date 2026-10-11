const dayMs = 86400000;

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function previousPeriod(startDate: string, endDate: string): { start: Date; end: Date } | null {
  const from = parseDate(startDate);
  const through = parseDate(endDate);
  if (!from || !through || through < from) return null;

  // Month-to-date and complete months compare with the prior calendar month.
  // Other ranges compare with the immediately preceding interval of equal length.
  if (from.getDate() === 1 && from.getFullYear() === through.getFullYear() && from.getMonth() === through.getMonth()) {
    const priorLastDay = new Date(from.getFullYear(), from.getMonth(), 0).getDate();
    const currentLastDay = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
    const endDay = through.getDate() === currentLastDay ? priorLastDay : Math.min(through.getDate(), priorLastDay);
    return {
      start: new Date(from.getFullYear(), from.getMonth() - 1, 1),
      end: new Date(from.getFullYear(), from.getMonth() - 1, endDay, 23, 59, 59, 999)
    };
  }

  const days = Math.round((Date.UTC(through.getFullYear(), through.getMonth(), through.getDate()) - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / dayMs) + 1;
  const start = new Date(from);
  start.setDate(start.getDate() - days);
  const end = new Date(from);
  end.setMilliseconds(-1);
  return { start, end };
}
