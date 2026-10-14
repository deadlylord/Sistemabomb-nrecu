export interface IncomeChartPayment { date: string; amount: number; paymentMethod: string }
export interface IncomeChartPoint { label: string; total: number; partialTotal: number }

export function isPeriodIncome(paymentMethod: string): boolean {
  return paymentMethod !== 'Bono de Regalo';
}

const bogotaFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' });

export function bogotaDateKey(date: string | Date): string {
  const value = new Date(date);
  if (!Number.isFinite(value.getTime())) return '';
  const parts = bogotaFormatter.formatToParts(value);
  const get = (type: string) => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// Input is the same dated payment ledger used by Ingresos del período.
export function buildIncomeChart(payments: IncomeChartPayment[], mode: 'daily' | 'monthly' | 'all-months', asOf = new Date()): IncomeChartPoint[] {
  const totals = new Map<string, number>();
  const partialTotals = new Map<string, number>();
  const cutoffDay = Number(bogotaDateKey(asOf).slice(-2));
  for (const payment of payments) {
    if (!isPeriodIncome(payment.paymentMethod)) continue;
    const day = bogotaDateKey(payment.date);
    if (!day) continue;
    const key = mode === 'daily' ? day : day.slice(0, 7);
    const amount = Number(payment.amount) || 0;
    totals.set(key, (totals.get(key) || 0) + amount);
    if (mode === 'daily' || Number(day.slice(-2)) <= cutoffDay) partialTotals.set(key, (partialTotals.get(key) || 0) + amount);
  }
  return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, total]) => ({ label, total, partialTotal: partialTotals.get(label) || 0 }));
}

// Always show January through December, including months with no recorded payments.
export function completeChartYear(points: IncomeChartPoint[], year: number): IncomeChartPoint[] {
  const byMonth = new Map(points.map(point => [point.label, point]));
  return Array.from({ length: 12 }, (_, index) => {
    const label = `${year}-${String(index + 1).padStart(2, '0')}`;
    return byMonth.get(label) || { label, total: 0, partialTotal: 0 };
  });
}

// Comparable projection: accumulated through the same calendar day / elapsed days
// times the actual number of days in that month. Future months have no baseline.
export function estimateMonthClose(point: IncomeChartPoint, asOf = new Date()): number | null {
  const today = bogotaDateKey(asOf);
  if (!/^\d{4}-\d{2}$/.test(point.label) || !today || point.label > today.slice(0, 7)) return null;
  const [year, month] = point.label.split('-').map(Number);
  if (month < 1 || month > 12) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const elapsedDays = Math.min(Number(today.slice(-2)), daysInMonth);
  return Math.round(point.partialTotal / elapsedDays * daysInMonth);
}
