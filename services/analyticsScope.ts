import { DEFAULT_COMPANY_ID } from '../types';
import { assertTenantData, type TenantScope } from './tenantWrites';
import type { Store } from '../types';

// A final, synchronous boundary before rendering totals or building AI payloads.
// It also excludes state from the previous context before effect cleanup runs.
export function analyticsScope(companyId: string, stores: Store[]): TenantScope {
  return { companyId, storeIds: new Set(stores.filter(store => (store.companyId || DEFAULT_COMPANY_ID) === companyId).map(store => store.id)) };
}
export function selectAnalyticsRows<T>(name: string, rows: T[], scope: TenantScope): T[] {
  return rows.filter(row => {
    try { assertTenantData(name, row, scope); return true; } catch { return false; }
  });
}
