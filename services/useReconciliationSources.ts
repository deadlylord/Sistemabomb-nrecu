import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from './measuredFirestore';
import { db } from '../firebase';
import type { Sale, Layaway } from '../types';

// Closure calculations require payment dates, including payments on old sources.
// Do not filter sources by createdAt. Until a verified payment-period index is
// available, subscribe to complete store sources only while closures are open.
export function useReconciliationSources(companyId: string, storeId: string, userScope: string, enabled: boolean) {
  const key = JSON.stringify([userScope, companyId, storeId]);
  const [state, setState] = useState<{ key: string; sales: Sale[]; layaways: Layaway[]; salesReady: boolean; layawaysReady: boolean; error: string | null }>({ key: '', sales: [], layaways: [], salesReady: false, layawaysReady: false, error: null });
  useEffect(() => {
    if (!enabled || !companyId || !storeId) return;
    let active = true;
    setState({ key, sales: [], layaways: [], salesReady: false, layawaysReady: false, error: null });
    const stops = (['sales', 'layaways'] as const).map(name => onSnapshot(
      query(collection(db, name), where('storeId', '==', storeId)),
      snapshot => {
        if (!active) return;
        const rows = snapshot.docs.map(d => ({ ...d.data(), id: d.id })).filter((row: any) => row.storeId === storeId && (!row.companyId || row.companyId === companyId));
        setState(previous => previous.key === key ? { ...previous, [name]: rows, [name === 'sales' ? 'salesReady' : 'layawaysReady']: true } : previous);
      },
      () => { if (active) setState(previous => previous.key === key ? { ...previous, error: 'No se pudieron cargar los pagos para los cierres. Cierra y vuelve a abrir Cierres de Caja para reintentar.' } : previous); },
    ));
    return () => { active = false; stops.forEach(stop => stop()); setState(previous => previous.key === key ? { ...previous, sales: [], layaways: [], salesReady: false, layawaysReady: false, error: null } : previous); };
  }, [key, enabled]);
  const current = enabled && state.key === key ? state : null;
  return { sales: current?.sales || [], layaways: current?.layaways || [], loading: enabled && (!current || !current.salesReady || !current.layawaysReady), error: current?.error || null };
}
