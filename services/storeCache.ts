import { assertTenantData } from './tenantWrites';

// Session-only LRU. No Firestore connection is retained for a cached store.
const MAX_ENTRIES = 20;
const MAX_ROWS = 50000;
const MAX_BYTES = 16 * 1024 * 1024;
const TTL = 5 * 60 * 1000;
const cache = new Map<string, { rows: any[]; bytes: number; time: number }>();
export const storeCacheKey = (name: string, storeId: string, scope: string) => JSON.stringify([scope, storeId, name]);
export function getCachedStoreRows(name: string, storeId: string, scope: string) {
  const key = storeCacheKey(name, storeId, scope), entry = cache.get(key);
  if (!entry) return;
  if (Date.now() - entry.time > TTL) { cache.delete(key); return; }
  cache.delete(key); cache.set(key, entry);
  return entry.rows;
}
export function validateStoreRows(name: string, storeId: string, scope: string, rows: any[]) {
  const companyId = scope.slice(scope.indexOf(':') + 1);
  return rows.filter(row => {
    if ((name === 'storeMetadata' ? row.id : row.storeId) !== storeId || (row.companyId && row.companyId !== companyId)) return false;
    if (name === 'inventory' || name === 'storeMetadata') {
      try { assertTenantData(name === 'storeMetadata' ? 'stores' : name, row, { companyId, storeIds: new Set([storeId]) }); } catch { return false; }
    }
    return true;
  });
}
export function cacheStoreRows(name: string, storeId: string, scope: string, rows: any[]) {
  if (name !== 'inventory' && name !== 'storeMetadata') return; // No secondary POS histories.
  const key = storeCacheKey(name, storeId, scope);
  cache.delete(key);
  rows = validateStoreRows(name, storeId, scope, rows);
  if (rows.length > MAX_ROWS) return;
  const bytes = JSON.stringify(rows).length * 2;
  if (bytes > MAX_BYTES) return;
  cache.set(key, { rows, bytes, time: Date.now() });
  let total = [...cache.values()].reduce((sum, entry) => sum + entry.rows.length, 0);
  let bytesTotal = [...cache.values()].reduce((sum, entry) => sum + entry.bytes, 0);
  while (cache.size > MAX_ENTRIES || total > MAX_ROWS || bytesTotal > MAX_BYTES) {
    const oldest = cache.keys().next().value!;
    total -= cache.get(oldest)!.rows.length; bytesTotal -= cache.get(oldest)!.bytes; cache.delete(oldest);
  }
}
export function clearStoreCache() { cache.clear(); }
export function invalidateStoreRows(name: string, storeId: string, scope: string) { cache.delete(storeCacheKey(name, storeId, scope)); }
