import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from './measuredFirestore';
import { db } from '../firebase';
import type { Product } from '../types';

export type DashboardInventoryRequest = { productIds: string[]; full: boolean };

// Keep partial dashboard data separate from the operational inventory state.
export function useDashboardInventory(companyId: string, storeId: string | null, scope: string, enabled: boolean, request: DashboardInventoryRequest) {
  const ids = [...new Set(request.productIds.filter(id => id && !id.startsWith('voucher-')))].sort();
  const key = JSON.stringify([scope, companyId, storeId, request.full, request.full ? [] : ids]);
  const [state, setState] = useState<{ key: string; rows: Product[]; loading: boolean; error: string }>({ key: '', rows: [], loading: true, error: '' });
  useEffect(() => {
    if (!enabled || !storeId) return;
    let active = true;
    let failed = false;
    const own = (product: Product) => product.storeId === storeId && (!product.companyId || product.companyId === companyId);
    const fail = () => { failed = true; if (active) setState({ key, rows: [], loading: false, error: 'No se pudieron cargar los productos. Cierra y vuelve a abrir esta vista para reintentar.' }); };
    setState({ key, rows: [], loading: true, error: '' });
    let stops: (() => void)[];
    if (request.full) {
      stops = [onSnapshot(query(collection(db, 'inventory'), where('storeId', '==', storeId)), snapshot => {
        if (active && !failed) setState({ key, rows: snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Product)).filter(own), loading: false, error: '' });
      }, fail)];
    } else {
      const rows = new Map<string, Product>();
      const ready = new Set<string>();
      // Point listeners preserve live prices/names and need no new composite index.
      stops = ids.map(id => onSnapshot(doc(db, 'inventory', id), snapshot => {
        if (!active || failed) return;
        rows.delete(id);
        if (snapshot.exists()) {
          const product = { ...snapshot.data(), id: snapshot.id } as Product;
          if (own(product)) rows.set(id, product);
        }
        ready.add(id);
        if (ready.size === ids.length) setState({ key, rows: [...rows.values()], loading: false, error: '' });
      }, fail));
      if (!ids.length) setState({ key, rows: [], loading: false, error: '' });
    }
    return () => { active = false; stops.forEach(stop => stop()); };
  }, [key, enabled]);
  const current = state.key === key ? state : { rows: [], loading: true, error: '' };
  return { ...current, editReady: request.full && !current.loading && !current.error };
}
