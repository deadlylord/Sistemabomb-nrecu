import type { Product } from '../types';
import { auth } from '../firebase';
export type WarehouseDirection = 'toWarehouse' | 'toStore';
export type OpenWarehouseMovement = (product: Product, direction: WarehouseDirection) => void;

export const warehouseEnabled = import.meta.env?.VITE_STORE_WAREHOUSE === 'true' && import.meta.env?.VITE_APP_ENV === 'staging';
export async function callWarehouse(companyId: string, storeId: string, data: Record<string, unknown>): Promise<any> {
  if (!warehouseEnabled || auth.app.options.projectId !== 'vestika-staging') throw new Error('La bodega aún no está habilitada en este entorno.');
  const sdk = await import('firebase/functions');
  return (await sdk.httpsCallable(sdk.getFunctions(auth.app, 'us-central1'), 'vestikaStagingWarehouse')({ ...data, companyId, storeId })).data;
}
