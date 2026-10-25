// Operator-only, staging-only loader. Default mode is an offline plan.
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readdir, access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { stagingRest } from './stagingRest.mjs';
import { buildStagingLoadDataset, LOAD_PROJECT, LOAD_ID, LOAD_COMPANY } from './stagingLoadDataset.mjs';
import { verifyStagingFinancialLedger } from './verifyStagingFinancialLedger.mjs';
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const manifestPath = `readLoadDatasets/${LOAD_ID}`;
export async function applyFixtureChunks(rest, plan, onProgress = () => {}) {
  if (plan.projectId !== LOAD_PROJECT || plan.companyId !== LOAD_COMPANY || plan.datasetId !== LOAD_ID) throw Error('Unexpected staging fixture');
  const hash = sha(plan.documents);
  const current = await rest.get(manifestPath);
  if (current && (current.data.hash !== hash || current.data.projectId !== LOAD_PROJECT || current.data.companyId !== LOAD_COMPANY)) throw Error('Existing dataset does not match this plan');
  if (!current) await rest.commit([{ ...rest.set(manifestPath, { projectId: LOAD_PROJECT, companyId: LOAD_COMPANY, hash, state: 'loading', counts: plan.counts, startedAt: new Date().toISOString() }), currentDocument: { exists: false } }]);
  let created = 0, resumed = 0;
  for (let offset = 0; offset < plan.documents.length; offset += 200) {
    const rows = plan.documents.slice(offset, offset + 200), chunk = String(offset / 200).padStart(5, '0');
    const receiptPath = `${manifestPath}/chunks/${chunk}`, chunkHash = sha(rows);
    const saved = await rest.get(receiptPath);
    if (saved) {
      if (saved.data.hash !== chunkHash || saved.data.count !== rows.length) throw Error('Chunk receipt mismatch');
      resumed += rows.length; continue;
    }
    for (const row of rows) if (!row.path.split('/')[1]?.startsWith(LOAD_ID + '_') || row.data.companyId !== LOAD_COMPANY) throw Error('Fixture attempted to write outside its namespace');
    const writes = rows.map(row => ({ ...rest.set(row.path, row.data), currentDocument: { exists: false } }));
    // The receipt and all creates are atomic. A collision can never overwrite
    // existing data, and a lost acknowledgement can be resumed safely.
    writes.push({ ...rest.set(receiptPath, { hash: chunkHash, count: rows.length }), currentDocument: { exists: false } });
    await rest.commit(writes); created += rows.length;
    onProgress({ created, resumed, total: plan.documents.length });
  }
  const last = await rest.get(manifestPath);
  await rest.commit([rest.set(manifestPath, { ...last.data, state: 'loaded', loadedAt: new Date().toISOString() }, last.updateTime)]);
  return { projectId: LOAD_PROJECT, datasetId: LOAD_ID, companyId: LOAD_COMPANY, created, resumed, total: plan.documents.length };
}
async function cliTokenGetter() {
  const require = createRequire(import.meta.url), cache = join(homedir(), '.npm/_npx');
  for (const directory of await readdir(cache)) {
    const path = join(cache, directory, 'node_modules/firebase-tools/lib/auth.js');
    try { await access(path); } catch { continue; }
    const auth = require(path), account = auth.getGlobalDefaultAccount();
    if (account) return () => auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
  }
  throw Error('Reconnect Firebase CLI before loading staging fixtures');
}
export async function runLoadFixtures(args) {
  const { values } = parseArgs({ args, strict: true, options: { mode: { type: 'string', default: 'plan' }, project: { type: 'string' } } });
  const plan = buildStagingLoadDataset(values.project);
  if (!['plan','load','status','activate'].includes(values.mode)) throw Error('Choose plan|load|status|activate');
  if (values.mode === 'plan') return { ...plan, documents: undefined, total: plan.documents.length, writesPerformed: 0 };
  const getAccessToken = await cliTokenGetter(), rest = stagingRest(getAccessToken);
  const metadata = await rest.request(`https://firestore.googleapis.com/v1/projects/${LOAD_PROJECT}/databases/(default)`);
  if (metadata.name !== `projects/${LOAD_PROJECT}/databases/(default)` || metadata.databaseEdition !== 'STANDARD' || metadata.locationId !== 'southamerica-east1' || metadata.type !== 'FIRESTORE_NATIVE') throw Error('Staging database identity, edition or region mismatch');
  if (values.mode === 'load') return applyFixtureChunks(rest, plan, value => console.log(JSON.stringify(value)));
  const marker = await rest.get(manifestPath);
  if (!marker || marker.data.hash !== sha(plan.documents) || marker.data.state !== 'loaded') throw Error('Load this exact fixture completely before inspecting or activating it');
  const stores = [];
  for (const store of plan.stores) {
    const record = await rest.get(`stores/${store.id}`);
    if (record?.data.companyId !== LOAD_COMPANY) throw Error('Synthetic store ownership mismatch');
    const root = await rest.get(`financialLedgerCompanies/${LOAD_COMPANY}/stores/${store.id}`);
    if (values.mode === 'activate') {
      if (root?.data.count !== store.financial || root.data.companyId !== LOAD_COMPANY || root.data.storeId !== store.id) throw Error('Financial processors are still catching up; inspect status before retrying');
      await verifyStagingFinancialLedger(getAccessToken, { companyId: LOAD_COMPANY, storeId: store.id, activate: true });
    }
    stores.push({ id: store.id, name: store.name, expectedFinancial: store.financial, projectedFinancial: root?.data.count || 0, ready: values.mode === 'activate' || !!root?.data.ready });
  }
  return { projectId: LOAD_PROJECT, companyId: LOAD_COMPANY, stores, writesPerformed: values.mode === 'activate' ? stores.length : 0 };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runLoadFixtures(process.argv.slice(2)).then(value => console.log(JSON.stringify(value))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
