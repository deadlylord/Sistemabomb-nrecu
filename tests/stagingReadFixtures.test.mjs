import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStagingLoadDataset, LOAD_PROJECT, LOAD_ID, LOAD_COMPANY } from '../functions/scripts/stagingLoadDataset.mjs';
import { applyFixtureChunks } from '../functions/scripts/loadStagingReadFixtures.mjs';

test('synthetic data is deterministic, isolated, stock-consistent and includes old layaways with recent payments', () => {
 assert.throws(() => buildStagingLoadDataset('factura2-6e811'), /restricted/);
 const plan = buildStagingLoadDataset(LOAD_PROJECT);
 assert.deepEqual(plan, buildStagingLoadDataset(LOAD_PROJECT));
 const byPath = new Map(plan.documents.map(d => [d.path, d.data]));
 assert.equal(byPath.size, plan.documents.length);
 for (const store of plan.stores) {
  const rows = name => plan.documents.filter(d => d.path.startsWith(name + '/') && d.data.storeId === store.id).map(d => d.data);
  assert.equal(rows('inventory').length, store.products);assert.equal(rows('financialRecords').length, store.financial);
  const deltas = new Map();for (const row of rows('productHistory')) deltas.set(row.productId, (deltas.get(row.productId) || 0) + row.stockDelta);
  for (const p of rows('inventory')) { assert.equal(p.stock, deltas.get(p.id));assert.ok(p.stock >= 0); }
  for (const r of rows('financialRecords').filter(r => r.relatedRecordId)) {
   const mate = byPath.get('financialRecords/' + r.relatedRecordId);assert.equal(mate.relatedRecordId, r.id);assert.equal(mate.storeId, r.debtStoreId);assert.equal(r.amount + mate.amount, 0);
  }
  assert.ok(rows('layaways').some(l => l.createdAt.startsWith('2026-08') && l.payments.some(p => p.date.startsWith('2026-10'))));
 }
 for (const row of plan.documents) { assert.equal(row.data.companyId, LOAD_COMPANY);assert.ok(row.path.split('/')[1].startsWith(LOAD_ID + '_')); }
 assert.equal(plan.documents.some(d => /^(sellers|roles|authCredentials)\//.test(d.path)), false);
});

test('loader creates only its namespace and resumes atomic chunks without overwrites', async () => {
 const records = new Map();let commits = 0;
 const rest = {
  get: async path => records.has(path) ? { data: records.get(path), updateTime: String(commits) } : null,
  set: (path, data, updateTime) => ({ path, data, ...(updateTime ? { updateTime } : {}) }),
  commit: async writes => { for (const w of writes) if (w.currentDocument?.exists === false && records.has(w.path)) throw Error('Collision');commits++;for (const w of writes) records.set(w.path, w.data); }
 };
 const full = buildStagingLoadDataset(LOAD_PROJECT), plan = { ...full, documents: full.documents.slice(0, 3) };
 const first = await applyFixtureChunks(rest, plan);assert.equal(first.created, 3);
 const second = await applyFixtureChunks(rest, plan);assert.equal(second.created, 0);assert.equal(second.resumed, 3);
 const bad = { ...plan, datasetId: 'foreign' };await assert.rejects(() => applyFixtureChunks(rest, bad), /Unexpected/);
});
