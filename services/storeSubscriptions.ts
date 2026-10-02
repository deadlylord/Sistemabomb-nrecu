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
    current.unsubscribe = onSnapshot(query(collection(db, name), where('storeId', '==', storeId)), snapshot => {
      if (!current.active) return;
      current.rows = snapshot.docs.map(document => ({ ...document.data(), id: document.id }))
        .filter((row: any) => !row.companyId || row.companyId === companyId);
      current.listeners.forEach(listener => listener(current.rows!));
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
