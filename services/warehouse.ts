import type { Product } from '../types';
import { auth } from '../firebase';
export type WarehouseDirection = 'toWarehouse' | 'toStore';
export type OpenWarehouseMovement = (product: Product, direction: WarehouseDirection) => void;

const appEnv = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_APP_ENV || 'staging';
export const warehouseEnabled =
  (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_STORE_WAREHOUSE === 'true'
  && (appEnv === 'staging' || appEnv === 'production');

export function warehouseServiceTarget(projectId: string | undefined) {
  const production = appEnv === 'production';
  if (!warehouseEnabled || (production ? projectId !== 'factura2-6e811' : appEnv !== 'staging' || projectId !== 'vestika-staging')) {
    throw new Error('La bodega aún no está habilitada en este entorno.');
  }
  return production
    ? { region: 'us-central1', callable: 'productionPosWarehouse' }
    : { region: 'us-central1', callable: 'vestikaStagingWarehouse' };
}

export async function callWarehouse(companyId: string, storeId: string, data: Record<string, unknown>): Promise<any> {
  const target = warehouseServiceTarget(auth.app.options.projectId);
  const sdk = await import('firebase/functions');
  return (await sdk.httpsCallable(sdk.getFunctions(auth.app, target.region), target.callable)({ ...data, companyId, storeId })).data;
}
