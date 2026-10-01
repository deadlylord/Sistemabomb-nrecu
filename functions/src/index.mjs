import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineBoolean } from 'firebase-functions/params';
import { createHash } from 'node:crypto';
import { authenticateIdentity, IdentityError, nextAttempt } from './identity.mjs';
initializeApp();
const db = getFirestore();
const identityEnabled = defineBoolean('VESTIKA_IDENTITY_ENABLED', { default: false });
export const vestikaLogin = onCall({ region: 'us-central1', enforceAppCheck: true, maxInstances: 5 }, async request => {
  try {
    return await authenticateIdentity(request.data, {
      enabled: identityEnabled.value(),
      read: async (collection, id) => { const snapshot = await db.collection(collection).doc(id).get(); return snapshot.exists ? snapshot.data() : null; },
      createCustomToken: (uid, claims) => getAuth().createCustomToken(uid, claims),
      consumeAttempt: async identifier => {
        const ip = request.rawRequest.ip || request.rawRequest.socket?.remoteAddress || 'unknown';
        const buckets = [{ key: `account:${identifier}`, limit: 15 }, { key: `ip:${ip}`, limit: 60 }];
        const refs = buckets.map(bucket => db.collection('authLoginAttempts').doc(createHash('sha256').update(bucket.key).digest('hex')));
        await db.runTransaction(async transaction => {
          const snapshots = await transaction.getAll(...refs);
          const now = Date.now();
          const states = snapshots.map((snapshot, i) => nextAttempt(snapshot.exists ? snapshot.data() : null, now, buckets[i].limit));
          refs.forEach((ref, i) => transaction.set(ref, { ...states[i], expiresAt: Timestamp.fromMillis(states[i].windowStart + 600000) }));
        });
      }
    });
  } catch (error) {
    if (error instanceof IdentityError) throw new HttpsError(error.code, error.message);
    // Never log credentials or return internal documents/token signing details.
    throw new HttpsError('internal', 'No se pudo verificar el acceso. Inténtalo de nuevo.');
  }
});
