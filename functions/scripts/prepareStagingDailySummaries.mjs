// Operator entry point for the three synthetic load-test stores only.
// Default execution is an offline plan; no login data or source documents are printed.
import { createRequire } from 'node:module';
import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { stagingRest } from './stagingRest.mjs';
import { verifyStagingBusinessSummary } from './verifyStagingBusinessSummary.mjs';
import { LOAD_PROJECT, LOAD_COMPANY, LOAD_ID } from './stagingLoadDataset.mjs';
export async function prepareStagingDailySummaries(getAccessToken, { projectId, write = false, backfill = false }) {
  if (projectId !== LOAD_PROJECT) throw Error('Daily summary rollout is restricted to vestika-staging.');
  const stores = [1, 2, 3].map(i => `${LOAD_ID}_store_${i}`);
  if (!write) return { projectId, companyId: LOAD_COMPANY, stores, mode: 'plan' };
  const rest = stagingRest(getAccessToken);
  const database = await rest.request(`https://firestore.googleapis.com/v1/projects/${LOAD_PROJECT}/databases/(default)`);
  if (database.databaseEdition !== 'STANDARD' || !database.name?.startsWith(`projects/${LOAD_PROJECT}/`)) throw Error('Unexpected staging database edition or target.');
  const deployed = await rest.request(`https://cloudfunctions.googleapis.com/v2/projects/${LOAD_PROJECT}/locations/southamerica-east1/functions?pageSize=1000`);
  const expected = ['Sales','Layaways','Incidents','Expenses','Inventory'].map(s => `business${s}Changed`);
  const missing = expected.filter(name => !deployed.functions?.some(f => f.name?.endsWith('/'+name) && f.state === 'ACTIVE'));
  if (missing.length) throw Error('Deploy staging business triggers before activation: '+missing.join(', '));
  const results = [];
  for (const storeId of stores) {
    results.push(await verifyStagingBusinessSummary(getAccessToken, { companyId: LOAD_COMPANY, storeId, backfill, activate: true }));
    console.log(JSON.stringify({ verifiedStore: storeId, ...results.at(-1) }));
  }
  return { projectId, companyId: LOAD_COMPANY, mode: 'activated', results };
}
async function cliTokenGetter() {
  const require = createRequire(import.meta.url), cache = join(homedir(), '.npm/_npx');
  for (const dir of await readdir(cache).catch(() => [])) {
    try {
      const auth = require(join(cache, dir, 'node_modules/firebase-tools/lib/auth.js'));
      const account = auth.getGlobalDefaultAccount();
      if (account) return () => auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
    } catch {}
  }
  throw Error('Reconnect Firebase CLI before verifying staging summaries.');
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const { values } = parseArgs({ options: { project: { type: 'string' }, write: { type: 'boolean' }, backfill: { type: 'boolean' } } });
  // Validate the target before accessing credentials.
  if (values.project !== LOAD_PROJECT) throw Error('Use --project vestika-staging.');
  const getter = values.write ? await cliTokenGetter() : () => { throw Error('Offline plan accessed credentials'); };
  console.log(JSON.stringify(await prepareStagingDailySummaries(getter, { projectId: values.project, write: !!values.write, backfill: !!values.backfill })));
}
