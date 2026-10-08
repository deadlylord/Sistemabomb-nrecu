import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import type { QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import type { Product } from '../types';
import { cacheStoreRows, getCachedStoreRows, validateStoreRows } from './storeCache';
import { assertTenantData } from './tenantWrites';

export type InventoryLookupState = { rows: Product[]; storeIds: string[]; loading: boolean; error: string | null; updatedAt?: number };
type Entry = { rows: Product[]; started: boolean; loading: boolean; error: string | null; updatedAt?: number };

// One-shot requests, with at most four in flight. Removing a store invalidates
// its job, including cache writes. Completed stores survive selection changes.
export function createInventoryLookup(scope: string, publish: (state: InventoryLookupState) => void, isCurrent: () => boolean = () => true) {
  const entries = new Map<string, Entry>();
  let disposed = false, running = 0;
  const emit = () => {
    if (disposed || !isCurrent()) return;
    const values = [...entries.values()];
    const times = values.flatMap(entry => entry.updatedAt === undefined ? [] : [entry.updatedAt]);
    publish({ rows: values.flatMap(entry => entry.rows), storeIds: [...entries.keys()], loading: values.some(entry => entry.loading),
      error: values.find(entry => entry.error)?.error || null,
      updatedAt: times.length === values.length && times.length ? times.reduce((oldest, time) => Math.min(oldest, time)) : undefined });
  };
  const pump = () => {
    if (disposed || !isCurrent()) return;
    for (const [storeId, entry] of entries) {
      if (running >= 4) break;
      if (entry.started) continue;
      entry.started = true; running++;
      void getDocs(query(collection(db, 'inventory'), where('storeId', '==', storeId))).then(snapshot => {
        if (disposed || !isCurrent() || entries.get(storeId) !== entry) return;
        entry.rows = validateStoreRows('inventory', storeId, scope, snapshot.docs.map(document => ({ ...document.data(), id: document.id })));
        entry.loading = false;
        if (snapshot.metadata?.fromCache) entry.error = 'Consulta sin conexión: los inventarios pueden estar desactualizados.';
        else { entry.updatedAt = Date.now(); cacheStoreRows('inventory', storeId, scope, entry.rows); }
        emit();
      }).catch(error => {
        if (disposed || !isCurrent() || entries.get(storeId) !== entry) return;
        console.error('Error loading requested inventory:', error);
        entry.loading = false; entry.error = 'No se pudo completar la consulta multitienda. Pulsa Actualizar consulta para reintentar.';
        emit();
      }).finally(() => { running--; pump(); });
    }
  };
  return {
    setStores(storeIds: string[]) {
      if (disposed || !isCurrent()) return;
      const selected = new Set(storeIds);
      for (const id of entries.keys()) if (!selected.has(id)) entries.delete(id);
      for (const id of selected) if (!entries.has(id)) entries.set(id, {
        rows: getCachedStoreRows('inventory', id, scope) || [], started: false, loading: true, error: null,
      });
      emit(); pump();
    },
    dispose() { disposed = true; entries.clear(); },
  };
}

// A purchase needs the product in its destination stores, not in every store
// accessible to the administrator. Keep legacy documents without companyId
// compatible through the same authorized-store validation used by the writer.
export async function findPurchaseProducts(storeIds: string[], name: string, companyId: string, isCurrent: () => boolean) {
  const results = new Map<string, QuerySnapshot<DocumentData>>();
  let next = 0, failed = false;
  await Promise.all(Array.from({ length: Math.min(4, storeIds.length) }, async () => {
    while (!failed && next < storeIds.length) {
      try {
        if (!isCurrent()) throw new Error('La sede o empresa cambió. Vuelve a abrir Compras.');
        const storeId = storeIds[next++];
        const snapshot = await getDocs(query(collection(db, 'inventory'), where('storeId', '==', storeId), where('name', '==', name), limit(1)));
        if (!isCurrent()) throw new Error('La sede o empresa cambió. Vuelve a abrir Compras.');
        if (snapshot.metadata?.fromCache) throw new Error('No se pudo confirmar el inventario para la compra. Revisa la conexión.');
        snapshot.docs.forEach(document => {
          if (document.data().storeId !== storeId) throw new Error('El producto no pertenece a la tienda solicitada.');
          assertTenantData('inventory', document.data(), { companyId, storeIds: new Set([storeId]) });
        });
        results.set(storeId, snapshot);
      } catch (error) { failed = true; throw error; }
    }
  }));
  return results;
}
