import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { subscribeStoreRows } from './storeSubscriptions';

// Keep shared operational subscriptions when navigating between views that need
// the same collection. Neither a store metadata update nor a view name change
// should reconnect them. Scope includes the logged-in user and company.
export function useStoreCollection<T extends { id: string }>(
  name: string, storeId: string | null, scope: string, enabled: boolean,
  setter: Dispatch<SetStateAction<T[]>>
) {
  useEffect(() => {
    if (!enabled || !storeId) return;
    return subscribeStoreRows(name, storeId, scope, rows => setter(rows as T[]));
  }, [name, storeId, scope, enabled, setter]);
}
