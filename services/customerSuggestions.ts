import type { Customer, Sale, Layaway } from '../types';
import { selectAnalyticsRows } from './analyticsScope';

export function normalizeCustomerPhone(value: string): string {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('57') ? digits.slice(2) : digits;
}

// Use only already-loaded records in the active tenant/store; never broaden reads.
export function customerSuggestions(companyId: string, storeId: string, customers: Customer[], sales: Sale[], layaways: Layaway[]): Customer[] {
  const scope = { companyId, storeIds: new Set([storeId]) };
  const matches = new Map<string, Customer>();
  const records = [
    ...selectAnalyticsRows<Sale>('sales', sales, scope),
    ...selectAnalyticsRows<Layaway>('layaways', layaways, scope),
  ].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  for (const record of records) {
    const phone = normalizeCustomerPhone(record.customerPhone);
    if (phone.length === 10 && record.customerName?.trim()) matches.set(phone, { id: record.id, createdAt: record.createdAt, companyId, storeId, name: record.customerName, phone });
  }
  for (const customer of selectAnalyticsRows<Customer>('customers', customers, scope)) {
    const phone = normalizeCustomerPhone(customer.phone);
    if (phone.length === 10 && customer.name?.trim()) matches.set(phone, { ...customer, phone });
  }
  return [...matches.values()];
}
