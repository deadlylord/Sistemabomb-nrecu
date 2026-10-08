import test from 'node:test';
import assert from 'node:assert/strict';
import { assertStagingConfig, seedSecondStore } from '../scripts/stagingSecondStore.mjs';

const config = { projectId: 'vestika-staging', authDomain: 'vestika-staging.firebaseapp.com',
  storageBucket: 'vestika-staging.firebasestorage.app', apiKey: 'synthetic', messagingSenderId: 'synthetic', appId: 'synthetic' };
function fixture() {
  const records = new Map(Object.entries({
    'companies/staging_company': { allowedViews: ['pos', 'inventory'] },
    'stores/staging_store_01': { companyId: 'staging_company', nextInvoiceNumber: 9 },
    'sellers/staging_admin': { companyId: 'staging_company', username: 'stagingadmin', storeId: 'staging_store_01', roleId: 'staging_admin_role', password: 'unchanged' },
    'roles/staging_admin_role': { companyId: 'staging_company', userType: 'admin', permissions: ['pos', 'inventory'] },
    'categories/staging_category_01': { companyId: 'staging_company' },
    'inventory/staging_product_01': { companyId: 'staging_company', storeId: 'staging_store_01', stock: 9 },
    'sales/test-sale': { companyId: 'staging_company', storeId: 'staging_store_01', total: 50000 },
  }));
  const writes = [];
  const sdk = { doc: (_, collection, id) => `${collection}/${id}`, runTransaction: async (_, fn) => {
    const pending = [];
    const result = await fn({
      get: async key => { assert.equal(pending.length, 0, 'all reads before writes'); return { exists: () => records.has(key), data: () => records.get(key) }; },
      set: (key, row) => pending.push([key, structuredClone(row)]),
    });
    for (const [key, row] of pending) { writes.push(key); records.set(key, row); }
    return result;
  } };
  return { records, writes, run: () => seedSecondStore({}, sdk) };
}

test('staging seed rejects production and mixed Firebase configuration', () => {
  assert.doesNotThrow(() => assertStagingConfig(config));
  for (const key of ['projectId', 'authDomain', 'storageBucket', 'apiKey']) {
    assert.throws(() => assertStagingConfig({ ...config, [key]: '' }));
  }
  for (const key of ['projectId', 'authDomain', 'storageBucket']) {
    assert.throws(() => assertStagingConfig({ ...config, [key]: 'production' }), /SAFETY STOP/);
  }
});

test('second staging store creates only four isolated documents and preserves first store, sale and credentials', async () => {
  const f = fixture(), before = structuredClone(f.records);
  assert.equal(await f.run(), 4);
  for (const [key, row] of before) assert.deepEqual(f.records.get(key), row);
  assert.deepEqual(f.writes, ['stores/staging_store_02', ...[1, 2, 3].map(i => `inventory/staging_store_02_product_0${i}`)]);
  const products = f.writes.slice(1).map(key => f.records.get(key));
  assert.equal(new Set(products.map(p => p.sku)).size, 3);
  for (const p of products) { assert.equal(p.companyId, 'staging_company'); assert.equal(p.storeId, 'staging_store_02'); assert.match(p.sku, /^TEST2-/); }
  assert.equal(f.records.get('roles/staging_admin_role').userType, 'admin');
});

test('second staging seed is idempotent and never resets stock or invoice sequence', async () => {
  const f = fixture(); await f.run();
  f.records.get('inventory/staging_store_02_product_01').stock = 2;
  f.records.get('stores/staging_store_02').nextInvoiceNumber = 15;
  const before = structuredClone(f.records); f.writes.length = 0;
  assert.equal(await f.run(), 0); assert.deepEqual(f.records, before); assert.deepEqual(f.writes, []);
});

test('second staging seed rejects missing prerequisites, disabled or foreign identity and insufficient role without writing', async () => {
  for (const mutate of [
    f => f.records.delete('companies/staging_company'),
    f => { f.records.get('stores/staging_store_01').companyId = 'foreign'; },
    f => { f.records.get('sellers/staging_admin').companyId = 'foreign'; },
    f => { f.records.get('sellers/staging_admin').isDisabled = true; },
    f => { f.records.get('sellers/staging_admin').username = 'someone-else'; },
    f => { f.records.get('roles/staging_admin_role').companyId = 'foreign'; },
    f => { f.records.get('roles/staging_admin_role').userType = 'seller'; },
    f => { f.records.get('roles/staging_admin_role').permissions = []; },
  ]) {
    const f = fixture(); mutate(f);
    await assert.rejects(f.run(), /SAFETY STOP/); assert.deepEqual(f.writes, []);
  }
});

test('second staging seed refuses existing foreign tenant/store collisions atomically', async () => {
  for (const [key, row] of [
    ['stores/staging_store_02', { companyId: 'foreign', name: 'Tienda Pruebas 2' }],
    ['inventory/staging_store_02_product_02', { companyId: 'staging_company', storeId: 'staging_store_01' }],
  ]) {
    const f = fixture(); f.records.set(key, row);
    await assert.rejects(f.run(), /SAFETY STOP/); assert.deepEqual(f.writes, []);
  }
});
