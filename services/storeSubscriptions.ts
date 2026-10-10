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
    const documentCache = new Map<string, any>();
    current.unsubscribe = onSnapshot(query(collection(db, name), where('storeId', '==', storeId)), snapshot => {
      if (!current.active) return;
      // Firestore entrega únicamente los documentos modificados desde el snapshot anterior.
      // Conservar referencias de los demás evita reconstruir miles de objetos en cada cambio.
      for (const change of snapshot.docChanges()) {
        if (change.type === 'removed') {
          documentCache.delete(change.doc.id);
          continue;
        }
        const data = change.doc.data();
        if (data.companyId && data.companyId !== companyId) {
          documentCache.delete(change.doc.id);
        } else {
          documentCache.set(change.doc.id, { ...data, id: change.doc.id });
        }
      }
      const nextRows = snapshot.docs.map(document => documentCache.get(document.id)).filter(Boolean);
      if (current.rows && nextRows.length === current.rows.length &&
          nextRows.every((row, index) => row === current.rows![index])) return;
      current.rows = nextRows;
      current.listeners.forEach(listener => listener(nextRows));
    }, error => console.error(`Error loading ${name}:`, error));
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
