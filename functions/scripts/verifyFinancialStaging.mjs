// Restricted to staging. Creates isolated fixtures, probes the deployed rules
// with a temporary anonymous account, then deletes the fixtures and account.
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { applicationDefault } from 'firebase-admin/app';
import { fileURLToPath } from 'node:url';

export async function verifyFinancialStaging({ projectId, getAccessToken, apiKey }) {
  if (projectId !== 'vestika-staging') throw new Error('Only vestika-staging is permitted.');
  if (!apiKey) throw new Error('Staging web API key is required.');
  const prefix = `ledger_probe_${randomUUID().replaceAll('-', '')}`;
  const companyId = prefix + '_a', foreignCompany = prefix + '_b', storeId = prefix + '_a1', foreignStore = prefix + '_b1';
  const root = `financialLedgerCompanies/${companyId}/stores/${storeId}`;
  const fixtures = {
    [`companies/${companyId}`]: { name: 'Isolated ledger probe A', status: 'active' },
    [`companies/${foreignCompany}`]: { name: 'Isolated ledger probe B', status: 'active' },
    [`stores/${storeId}`]: { companyId, name: 'Probe A1' },
    [`stores/${foreignStore}`]: { companyId: foreignCompany, name: 'Probe B1' },
    [`financialRecords/${prefix}_foreign`]: { companyId: foreignCompany, storeId: foreignStore, amount: 1, date: '2026-10-16T08:00:00-05:00', description: 'Isolated rules probe' },
    [root]: { companyId, storeId, ready: false }
  };
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  const name = path => `projects/${projectId}/databases/(default)/documents/${path}`;
  const value = x => typeof x === 'string' ? { stringValue: x } : typeof x === 'boolean' ? { booleanValue: x } : { doubleValue: x };
  async function admin(path, options = {}) {
    const token = await getAccessToken();
    const response = await fetch(base + path, { ...options, headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' } });
    if (!response.ok) throw new Error(`Staging admin request failed (${response.status}).`);
    return response;
  }
  let idToken;
  const results = {};
  try {
    await admin(':commit', { method: 'POST', body: JSON.stringify({ writes: Object.entries(fixtures).map(([path, data]) => ({ update: { name: name(path), fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, value(v)])) } })) }) });
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) });
    const auth = await response.json();
    if (!response.ok) throw new Error(`Staging anonymous authentication failed (${response.status}).`);
    idToken = auth.idToken;
    const foreignRead = await fetch(base + `/financialRecords/${prefix}_foreign`, { headers: { Authorization: `Bearer ${idToken}` } });
    results.deployedRulesBlockAnonymousForeignRead = foreignRead.status === 403;
    assert.ok([200, 403].includes(foreignRead.status));
    const mutation = await fetch(base + '/' + root + '?updateMask.fieldPaths=ready', { method: 'PATCH', headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { ready: { booleanValue: true } } }) });
    results.deployedRulesBlockSummaryTampering = mutation.status === 403;
    assert.ok([200, 403].includes(mutation.status));
  } finally {
    // Commit cleanup is retriable and only ever contains the generated IDs.
    await admin(':commit', { method: 'POST', body: JSON.stringify({ writes: Object.keys(fixtures).map(path => ({ delete: name(path) })) }) });
    if (idToken) {
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) });
      if (!response.ok) throw new Error('Could not remove the temporary staging auth account.');
    }
    for (const path of Object.keys(fixtures)) {
      const token = await getAccessToken();
      const response = await fetch(base + '/' + path, { headers: { Authorization: `Bearer ${token.access_token}` } });
      assert.equal(response.status, 404, `Probe fixture was not removed: ${path}`);
    }
    results.cleaned = true;
  }
  console.log(JSON.stringify({ project: projectId, results }, null, 2));
  return results;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.argv.includes('--run')) throw new Error('Pass --run to create and clean isolated staging fixtures.');
  const credential = applicationDefault();
  await verifyFinancialStaging({ projectId: 'vestika-staging', getAccessToken: () => credential.getAccessToken(), apiKey: process.env.VESTIKA_STAGING_WEB_API_KEY });
}
