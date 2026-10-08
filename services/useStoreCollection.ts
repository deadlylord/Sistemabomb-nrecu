import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { subscribeStoreRows, type StoreSyncState } from './storeSubscriptions';

// Keep shared operational subscriptions when navigating between views that need
// the same collection. Neither a store metadata update nor a view name change
// should reconnect them. Scope includes the logged-in user and company.
export function useStoreCollection<T extends { id: string }>(
  name: string, storeId: string | null, scope: string, enabled: boolean,
  setter: Dispatch<SetStateAction<T[]>>
) {
  const identity = JSON.stringify([name, storeId, scope, enabled]);
  const activation = useRef({ identity, version: 0 });
  if (activation.current.identity !== identity) activation.current = { identity, version: activation.current.version + 1 };
  const key = JSON.stringify([identity, activation.current.version]);
  const [sync, setSync] = useState<StoreSyncState & { key: string }>({ key: '', syncing: true, error: null });
  useEffect(() => {
    if (!enabled || !storeId) return;
    return subscribeStoreRows(name, storeId, scope, rows => setter(rows as T[]), state => setSync({ ...state, key }));
  }, [name, storeId, scope, enabled, setter]);
  return sync.key === key ? sync : { syncing: true, error: null };
}
