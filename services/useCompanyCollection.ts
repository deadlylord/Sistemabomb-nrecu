import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { subscribeStoreRows } from './storeSubscriptions';
import { assertTenantData } from './tenantWrites';

// One subscription per authorized store; changes arrive live without rereading
// other companies. The sorted ID key avoids reconnecting on metadata updates.
export function useCompanyCollection<T extends { id: string }>(name: string, storeIds: string[], scope: string, enabled: boolean, setter: Dispatch<SetStateAction<T[]>>) {
  const storeKey = JSON.stringify([...storeIds].sort());
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const rows = new Map<string, T[]>();
    const ids: string[] = JSON.parse(storeKey);
    const companyScope = { companyId: scope.slice(scope.indexOf(':') + 1), storeIds: new Set(ids) };
    const unsubscribers = ids.map(id => subscribeStoreRows(name, id, scope, items => {
      if (!active) return;
      rows.set(id, items.filter(item => {
        try { assertTenantData(name, item, companyScope); return true; }
        catch { return false; }
      }) as T[]);
      setter(ids.flatMap(store => rows.get(store) || []));
    }));
    return () => { active = false; unsubscribers.forEach(unsubscribe => unsubscribe()); };
  }, [name, storeKey, scope, enabled, setter]);
}
