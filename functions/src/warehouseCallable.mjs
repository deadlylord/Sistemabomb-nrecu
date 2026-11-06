import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { IdentityError } from './identity.mjs';
import { warehouseOperation } from './warehouse.mjs';
// Separate staging-only endpoint. Never deploy this handler as a production feature.
export const vestikaStagingWarehouse = onCall({ region: 'us-central1', enforceAppCheck: true, maxInstances: 3 }, async request => {
  const db = getFirestore();
  if (db.projectId !== 'vestika-staging') throw new HttpsError('failed-precondition', 'Bodega disponible únicamente en staging.');
  try { return await warehouseOperation(db, request.auth, request.data); }
  catch (error) {
    if (error instanceof IdentityError) throw new HttpsError(error.code, error.message);
    throw new HttpsError('internal', 'No se pudo completar la operación de bodega.');
  }
});
