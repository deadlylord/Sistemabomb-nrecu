import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { prepareCompatibleVerificationCutoffRules, verificationCutoffProductionBaseline } from '../../functions/src/compatibleVerificationCutoffRules.mjs';

if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required.');

const staging = await readFile(new URL('../../security/firestore.staging.rules', import.meta.url), 'utf8');
for (const [environment, rules] of [
  ['staging', staging],
  ['production', prepareCompatibleVerificationCutoffRules(verificationCutoffProductionBaseline)],
]) {
  test(`Store verification cutoff with ${environment} rules`, async () => {
    const env = await initializeTestEnvironment({ projectId: 'demo-cutoff-' + environment, firestore: { rules } });
    const storeId = 'shop';
    const companyId = 'company';
    const scope = { storeId, companyId };
    const clientFor = user => env.authenticatedContext(user, {
      ...scope, sellerId: user, roleId: user, identityVersion: 1, authVersion: 1,
      platformDeveloper: false, firebase: { sign_in_provider: 'custom' },
    }).firestore();
    try {
      await env.withSecurityRulesDisabled(async context => {
        const db = context.firestore();
        const batch = writeBatch(db);
        batch.set(doc(db, 'stores', storeId), { companyId, name: 'Shop' });
        batch.set(doc(db, 'companies', companyId), { name: 'Company' });
        for (const userType of ['admin', 'seller']) {
          batch.set(doc(db, 'roles', userType), { companyId, name: userType, userType, permissions: ['inventory', 'settings'] });
          batch.set(doc(db, 'sellers', userType), { ...scope, roleId: userType, authVersion: 1 });
        }
        batch.set(doc(db, 'inventory', 'shirt'), { ...scope, stock: 5 });
        await batch.commit();
      });
      const admin = clientFor('admin'), seller = clientFor('seller');
      const setting = (client, value) => updateDoc(doc(client, 'stores', storeId), { inventoryVerificationCutoffMinutes: value });
      await assertSucceeds(setDoc(doc(seller, 'stockTakes', 'existing'), { ...scope, verification: [] }));
      await assertFails(setting(seller, 690));
      await assertFails(setting(admin, 1440));
      const now = new Date();
      const localMinute = (now.getUTCHours() * 60 + now.getUTCMinutes() + 1140) % 1440;
      if (localMinute < 1438) {
        await assertSucceeds(setting(admin, localMinute + 2));
        await assertSucceeds(setDoc(doc(seller, 'stockTakes', 'before-cutoff'), scope));
      }
      // Midnight is already closed at any current server minute.
      await assertSucceeds(setting(admin, 0));
      for (const client of [admin, seller]) {
        await assertFails(setDoc(doc(client, 'stockTakes', 'closed'), scope));
        await assertFails(setDoc(doc(client, 'pendingDetailedVerifications', 'closed'), scope));
        await assertFails(setDoc(doc(client, 'detailedVerificationHistory', 'closed'), scope));
      }
      await assertSucceeds(getDoc(doc(seller, 'stockTakes', 'existing')));
      await assertFails(updateDoc(doc(admin, 'stockTakes', 'existing'), { isApplied: true }));
      const batch = writeBatch(admin);
      batch.update(doc(admin, 'inventory', 'shirt'), { stock: 2 });
      batch.set(doc(admin, 'productHistory', 'count'), { ...scope, changeType: 'Conteo Físico Aplicado' });
      await assertFails(batch.commit());
      await assertSucceeds(updateDoc(doc(seller, 'inventory', 'shirt'), { stock: 4 }));
      await assertSucceeds(setting(admin, null));
      await assertSucceeds(setDoc(doc(seller, 'stockTakes', 'reopened'), scope));
    } finally {
      await env.cleanup();
    }
  });
}
