import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';

const subscriptions = new Map<string, { listeners: Set<(rows: any[]) => void>; rows?: any[]; unsubscribe: () => void; active: boolean }>();
export function subscribeStoreRows(name: string, storeId: string, scope: string, apply: (rows: any[]) => void) {
  const key = JSON.stringify([name, storeId, scope]);
  let entry = subscriptions.get(key);
  if (!entry) {
    entry = { listeners: new Set(), unsubscribe: () => {}, active: true };
    subscriptions.set(key, entry);
    const current = entry;
    const companyId = scope.slice(scope.indexOf(':') + 1);
    // Transfer requests are relevant to both participating stores. Merge each
    // independent query by document ID; keep ordinary collections store-scoped.
    const fields = name === 'incidents' ? ['storeId', 'fromStoreId', 'toStoreId'] : ['storeId'];
    const results = new Map<string, any[]>();
    const unsubscribers = fields.map(field => onSnapshot(query(collection(db, name), where(field, '==', storeId)), snapshot => {
      if (!current.active) return;
      results.set(field, snapshot.docs.map(document => ({ ...document.data(), id: document.id })).filter((row: any) =>
        (!row.companyId || row.companyId === companyId) &&
        (field === 'storeId' || row.type === 'Solicitud de Traslado')
      ));
      current.rows = [...new Map([...results.values()].flat().map(row => [row.id, row])).values()];
      current.listeners.forEach(listener => listener(current.rows!));
    }, error => console.error(`Error loading ${name}:`, error)));
    current.unsubscribe = () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }
  entry.listeners.add(apply);
  if (entry.rows) apply(entry.rows);
  const current = entry;
  return () => {
    current.listeners.delete(apply);
    if (!current.listeners.size) {
      current.active = false; current.unsubscribe(); subscriptions.delete(key);
    }
  };
}
