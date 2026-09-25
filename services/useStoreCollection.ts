import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';

// Keep shared operational subscriptions when navigating between views that need
// the same collection. Neither a store metadata update nor a view name change
// should reconnect them. Scope includes the logged-in user and company.
export function useStoreCollection<T extends { id: string }>(
  name: string, storeId: string | null, scope: string, enabled: boolean,
  setter: Dispatch<SetStateAction<T[]>>
) {
  useEffect(() => {
    if (!enabled || !storeId) return;
    return onSnapshot(query(collection(db, name), where('storeId', '==', storeId)), snapshot => {
      setter(snapshot.docs.map(document => ({ ...document.data(), id: document.id } as T)));
    }, error => console.error(`Error loading ${name}:`, error));
  }, [name, storeId, scope, enabled, setter]);
}
