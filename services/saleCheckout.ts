// Only unresolved operation IDs are retained. No cart, customer or password is cached.
const pending = new Map<string, string>();
const key = (scope: string) => `vestika:pending-sale:${scope}`;
export function pendingSaleId(scope: string, proposed?: string): string {
  let id = pending.get(scope);
  try { id ||= sessionStorage.getItem(key(scope)) || undefined; } catch { /* memory fallback */ }
  id ||= proposed || crypto.randomUUID();
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error('Identificador de venta inválido.');
  pending.set(scope, id);
  try { sessionStorage.setItem(key(scope), id); } catch { /* memory fallback */ }
  return id;
}
export function completeSaleId(scope: string, id: string) {
  if (pending.get(scope) === id) pending.delete(scope);
  try { if (sessionStorage.getItem(key(scope)) === id) sessionStorage.removeItem(key(scope)); } catch { /* memory fallback */ }
}
export async function saleFingerprint(request: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(request));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
