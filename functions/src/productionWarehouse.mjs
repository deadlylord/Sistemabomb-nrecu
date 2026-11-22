import { getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { IdentityError } from './identity.mjs';
import { warehouseOperation } from './warehouse.mjs';

const options = {
  region: 'us-central1',
  enforceAppCheck: false,
  maxInstances: 5,
  concurrency: 10,
  memory: '256MiB',
  timeoutSeconds: 30,
  labels: { vestika_warehouse_build: '__VESTIKA_WAREHOUSE_BUILD__' },
};

export const productionPosWarehouse = onCall(options, async request => {
  if ((getApp().options.projectId || process.env.GCLOUD_PROJECT) !== 'factura2-6e811') {
    throw new HttpsError('failed-precondition', 'Entorno de bodega incorrecto.');
  }
  try {
    return await warehouseOperation(getFirestore(), request.auth, request.data);
  } catch (error) {
    if (error instanceof IdentityError) throw new HttpsError(error.code, error.message);
    console.error('production-warehouse-failed', { code: String(error?.code || 'internal') });
    throw new HttpsError('internal', 'No se pudo completar la operación de bodega.');
  }
});
