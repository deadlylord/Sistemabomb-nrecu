import { isDeepStrictEqual } from 'node:util';
import { projectFinancialRecords, ledgerRoot, ledgerDay, ledgerTime, projectionLocations, emptyLedgerSummary, emptyLedgerMonth, applyLedgerDelta } from './financialProjection.mjs';

const PRODUCTION = 'factura2-6e811';
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 128 && !value.includes('/');
function target(db, { projectId, companyId, storeId }) {
  if (projectId !== PRODUCTION || db.projectId !== projectId || !validId(companyId) || !validId(storeId)) throw new Error('Explicit production project/company/store required');
}
export function projectionWritePath(path) {
  return /^(financialLedgerState|financialLedgerErrors)\/[^/]+$/.test(path) ||
    /^financialLedgerCompanies\/[^/]+\/stores\/[^/]+(?:\/(?:months\/[^/]+(?:\/entries\/[^/]+)?|accounts\/[^/]+\/entries\/[^/]+|peers\/[^/]+\/entries\/[^/]+))?$/.test(path);
}
// The migration/projector adapter cannot write a seller, source, store or audit.
export function projectionOnlyDb(db) {
  return { projectId: db.projectId, doc: path => db.doc(path), collection: path => db.collection(path),
    runTransaction: (callback, options) => db.runTransaction(transaction => callback({
      get: ref => transaction.get(ref), getAll: (...refs) => transaction.getAll(...refs),
      set(ref, ...values) { if (!projectionWritePath(ref.path)) throw new Error('Source writes are forbidden'); transaction.set(ref, ...values); },
      delete(ref) { if (!projectionWritePath(ref.path)) throw new Error('Source writes are forbidden'); transaction.delete(ref); }
    }), options)
  };
}

export async function backfillOnlineLedger(db, options) {
  target(db, options);
  const { companyId, storeId, documentId = '__name__', afterId, onProgress = () => {} } = options;
  const store = await db.doc('stores/' + storeId).get();
  if (!store.exists || (store.data().companyId || 'default_company') !== companyId) throw new Error('Store/company mismatch');
  if (afterId !== undefined && !validId(afterId)) throw new Error('Invalid resume cursor');
  const base = db.collection('financialRecords').where('storeId', '==', storeId).orderBy(documentId);
  let cursor = afterId, count = 0, pages = 0;
  const writer = projectionOnlyDb(db);
  while (true) {
    const query = (cursor ? base.startAfter(cursor) : base).limit(50);
    const page = await query.get();
    if (!page.size) break;
    await projectFinancialRecords(writer, page.docs.map(source => source.id));
    const next = page.docs.at(-1).id;
    if (next === cursor) throw new Error('Repeated backfill page');
    cursor = next; count += page.size; pages++;
    await onProgress({ projectId: PRODUCTION, companyId, storeId, processed: count, pages, cursor });
    if (page.size < 50) break;
  }
  return { projectId: PRODUCTION, companyId, storeId, processed: count, pages, cursor, activated: false, sourceWrites: 0 };
}

const cents = value => Math.round(value * 100);
// Independent arithmetic matching the existing screen. Compare this with the
// projector as well as comparing the projector with the stored summaries.
export function legacyLedgerBalances(records) {
  const accounts = {}, peers = {};
  for (const record of records) {
    if (record.affectsCashBalance !== false) accounts[record.accountType] = (accounts[record.accountType] || 0) + record.amount;
    if (record.debtStoreId) {
      const peer = peers[record.debtStoreId] ||= { total: 0, cash: 0, qr: 0, count: 0 };
      const category = (record.subCategory || '').toLowerCase();
      const impact = category.startsWith('cruce') || category.includes('préstamo') ? -record.amount : record.amount;
      peer.total += impact; peer.count++;
      if (record.accountType === 'cash') peer.cash += impact;
      if (['qr', 'addi'].includes(record.accountType)) peer.qr += impact;
    }
  }
  const normalize = values => Object.fromEntries(Object.entries(values).filter(([, value]) => cents(value) !== 0).map(([key, value]) => [key, cents(value) / 100]));
  return { accounts: normalize(accounts), peers: Object.fromEntries(Object.entries(peers).map(([key, peer]) => [key, { ...peer, total: cents(peer.total) / 100, cash: cents(peer.cash) / 100, qr: cents(peer.qr) / 100 }])) };
}

async function readPages(transaction, base, documentId) {
  const rows = []; let cursor;
  while (true) {
    const query = (cursor ? base.orderBy(documentId).startAfter(cursor) : base.orderBy(documentId)).limit(200);
    const page = await transaction.get(query);
    rows.push(...page.docs);
    if (page.size < 200) return rows;
    const next = page.docs.at(-1);
    if (cursor?.id === next.id) throw new Error('Repeated verification page');
    cursor = next;
  }
}
async function getMany(transaction, refs) {
  const values = new Map();
  for (let index = 0; index < refs.length; index += 150) {
    const rows = await transaction.getAll(...refs.slice(index, index + 150));
    rows.forEach(row => values.set(row.ref.path, row));
  }
  return values;
}
const version = snapshot => `${snapshot.updateTime.seconds}:${snapshot.updateTime.nanoseconds}`;

export async function verifyOnlineLedger(db, options) {
  target(db, options);
  const { companyId, storeId, documentId = '__name__', activate = false, assertDeploymentReady } = options;
  if (activate && typeof assertDeploymentReady !== 'function') throw new Error('Deployment verification is required before activation');
  const root = ledgerRoot(companyId, storeId);
  // Read-only snapshots do not lock the business history. Only the final root
  // write uses a version precondition; changed projections cause a fresh audit.
  const verified = await db.runTransaction(async transaction => {
    const store = await transaction.get(db.doc('stores/' + storeId));
    if (!store.exists || (store.data().companyId || 'default_company') !== companyId) throw new Error('Store/company mismatch');
    const sourceRows = await readPages(transaction, db.collection('financialRecords').where('storeId', '==', storeId), documentId);
    const records = sourceRows.map(source => {
      const record = { ...source.data(), id: source.id };
      if (record.companyId && record.companyId !== companyId) throw new Error('Foreign financial source');
      record.companyId = companyId; return record;
    });
    const peerIds = [...new Set(records.map(record => record.debtStoreId).filter(Boolean))];
    if (peerIds.some(id => !validId(id) || id === storeId)) throw new Error('Invalid peer store');
    const peerStores = await getMany(transaction, peerIds.map(id => db.doc('stores/' + id)));
    for (const id of peerIds) {
      const peer = peerStores.get('stores/' + id);
      if (!peer?.exists || (peer.data().companyId || 'default_company') !== companyId) throw new Error('Foreign peer store');
    }
    const summary = emptyLedgerSummary(companyId, storeId), months = new Map();
    const states = await getMany(transaction, sourceRows.flatMap(source => [db.doc('financialLedgerState/' + source.id), db.doc('financialLedgerErrors/' + source.id)]));
    for (let index = 0; index < records.length; index++) {
      const record = records[index], source = sourceRows[index];
      const state = states.get('financialLedgerState/' + source.id), error = states.get('financialLedgerErrors/' + source.id);
      if (error?.exists || !state?.exists || state.data().sourceVersion !== version(source) || !isDeepStrictEqual(state.data().record, record)) throw new Error('Projection is catching up or contains an invalid source');
      const month = ledgerDay(record.date).slice(0, 7);
      if (!months.has(month)) months.set(month, emptyLedgerMonth(companyId, storeId));
      applyLedgerDelta(summary, months.get(month), record, 1);
    }
    const legacy = legacyLedgerBalances(records);
    if (!isDeepStrictEqual(summary.accounts, legacy.accounts) || !isDeepStrictEqual(summary.peers, legacy.peers)) throw new Error('Balances do not match the existing ledger');
    const rootSnapshot = await transaction.get(db.doc(root));
    const actual = rootSnapshot.exists ? rootSnapshot.data() : summary;
    if (records.length && !rootSnapshot.exists) throw new Error('Missing projection');
    if (actual.companyId !== companyId || actual.storeId !== storeId || actual.schemaVersion !== 1) throw new Error('Projection ownership/schema mismatch');
    for (const key of ['count', 'accounts', 'peers']) if (!isDeepStrictEqual(actual[key], summary[key])) throw new Error('Summary mismatch: ' + key);
    const actualMonths = await readPages(transaction, db.collection(root + '/months'), documentId);
    const monthMap = new Map(actualMonths.map(row => [row.id, row.data()]));
    for (const key of new Set([...months.keys(), ...monthMap.keys()])) {
      const expected = months.get(key) || emptyLedgerMonth(companyId, storeId), value = monthMap.get(key);
      if (!value || value.companyId !== companyId || value.storeId !== storeId || value.count !== expected.count || !isDeepStrictEqual(value.categories, expected.categories)) throw new Error('Monthly summary mismatch');
    }
    // Check every projected entry used by pages/closures/exports, including stale
    // extras. Matching only totals can hide two opposite, erroneous entries.
    const expectedEntries = new Map(records.flatMap(record => projectionLocations(record).map(path => [path, { ...record, ledgerTime: ledgerTime(record.date), balanceAmount: record.affectsCashBalance === false ? 0 : record.amount }])));
    const paths = new Set(['cash', 'qr', 'addi', 'sistecredito'].map(account => root + '/accounts/' + account + '/entries'));
    for (const key of monthMap.keys()) paths.add(root + '/months/' + key + '/entries');
    for (const peerId of Object.keys(summary.peers)) paths.add(root + '/peers/' + peerId + '/entries');
    let entries = 0;
    for (const path of paths) {
      for (const entry of await readPages(transaction, db.collection(path), documentId)) {
        const expected = expectedEntries.get(entry.ref.path);
        if (!expected || !isDeepStrictEqual(entry.data(), expected)) throw new Error('Projection entry mismatch');
        expectedEntries.delete(entry.ref.path); entries++;
      }
    }
    if (expectedEntries.size) throw new Error('Projection entries missing');
    return { summary: actual, rootExists: rootSnapshot.exists, rootVersion: rootSnapshot.updateTime,
      sources: records.length, months: months.size, entries, readTime: store.readTime?.toDate().toISOString() || null };
  }, { readOnly: true });
  if (activate) {
    if (await assertDeploymentReady() !== true) throw new Error('Production deployment was not verified');
    const data = { ...verified.summary, ready: true, verifiedAt: new Date().toISOString(), verifiedReadTime: verified.readTime };
    const batch = db.batch();
    if (verified.rootExists) batch.update(db.doc(root), data, { lastUpdateTime: verified.rootVersion });
    else batch.create(db.doc(root), data);
    await batch.commit();
  }
  return { projectId: PRODUCTION, companyId, storeId, sources: verified.sources, months: verified.months, entries: verified.entries,
    readTime: verified.readTime, activated: activate, sourceWrites: 0 };
}
