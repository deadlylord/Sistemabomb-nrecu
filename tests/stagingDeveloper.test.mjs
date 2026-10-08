import test from 'node:test';
import assert from 'node:assert/strict';
import { seedStagingDeveloper } from '../scripts/stagingDeveloper.mjs';

const config = { projectId: 'vestika-staging', authDomain: 'vestika-staging.firebaseapp.com',
  storageBucket: 'vestika-staging.firebasestorage.app', apiKey: 'synthetic', messagingSenderId: 'synthetic', appId: 'synthetic' };
function fixture() {
  const records = new Map(Object.entries({
    'companies/staging_company': { name: 'Vestika Staging' },
    'stores/staging_store_01': { companyId: 'staging_company' },
    'roles/staging_admin_role': { companyId: 'staging_company', userType: 'admin', permissions: ['pos', 'inventory'] },
    'sellers/staging_admin': { username: 'stagingadmin', roleId: 'staging_admin_role', password: 'unchanged' },
    'sales/test': { storeId: 'staging_store_01', total: 50000 },
  }));
  const writes = [];
  const sdk = { doc: (_, collection, id) => `${collection}/${id}`, runTransaction: async (_, fn) => {
    const pending = [];
    const result = await fn({
      get: async key => { assert.equal(pending.length, 0); return { exists: () => records.has(key), data: () => records.get(key) }; },
      set: (key, row) => pending.push([key, structuredClone(row)]),
    });
    for (const [key, row] of pending) { records.set(key, row); writes.push(key); }
    return result;
  } };
  return { records, writes, run: (settings = config, password = 'synthetic-password-test') => seedStagingDeveloper({}, sdk, settings, password) };
}
test('new staging Developer has a separate identity and explicit owner grant without changing administrator, stock or sales', async () => {
  const f = fixture(), before = structuredClone(f.records);
  assert.equal(await f.run(), 2);
  for (const [key, row] of before) assert.deepEqual(f.records.get(key), row);
  assert.deepEqual(f.writes, ['sellers/staging_developer', 'platformDevelopers/staging_developer']);
  const seller = f.records.get('sellers/staging_developer'), grant = f.records.get('platformDevelopers/staging_developer');
  assert.equal(seller.username, 'stagingdeveloper'); assert.equal(seller.companyId, 'staging_company');
  assert.equal(seller.storeId, 'staging_store_01'); assert.equal(grant.userId, seller.id);
  assert.equal(grant.grantedBy, '-OYqLOlA2gyy_TrUtzf2'); assert.equal(grant.role, 'developer'); assert.equal(grant.active, true);
});
test('developer seed cannot target production or accept an absent or weak password', async () => {
  const f = fixture();
  await assert.rejects(f.run({ ...config, projectId: 'production' }), /SAFETY STOP/);
  for (const password of ['', 'short', ' spaces-at-ends ']) await assert.rejects(f.run(config, password), /STAGING_DEVELOPER_PASSWORD/);
  assert.deepEqual(f.writes, []);
});
test('developer seed is idempotent without resetting an existing password', async () => {
  const f = fixture(); await f.run(); const before = structuredClone(f.records); f.writes.length = 0;
  assert.equal(await f.run(config, 'another-synthetic-password'), 0);
  assert.deepEqual(f.records, before); assert.deepEqual(f.writes, []);
});
test('developer seed rejects mismatched tenants, partial identities and revoked grants without repair', async () => {
  for (const mutate of [
    f => { f.records.get('stores/staging_store_01').companyId = 'foreign'; },
    f => { f.records.get('roles/staging_admin_role').companyId = 'foreign'; },
    f => { f.records.set('sellers/staging_developer', { companyId: 'foreign' }); },
    f => { f.records.set('platformDevelopers/staging_developer', { active: false }); },
  ]) {
    const f = fixture(); mutate(f); await assert.rejects(f.run(), /SAFETY STOP/); assert.deepEqual(f.writes, []);
  }
  const f = fixture(); await f.run(); f.writes.length = 0;
  f.records.get('platformDevelopers/staging_developer').active = false;
  await assert.rejects(f.run(), /SAFETY STOP/); assert.deepEqual(f.writes, []);
});
