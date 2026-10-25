import { bogotaDateKey } from './incomeChart';
export type SalesRange = { start: string; end: string } | null;
const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(value+'T12:00:00-05:00').getTime());
export function monthRange(from: string, to = from): SalesRange {
  if (!valid(from) || !valid(to) || from > to) return null;
  const [year, month] = to.slice(0,7).split('-').map(Number);
  const next = new Date(Date.UTC(year,month,1)).toISOString().slice(0,10);
  return { start: new Date(from.slice(0,7)+'-01T00:00:00-05:00').toISOString(), end: new Date(next+'T00:00:00-05:00').toISOString() };
}
export const currentSalesMonth = () => monthRange(bogotaDateKey(new Date()));
export function dashboardSalesRanges(start: string, end: string, historyMonth: string, historyStart: string, historyEnd: string): SalesRange[] {
  if (!start && !end) return [null];
  const ranges: SalesRange[] = start || end ? [monthRange(start || end,end || start)] : [null];
  if (historyMonth) ranges.push(monthRange(historyMonth+'-01'));
  else if (historyStart || historyEnd) ranges.push(monthRange(historyStart || historyEnd,historyEnd || historyStart));
  if (ranges.some(r=>r===null)) return [currentSalesMonth()];
  const sorted=(ranges as Exclude<SalesRange,null>[]).sort((a,b)=>a.start.localeCompare(b.start));const merged: typeof sorted=[];
  for(const range of sorted){const last=merged.at(-1);if(last&&range.start<=last.end)last.end=last.end>range.end?last.end:range.end;else merged.push({...range});}
  return merged;
}
