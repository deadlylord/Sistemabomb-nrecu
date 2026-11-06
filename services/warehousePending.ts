export type PendingWarehouseOperation = { signature: string; operationId: string };
export const warehousePendingKey = (companyId: string, storeId: string, userId: string) => `warehouse-pending:${companyId}:${storeId}:${userId}`;
export function loadWarehousePending(key: string): PendingWarehouseOperation | null {
  const value = sessionStorage.getItem(key);
  if (!value) return null;
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed.operationId !== 'string' || typeof parsed.signature !== 'string' || !parsed.operationId || typeof JSON.parse(parsed.signature) !== 'object') throw new Error('La operación pendiente de bodega requiere revisión.');
  return parsed;
}
export function saveWarehousePending(key: string, value: PendingWarehouseOperation | null) {
  if (value) sessionStorage.setItem(key, JSON.stringify(value));
  else sessionStorage.removeItem(key);
}
