import { useEffect, useRef, useState } from 'react';
import { createInventoryLookup, type InventoryLookupState } from './requestedInventory';

export function useRequestedInventory(storeKey: string, scope: string, activationKey: string, revision: number, enabled: boolean) {
  const identity = JSON.stringify([scope, activationKey, revision, enabled]);
  const generation = useRef({ identity, version: 0 });
  if (generation.current.identity !== identity) generation.current = { identity, version: generation.current.version + 1 };
  const token = generation.current;
  const controller = useRef<ReturnType<typeof createInventoryLookup> | null>(null);
  const [state, setState] = useState<InventoryLookupState & { token: object }>({ token: {}, rows: [], storeIds: [], loading: false, error: null });
  useEffect(() => {
    if (!enabled) return;
    const lookup = createInventoryLookup(scope, result => {
      if (generation.current === token) setState({ ...result, token });
    }, () => generation.current === token);
    controller.current = lookup;
    return () => { lookup.dispose(); if (controller.current === lookup) controller.current = null; };
  }, [token]);
  useEffect(() => { controller.current?.setStores(JSON.parse(storeKey)); }, [storeKey, token]);
  const selected = new Set<string>(JSON.parse(storeKey));
  if (!enabled || state.token !== token) return { rows: [], storeIds: [], loading: enabled && selected.size > 0, error: null } as InventoryLookupState;
  return { ...state, loading: state.loading || (selected.size > 0 && JSON.stringify([...state.storeIds].sort()) !== storeKey),
    rows: state.rows.filter(row => selected.has(row.storeId)) };
}
