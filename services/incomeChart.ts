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
export function buildIncomeChart(payments: IncomeChartPayment[], mode: 'daily' | 'monthly' | 'all-months'): IncomeChartPoint[] {
  const totals = new Map<string, number>();
  for (const payment of payments) {
    if (!isPeriodIncome(payment.paymentMethod)) continue;
    const day = bogotaDateKey(payment.date);
    if (!day) continue;
    const key = mode === 'daily' ? day : day.slice(0, 7);
    totals.set(key, (totals.get(key) || 0) + (Number(payment.amount) || 0));
  }
  return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, total]) => ({ label, total, partialTotal: total }));
}
