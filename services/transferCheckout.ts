// Only unresolved IDs: no inventory or customer data is retained here.
const pending = new Map<string, string>();
const key = (scope: string) => `vestika:pending-transfer:${scope}`;
export function pendingTransferId(scope: string, proposed?: string) {
  let id = pending.get(scope);
  try { id ||= sessionStorage.getItem(key(scope)) || undefined; } catch { /* memory fallback */ }
  id ||= proposed || crypto.randomUUID();
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error('Identificador de traslado inválido.');
  pending.set(scope, id);
  try { sessionStorage.setItem(key(scope), id); } catch { /* memory fallback */ }
  return id;
}
export function completeTransferId(scope: string, id: string) {
  if (pending.get(scope) === id) pending.delete(scope);
  try { if (sessionStorage.getItem(key(scope)) === id) sessionStorage.removeItem(key(scope)); } catch { /* memory fallback */ }
}
