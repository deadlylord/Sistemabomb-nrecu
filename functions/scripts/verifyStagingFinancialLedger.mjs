// Administrative staging gate. It never constructs balances from incomplete
// history and never activates while a source version is ahead of its projection.
import { isDeepStrictEqual } from 'node:util';
import { readFile } from 'node:fs/promises';
import { stagingRest } from './stagingRest.mjs';
import { ledgerRoot, ledgerDay, emptyLedgerSummary, emptyLedgerMonth, applyLedgerDelta } from '../src/financialProjection.mjs';
const base = 'https://firestore.googleapis.com/v1/projects/vestika-staging/databases/(default)/documents';
const name = path => 'projects/vestika-staging/databases/(default)/documents/' + path;
export function restSourceVersion(timestamp) {
  const match = timestamp.match(/^(.*?)(?:\.(\d+))?Z$/);
  if (!match) throw new Error('Invalid source update time');
  return `${Math.floor(new Date(match[1] + 'Z').getTime() / 1000)}:${Number((match[2] || '').padEnd(9, '0'))}`;
}
export async function verifyStagingFinancialLedger(getAccessToken, { companyId, storeId, activate = false }) {
  if (![companyId, storeId].every(value => typeof value === 'string' && value && value.length <= 128 && !value.includes('/'))) throw new Error('Invalid staging company/store');
  const rest = stagingRest(getAccessToken);
  if (activate) {
    const expectedRules = await readFile(new URL('../../security/firestore.staging.rules', import.meta.url), 'utf8');
    if ((await rest.deployedRules()).trim() !== expectedRules.trim()) throw new Error('Deploy the verified staging rules before activating the projection');
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const { transaction } = await rest.request(base + ':beginTransaction', { method: 'POST', body: JSON.stringify({ options: activate ? { readWrite: {} } : { readOnly: {} } }) });
    let committed = false;
    try {
      const get = async paths => {
        const documents = new Map();
        for (let start = 0; start < paths.length; start += 200) {
          const rows = await rest.request(base + ':batchGet', { method: 'POST', body: JSON.stringify({ documents: paths.slice(start, start + 200).map(name), transaction }) });
          for (const row of rows) if (row.found) { const doc = rest.decodeDocument(row.found); documents.set(doc.path, doc); }
        }
        return documents;
      };
      const store = (await get(['stores/' + storeId])).get('stores/' + storeId);
      if (!store || (store.data.companyId || 'default_company') !== companyId) throw new Error('Store/company mismatch');
      const result = await rest.request(base + ':runQuery', { method: 'POST', body: JSON.stringify({ transaction, structuredQuery: {
        from: [{ collectionId: 'financialRecords' }], where: { fieldFilter: { field: { fieldPath: 'storeId' }, op: 'EQUAL', value: { stringValue: storeId } } }, limit: 5001
      } }) });
      const sources = result.filter(row => row.document).map(row => rest.decodeDocument(row.document));
      if (sources.length > 5000) throw new Error('This staging verification gate is limited to 5,000 sources; use the paginated backfill and a dedicated maintenance window for larger histories.');
      const expected = emptyLedgerSummary(companyId, storeId), months = new Map();
      const states = await get(sources.map(source => 'financialLedgerState/' + source.id));
      for (const source of sources) {
        if (source.data.companyId && source.data.companyId !== companyId) throw new Error('Foreign financial source');
        const state = states.get('financialLedgerState/' + source.id);
        if (!state || state.data.sourceVersion !== restSourceVersion(source.updateTime) || state.data.record?.companyId !== companyId || state.data.record?.storeId !== storeId) throw new Error('Projection is catching up; retry before activation');
        const key = ledgerDay(source.data.date).slice(0, 7);
        if (!months.has(key)) months.set(key, emptyLedgerMonth(companyId, storeId));
        applyLedgerDelta(expected, months.get(key), { ...source.data, id: source.id, companyId }, 1);
      }
      const root = ledgerRoot(companyId, storeId);
      const actual = await get([root, ...[...months.keys()].map(key => root + '/months/' + key)]);
      const summary = actual.get(root)?.data;
      if (!summary && sources.length) throw new Error('Projection summary missing');
      for (const key of ['count', 'accounts', 'peers']) if (!isDeepStrictEqual(summary ? summary[key] : expected[key], expected[key])) throw new Error('Summary mismatch: ' + key);
      if (summary && (summary.companyId !== companyId || summary.storeId !== storeId || summary.schemaVersion !== 1)) throw new Error('Summary ownership/schema mismatch');
      for (const [key, expectedMonth] of months) {
        const month = actual.get(root + '/months/' + key)?.data;
        if (!month || month.companyId !== companyId || month.storeId !== storeId || month.count !== expectedMonth.count || !isDeepStrictEqual(month.categories, expectedMonth.categories)) throw new Error('Monthly summary mismatch: ' + key);
      }
      if (activate) {
        await rest.request(base + ':commit', { method: 'POST', body: JSON.stringify({ transaction, writes: [rest.set(root, { ...(summary || expected), ready: true, verifiedAt: new Date().toISOString() })] }) });
        committed = true;
      }
      const verification = { project: 'vestika-staging', companyId, storeId, sources: sources.length, months: months.size, activated: activate };
      console.log(JSON.stringify(verification)); return verification;
    } catch (error) {
      if (error.status !== 409 || attempt === 3) throw error;
    } finally {
      if (!committed) await rest.request(base + ':rollback', { method: 'POST', body: JSON.stringify({ transaction }) }).catch(() => {});
    }
  }
}
