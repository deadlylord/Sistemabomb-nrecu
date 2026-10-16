import { getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { createHash } from 'node:crypto';
import { authenticateIdentity, IdentityError, nextAttempt } from './identity.mjs';
import { manageStagingUser } from './stagingUsers.mjs';
import { manageStagingRole } from './stagingRoles.mjs';

// This rollout is explicitly restricted to the dedicated staging project.
// App Check is not configured there yet; password verification, shared rate
// limits and signed custom tokens remain mandatory. Not a production endpoint.
const options = { region: 'southamerica-east1', enforceAppCheck: false, maxInstances: 2, concurrency: 10, memory: '256MiB', timeoutSeconds: 30 };
const staging = () => {
  if (getApp().options.projectId !== 'vestika-staging' && process.env.GCLOUD_PROJECT !== 'vestika-staging') throw new HttpsError('failed-precondition', 'Esta prueba solo está disponible en staging.');
};
const protect = callback => async request => {
  staging();
  try { return await callback(request); }
  catch (error) {
    if (error instanceof IdentityError) throw new HttpsError(error.code, error.message);
    console.error('staging-identity-operation-failed', { code: String(error?.code || 'internal') });
    throw new HttpsError('internal', 'No se pudo verificar o guardar el usuario. Intenta nuevamente.');
  }
};
export const vestikaStagingLogin = onCall(options, protect(async request => {
  const db = getFirestore();
  const result = await authenticateIdentity(request.data, {
    enabled: true,
    read: async (collection, id) => { const s = await db.collection(collection).doc(id).get(); return s.exists ? s.data() : null; },
    createCustomToken: (uid, claims) => getAuth().createCustomToken(uid, claims),
    consumeAttempt: async identifier => {
      const ip = request.rawRequest.ip || request.rawRequest.socket?.remoteAddress || 'unknown';
      const buckets = [{ key: `staging:account:${identifier}`, limit: 15 }, { key: `staging:ip:${ip}`, limit: 60 }];
      await db.runTransaction(async tx => {
        const refs = buckets.map(b => db.collection('authLoginAttempts').doc(createHash('sha256').update(b.key).digest('hex')));
        const states = await tx.getAll(...refs), now = Date.now();
        const next = states.map((s, i) => nextAttempt(s.exists ? s.data() : null, now, buckets[i].limit));
        refs.forEach((ref, i) => tx.set(ref, { ...next[i], expiresAt: Timestamp.fromMillis(next[i].windowStart + 600000) }));
      });
    }
  });
  const [store, role, company] = await Promise.all(['stores/' + result.user.storeId, 'roles/' + result.user.roleId, 'companies/' + result.user.companyId].map(path => db.doc(path).get()));
  return { ...result, store: { ...store.data(), id: store.id }, role: { ...role.data(), id: role.id }, company: { ...company.data(), id: company.id } };
}));
export const vestikaStagingUsers = onCall(options, protect(request => manageStagingUser(getFirestore(), request.auth, request.data)));
export const vestikaStagingRoles = onCall(options, protect(request => manageStagingRole(getFirestore(), request.auth, request.data)));
