import { DEFAULT_COMPANY_ID, type Store } from '../types';

export function storeSettingsPatch(before: Store, after: Store, companyId: string): Partial<Store> {
  if (before.id !== after.id || (before.companyId || DEFAULT_COMPANY_ID) !== companyId || (after.companyId || DEFAULT_COMPANY_ID) !== companyId) {
    throw new Error('Los ajustes no pertenecen a la empresa y sede seleccionadas.');
  }
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    if (['id', 'companyId', 'warehouseSendEnabled', 'warehouseCategoryVisible'].includes(key)) continue;
    if (['paymentCommissions', 'paymentSurcharges', 'initialBalances', 'accountNames', 'crossStoreInitialBalances'].includes(key)) {
      const oldMap = (before as any)[key] || {}, nextMap = (after as any)[key] || {};
      for (const entry of Object.keys(nextMap)) if (JSON.stringify(oldMap[entry]) !== JSON.stringify(nextMap[entry])) patch[`${key}.${entry}`] = nextMap[entry];
      continue;
    }
    if (JSON.stringify((before as any)[key]) !== JSON.stringify((after as any)[key]) && (after as any)[key] !== undefined) patch[key] = (after as any)[key];
  }
  return patch as Partial<Store>;
}

export function applyStoreSettingsPatch(store: Store, patch: Partial<Store>): Store {
  const result: any = { ...store };
  for (const [key, value] of Object.entries(patch)) {
    const [parent, child] = key.split('.');
    if (child) result[parent] = { ...(result[parent] || {}), [child]: value };
    else result[key] = value;
  }
  return result;
}
