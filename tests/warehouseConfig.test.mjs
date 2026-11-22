import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { warehouseOperation } from '../functions/src/warehouse.mjs';
import { identityUid } from '../functions/src/stagingUsers.mjs';
import { productionBusinessValue } from '../functions/src/onlineBusinessSummary.mjs';
import { prepareCompatibleWarehouseRules, warehouseProductionBaseline } from '../functions/src/compatibleWarehouseRules.mjs';

async function clientFixture(run, { env = 'staging', flag = 'true', project = 'vestika-staging' } = {}) {
  const dir = await mkdtemp(join(process.cwd(), 'tests/.warehouse-client-'));
  const control = { calls: [], result: { ok: true } };
  globalThis.__warehouseClient = control;
  try {
    const built = await build({
      stdin: { contents: "export * from './services/warehouse';", resolveDir: process.cwd() },
      bundle: true,
      write: false,
      platform: 'node',
      format: 'esm',
      define: { 'import.meta.env': JSON.stringify({ VITE_APP_ENV: env, VITE_STORE_WAREHOUSE: flag }) },
      plugins: [{
        name: 'sdk',
        setup(plugin) {
          plugin.onResolve({ filter: /\/firebase$/ }, () => ({ path: 'firebase', namespace: 'fake' }));
          plugin.onResolve({ filter: /^firebase\/functions$/ }, () => ({ path: 'functions', namespace: 'fake' }));
          plugin.onLoad({ filter: /.*/, namespace: 'fake' }, args => ({
            contents: args.path === 'firebase'
              ? `export const auth={app:{options:{projectId:${JSON.stringify(project)}}}};`
              : `const c=globalThis.__warehouseClient;export const getFunctions=(app,region)=>({app,region});export const httpsCallable=(target,name)=>async data=>{c.calls.push({target,name,data});return{data:c.result}};`,
          }));
        },
      }],
    });
    const file = join(dir, 'warehouse.mjs');
    await writeFile(file, built.outputFiles[0].text);
    const mod = await import(pathToFileURL(file).href);
    await run({ control, ...mod });
  } finally {
    delete globalThis.__warehouseClient;
    await rm(dir, { recursive: true, force: true });
  }
}

async function callableFixture(run, projectId = 'vestika-staging') {
  const dir = await mkdtemp(join(process.cwd(), 'tests/.warehouse-callable-'));
  const control = { projectId, dbCalls: 0 };
  globalThis.__prodWarehouse = control;
  try {
    const built = await build({
      stdin: { contents: "export { productionPosWarehouse } from './functions/src/productionWarehouse.mjs';", resolveDir: process.cwd() },
      bundle: true,
      write: false,
      platform: 'node',
      format: 'esm',
      plugins: [{
        name: 'admin',
        setup(plugin) {
          plugin.onResolve({ filter: /^firebase-admin\/app$/ }, () => ({ path: 'app', namespace: 'fake' }));
          plugin.onResolve({ filter: /^firebase-admin\/firestore$/ }, () => ({ path: 'db', namespace: 'fake' }));
          plugin.onResolve({ filter: /^firebase-functions\/v2\/https$/ }, () => ({ path: 'https', namespace: 'fake' }));
          plugin.onLoad({ filter: /.*/, namespace: 'fake' }, args => ({
            contents: args.path === 'app'
              ? 'export const getApp=()=>({options:{projectId:globalThis.__prodWarehouse.projectId}});'
              : args.path === 'db'
                ? 'export const getFirestore=()=>{globalThis.__prodWarehouse.dbCalls++;return{};};'
                : 'export class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}};export const onCall=(options,handler)=>{handler.options=options;return handler;};',
          }));
        },
      }],
    });
    const file = join(dir, 'callable.mjs');
    await writeFile(file, built.outputFiles[0].text);
    const mod = await import(pathToFileURL(file).href);
    await run({ control, call: mod.productionPosWarehouse });
  } finally {
    delete globalThis.__prodWarehouse;
    await rm(dir, { recursive: true, force: true });
  }
}

test('warehouse client selects staging and production endpoints by environment', async () => {
  await clientFixture(async ({ control, warehouseEnabled, callWarehouse }) => {
    assert.equal(warehouseEnabled, true);
    await callWarehouse('co', 'st', { action: 'summary' });
    assert.equal(control.calls.length, 1);
    assert.equal(control.calls[0].name, 'vestikaStagingWarehouse');
    assert.equal(control.calls[0].target.region, 'us-central1');
  }, { env: 'staging', flag: 'true', project: 'vestika-staging' });

  await clientFixture(async ({ control, warehouseEnabled, callWarehouse }) => {
    assert.equal(warehouseEnabled, true);
    await callWarehouse('co', 'st', { action: 'summary' });
    assert.equal(control.calls.length, 1);
    assert.equal(control.calls[0].name, 'productionPosWarehouse');
    assert.equal(control.calls[0].target.region, 'us-central1');
  }, { env: 'production', flag: 'true', project: 'factura2-6e811' });
});

for (const options of [
  { env: 'production', flag: 'false', project: 'factura2-6e811' },
  { env: 'production', flag: '', project: 'factura2-6e811' },
  { env: 'production', flag: 'true', project: 'vestika-staging' },
  { env: 'staging', flag: 'true', project: 'factura2-6e811' },
  { env: 'staging', flag: 'false', project: 'vestika-staging' },
]) {
  test(`warehouse client rejects mismatched or disabled config ${JSON.stringify(options)}`, () =>
    clientFixture(async ({ control, callWarehouse }) => {
      await assert.rejects(callWarehouse('co', 'st', { action: 'summary' }), /entorno/);
      assert.equal(control.calls.length, 0);
    }, options));
}

test('productionPosWarehouse rejects non-production projects before touching Firestore', () =>
  callableFixture(async ({ control, call }) => {
    assert.equal(call.options.region, 'us-central1');
    assert.equal(call.options.enforceAppCheck, false);
    await assert.rejects(call({ data: {} }), error => error.code === 'failed-precondition');
    assert.equal(control.dbCalls, 0);
  }, 'vestika-staging'));

test('compatible warehouse rules patch is deterministic, idempotent and rejects unknown rules', () => {
  const patched = prepareCompatibleWarehouseRules(warehouseProductionBaseline);
  assert.notEqual(patched.hash, patched.previousHash);
  const repeat = prepareCompatibleWarehouseRules(patched.source);
  assert.equal(repeat.hash, repeat.previousHash);
  assert.throws(() => prepareCompatibleWarehouseRules('rules_version = "2"; service cloud.firestore {}'), /difieren/);
});

test('production business summary valuation stays invariant when moving stock between store and warehouse', () => {
  const before = productionBusinessValue('inventory', { storeId: 'st', stock: 10, cost: 25000 });
  const after = productionBusinessValue('inventory', { storeId: 'st', stock: 6, warehouseUnits: 4, cost: 25000 });
  assert.equal(before.inventoryUnits, 10);
  assert.equal(after.inventoryUnits, 10);
  assert.equal(before.inventoryValue, 250000);
  assert.equal(after.inventoryValue, 250000);
});

test('legacy default_company purchases without companyId can dispatch in default_company only', async () => {
  const rows = new Map(Object.entries({
    'sellers/u': { name: 'Admin', companyId: 'default_company', storeId: 'st', roleId: 'admin', authVersion: 1 },
    'roles/admin': { companyId: 'default_company', userType: 'admin', permissions: ['pos', 'inventory', 'purchases'] },
    'companies/default_company': { status: 'active' },
    'stores/st': { companyId: 'default_company' },
    'inventory/p': { storeId: 'st', name: 'Vestido', stock: 5, categoryId: 'cat' },
    'purchases/legacy': { storeId: 'st', productId: 'p', quantity: 3 },
  }));
  const snapshot = path => ({ id: path.split('/').at(-1), exists: rows.has(path), data: () => rows.get(path) });
  class Ref { constructor(path) { this.path = path; this.id = path.split('/').at(-1); } collection(n) { return new Query(this.path + '/' + n); } }
  class Query { constructor(path) { this.path = path; } doc(id) { return new Ref(this.path + '/' + id); } }
  Ref.prototype.get = async function () { return snapshot(this.path); };
  const db = {
    collection: n => new Query(n),
    runTransaction: async fn => {
      const writes = [];
      const tx = {
        get: async ref => snapshot(ref.path),
        set: (ref, data) => writes.push(['set', ref.path, data]),
        update: (ref, data) => writes.push(['update', ref.path, data]),
        create: (ref, data) => writes.push(['create', ref.path, data]),
      };
      const res = await fn(tx);
      for (const [op, path, data] of writes) rows.set(path, op === 'update' ? { ...rows.get(path), ...data } : data);
      return res;
    },
  };
  const auth = { uid: identityUid('u'), token: { identityVersion: 1, sellerId: 'u', companyId: 'default_company', storeId: 'st', roleId: 'admin', authVersion: 1 } };
  await warehouseOperation(db, auth, { companyId: 'default_company', storeId: 'st', action: 'purchaseMove', operationId: 'leg1', entries: [{ purchaseId: 'legacy', quantity: 2 }] });
  assert.equal(rows.get('inventory/p').stock, 3);
  assert.equal(rows.get('inventory/p').warehouseUnits, 2);

  // Another company cannot claim a legacy default_company purchase even if store matched.
  rows.set('companies/other', { status: 'active' });
  rows.set('stores/st2', { companyId: 'other' });
  rows.set('roles/r2', { companyId: 'other', userType: 'admin', permissions: ['purchases'] });
  rows.set('sellers/u2', { name: 'Other', companyId: 'other', storeId: 'st2', roleId: 'r2', authVersion: 1 });
  rows.set('purchases/legacy2', { storeId: 'st2', productId: 'p', quantity: 1 });
  const auth2 = { uid: identityUid('u2'), token: { identityVersion: 1, sellerId: 'u2', companyId: 'other', storeId: 'st2', roleId: 'r2', authVersion: 1 } };
  await assert.rejects(
    warehouseOperation(db, auth2, { companyId: 'other', storeId: 'st2', action: 'purchaseMove', operationId: 'leg2', entries: [{ purchaseId: 'legacy2', quantity: 1 }] }),
    /sede/,
  );
});
