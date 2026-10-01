import type { LoginRecord, Sale, Layaway, CartItem } from '../types';

export type PayrollScope = { storeId: string; companyId: string };

export function inPayrollScope(record: { storeId?: string; companyId?: string }, scope: PayrollScope) {
  return !!scope.storeId && record.storeId === scope.storeId && (!record.companyId || record.companyId === scope.companyId);
}

export function payrollDate(timestamp: string) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const value = (type: string) => parts.find(part => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function payrollTime(timestamp: string) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

export function payrollLogins(records: LoginRecord[], scope: PayrollScope, sellerId: string, sellerName: string, startDate: string, endDate: string) {
  return records.filter(record => {
    const date = payrollDate(record.date);
    return inPayrollScope(record, scope) && date >= startDate && date <= endDate && !!date &&
      (sellerId ? record.sellerId === sellerId : record.sellerName === sellerName);
  });
}

export function payrollShiftUnits(transactions: (Sale | Layaway)[], scope: PayrollScope, sellerName: string, date: string, startTime: string, endTime: string) {
  if (!startTime || !endTime || startTime >= endTime) return 0;
  return transactions.reduce((units, transaction) => {
    const time = payrollTime(transaction.createdAt);
    if (!inPayrollScope(transaction, scope) || transaction.seller !== sellerName ||
        payrollDate(transaction.createdAt) !== date || time < startTime || time >= endTime ||
        (transaction as Sale).layawayId || ['cancelled', 'pre-order'].includes((transaction as Layaway).status)) return units;
    const items = (Array.isArray(transaction.items) ? transaction.items : Object.values(transaction.items || {})) as CartItem[];
    return units + items.reduce((sum, item) => {
      const quantity = Number(item?.quantity);
      return sum + (Number(item?.price) > 0 && Number.isFinite(quantity) && quantity > 0 ? quantity : 0);
    }, 0);
  }, 0);
}
