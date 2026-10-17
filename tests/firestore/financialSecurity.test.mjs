import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { build } from 'esbuild';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit } from 'firebase/firestore';

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw new Error('Run against the local Firestore emulator only.');
const claims = (sellerId = 'admin') => ({ identityVersion: 1, sellerId, companyId: 'a', storeId: 'a1', roleId: sellerId === 'admin' ? 'admin' : 'seller', firebase: { sign_in_provider: 'custom' } });
const root = 'financialLedgerCompanies/a/stores/a1';
const record = (id, storeId, amount, extras = {}) => ({ id, companyId: 'a', storeId, amount, accountType: 'cash', date: '2026-10-16T08:00:00-05:00', type: amount < 0 ? 'expense' : 'income_manual', description: 'Prueba', registeredBy: 'Test', ...extras });
const fixtures = {
  'companies/a': { status: 'active' }, 'companies/b': { status: 'active' },
  'stores/a1': { companyId: 'a' }, 'stores/a2': { companyId: 'a' }, 'stores/b1': { companyId: 'b' },
  'roles/admin': { companyId: 'a', userType: 'admin', permissions: ['financial_reconciliation'] },
  'roles/seller': { companyId: 'a', userType: 'seller', permissions: ['financial_reconciliation'] },
  'sellers/admin': { companyId: 'a', storeId: 'a1', roleId: 'admin' },
  'sellers/seller': { companyId: 'a', storeId: 'a1', roleId: 'seller' },
  'financialRecords/own': record('own', 'a1', 100),
  'financialRecords/other': { ...record('other', 'b1', 900), companyId: 'b' },
  [root]: { companyId: 'a', storeId: 'a1', ready: true, accounts: { cash: 100 } },
  [root + '/accounts/cash/entries/own']: { ...record('own', 'a1', 100), ledgerTime: 1 },
  'financialLedgerCompanies/a/stores/a2': { companyId: 'a', storeId: 'a2' },
  'financialLedgerCompanies/b/stores/b1': { companyId: 'b', storeId: 'b1' },
  'financialLedgerCompanies/a/stores/b1': { companyId: 'a', storeId: 'b1' },
  'authCredentials/admin': { passwordHash: 'private-fixture' }, 'financialLedgerState/own': { private: true }
};
async function seed(env) {
  await env.withSecurityRulesDisabled(async context => {
    await Promise.all(Object.entries(fixtures).map(([path, value]) => setDoc(doc(context.firestore(), path), value)));
  });
}

test('Firestore rules and financial transactions integration', async t => {
  const strict = await initializeTestEnvironment({ projectId: 'demo-vestika-strict', firestore: { rules: await readFile(new URL('../../security/financial-read.prototype.rules', import.meta.url), 'utf8') } });
  const legacy = await initializeTestEnvironment({ projectId: 'demo-vestika-legacy', firestore: { rules: "rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if request.auth != null; } } }" } });
  try {
    await seed(strict); await seed(legacy);
    await t.test('CHARACTERIZATION: current staging rules allow cross-company reads and summary tampering', async () => {
      const db = legacy.authenticatedContext('anonymous', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
      await assertSucceeds(getDoc(doc(db, 'financialRecords/other')));
      await assertSucceeds(updateDoc(doc(db, root), { accounts: { cash: 999999 } }));
    });
    await t.test('strict prototype allows the exact summary and 50-row account queries for verified identity', async () => {
      const db = strict.authenticatedContext('admin', claims()).firestore();
      await assertSucceeds(getDoc(doc(db, root)));
      await assertSucceeds(getDocs(query(collection(db, root + '/accounts/cash/entries'), orderBy('ledgerTime', 'desc'), limit(50))));
      await assertSucceeds(getDocs(query(collection(db, 'financialRecords'), where('companyId', '==', 'a'), where('storeId', '==', 'a1'))));
      await assertFails(getDocs(collection(db, 'financialRecords')));
    });
    await t.test('cross-company access, forged store path, public access and unverified anonymous identity are denied', async () => {
      const db = strict.authenticatedContext('admin', claims()).firestore();
      for (const path of ['financialRecords/other', 'financialLedgerCompanies/b/stores/b1', 'financialLedgerCompanies/a/stores/b1']) await assertFails(getDoc(doc(db, path)));
      await assertFails(getDoc(doc(strict.unauthenticatedContext().firestore(), root)));
      await assertFails(getDoc(doc(strict.authenticatedContext('anon', { ...claims(), firebase: { sign_in_provider: 'anonymous' } }).firestore(), root)));
    });
    await t.test('seller cannot switch stores; administrator may read another store in the same company', async () => {
      const seller = strict.authenticatedContext('seller', claims('seller')).firestore();
      await assertSucceeds(getDoc(doc(seller, root)));
      await assertFails(getDoc(doc(seller, 'financialLedgerCompanies/a/stores/a2')));
      await assertSucceeds(getDoc(doc(strict.authenticatedContext('admin', claims()).firestore(), 'financialLedgerCompanies/a/stores/a2')));
    });
    await t.test('projection create/update/delete and private state/credentials are denied even to administrators', async () => {
      const db = strict.authenticatedContext('admin', claims()).firestore();
      await assertFails(setDoc(doc(db, root + '/accounts/cash/entries/injected'), record('injected', 'a1', 1)));
      await assertFails(updateDoc(doc(db, root), { ready: true, accounts: { cash: 999 } }));
      await assertFails(deleteDoc(doc(db, root)));
      for (const path of ['authCredentials/admin', 'financialLedgerState/own', 'sellers/admin', 'roles/admin']) {
        await assertFails(getDoc(doc(db, path)));
        await assertFails(setDoc(doc(db, path), { roleId: 'admin', companyId: 'b' }));
      }
    });
    await t.test('revocation and changed role invalidate existing claims immediately', async () => {
      const db = strict.authenticatedContext('admin', claims()).firestore();
      await strict.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), 'sellers/admin'), { isDisabled: true }));
      await assertFails(getDoc(doc(db, root)));
      await strict.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), 'sellers/admin'), { isDisabled: false, roleId: 'seller' }));
      await assertFails(getDoc(doc(db, root)));
    });
    await t.test('RELEASE GATE: current anonymous login query is rejected by strict rules', async () => {
      const db = strict.authenticatedContext('current-pos', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
      await assertFails(getDocs(collection(db, 'sellers')));
    });
    await t.test('real Firestore transaction mirrors edits, rejects foreign links, prevents stale edits and retries safely', async () => {
      const dir = await mkdtemp(fileURLToPath(new URL('../.finance-emulator-', import.meta.url)));
      try {
        const path = join(dir, 'writer.mjs');
        await build({ entryPoints: ['services/tenantWrites.ts'], outfile: path, bundle: true, format: 'esm', platform: 'node', external: ['firebase/firestore'] });
        const { createTenantWriter } = await import(pathToFileURL(path).href);
        const db = legacy.authenticatedContext('operator').firestore();
        const writer = createTenantWriter(db, { companyId: 'a', storeIds: new Set(['a1', 'a2']) });
        const left = record('left', 'a1', -100, { relatedRecordId: 'right', debtStoreId: 'a2', subCategory: 'Cruce Sedes' });
        const right = record('right', 'a2', 100, { relatedRecordId: 'left', debtStoreId: 'a1', subCategory: 'Cruce Sedes' });
        const batch = writer.writeBatch(); batch.set(doc(db, 'financialRecords/left'), left); batch.set(doc(db, 'financialRecords/right'), right);
        await batch.commit();
        await writer.updateDoc(doc(db, 'financialRecords/left'), { amount: -250 });
        assert.equal((await getDoc(doc(db, 'financialRecords/right'))).data().amount, 250);
        const stale = writer.writeBatch(); stale.set(doc(db, 'financialRecords/left'), left); stale.set(doc(db, 'financialRecordsHistory/stale'), { companyId: 'a', storeId: 'a1', recordId: 'left', action: 'update', previousState: left, newState: left });
        await assert.rejects(stale.commit(), /otra ventana/);
        await assert.rejects(writer.updateDoc(doc(db, 'financialRecords/other'), { amount: 0 }), /otra empresa/);
        const one = record('one', 'a1', 50);
        const retry = () => { const batch = writer.writeBatch(); batch.set(doc(db, 'financialRecords/one'), one); batch.set(doc(db, 'financialRecordsHistory/receipt'), { companyId: 'a', storeId: 'a1', recordId: 'one', action: 'create', newState: one }); return batch.commit(); };
        await retry(); await retry();
        assert.equal((await getDoc(doc(db, 'financialRecords/one'))).data().amount, 50);
        await writer.deleteDoc(doc(db, 'financialRecords/left'));
        assert.equal((await getDoc(doc(db, 'financialRecords/right'))).exists(), false);
      } finally { await rm(dir, { recursive: true, force: true }); }
    });
  } finally { await strict.cleanup(); await legacy.cleanup(); }
});
