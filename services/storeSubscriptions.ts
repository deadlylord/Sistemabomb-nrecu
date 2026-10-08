import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { cacheStoreRows, getCachedStoreRows, storeCacheKey, validateStoreRows } from './storeCache';
export type StoreSyncState = { syncing: boolean; error: string | null };
type Consumer = { apply: (rows: any[]) => void; status?: (state: StoreSyncState) => void };
const subscriptions = new Map<string, { listeners: Set<Consumer>; rows?: any[]; state: StoreSyncState; unsubscribe: () => void; active: boolean }>();
export function subscribeStoreRows(name: string, storeId: string, scope: string, apply: (rows: any[]) => void, status?: Consumer['status']) {
  const key = storeCacheKey(name, storeId, scope);
  let entry = subscriptions.get(key);
  if (!entry) {
    entry = { listeners: new Set(), rows: getCachedStoreRows(name, storeId, scope), state: { syncing: true, error: null }, unsubscribe: () => {}, active: true };
    subscriptions.set(key, entry);
    const current = entry;
    current.unsubscribe = onSnapshot(query(collection(db, name), where('storeId', '==', storeId)), { includeMetadataChanges: true }, snapshot => {
      if (!current.active) return;
      current.rows = validateStoreRows(name, storeId, scope, snapshot.docs.map(document => ({ ...document.data(), id: document.id })));
      current.state = { syncing: !!snapshot.metadata?.fromCache, error: null };
      // A local SDK snapshot does not extend the lifetime of verified server data.
      if (!current.state.syncing) cacheStoreRows(name, storeId, scope, current.rows);
      current.listeners.forEach(listener => { listener.apply(current.rows!); listener.status?.(current.state); });
    }, error => {
      if (!current.active) return;
      console.error(`Error loading ${name}:`, error);
      current.state = { syncing: false, error: 'No se pudo sincronizar. Los datos pueden estar desactualizados.' };
      current.listeners.forEach(listener => listener.status?.(current.state));
    });
  }
  const consumer = { apply, status };
  entry.listeners.add(consumer);
  if (entry.rows) apply(entry.rows);
  status?.(entry.state);
  const current = entry;
  return () => {
    current.listeners.delete(consumer);
    if (!current.listeners.size) { current.active = false; current.unsubscribe(); subscriptions.delete(key); }
  };
}
