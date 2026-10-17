// Offline planning only. This module has no database transport and emits no writes.
import { createHash } from 'node:crypto';
import { ledgerDay, emptyLedgerSummary, emptyLedgerMonth, applyLedgerDelta } from './financialProjection.mjs';
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 128 && !value.includes('/');
const companyOf = store => store.companyId || 'default_company';
const sourceFields = ['id', 'companyId', 'storeId', 'amount', 'date', 'accountType', 'debtStoreId', 'relatedRecordId', 'subCategory', 'affectsCashBalance'];
export function planFinancialMigration({ stores, records, snapshot }) {
  if (snapshot?.complete !== true || !Number.isFinite(Date.parse(snapshot.readTime))) throw new Error('A complete, dated source snapshot is required.');
  const storeMap = new Map(), recordMap = new Map(), expected = new Map(), monthly = new Map();
  const blockingIssues = [], reviewCases = [], inferredOwnership = [], pairs = new Set();
  for (const store of stores) {
    if (!validId(store.id) || !validId(companyOf(store)) || storeMap.has(store.id)) throw new Error('Invalid or duplicate store identity.');
    storeMap.set(store.id, store);
    expected.set(store.id, emptyLedgerSummary(companyOf(store), store.id));
  }
  for (const source of records) {
    if (!validId(source.id) || recordMap.has(source.id)) {
      blockingIssues.push({ type: 'invalid-or-duplicate-record-id', recordId: source.id });
      continue;
    }
    recordMap.set(source.id, source);
  }
  for (const source of recordMap.values()) {
    const store = storeMap.get(source.storeId);
    try {
      if (!store) throw new Error('store-missing');
      const companyId = companyOf(store);
      if (source.companyId && source.companyId !== companyId) throw new Error('company-mismatch');
      if (!Number.isFinite(source.amount) || !['cash', 'qr', 'addi', 'sistecredito'].includes(source.accountType)) throw new Error('invalid-amount-or-account');
      const month = ledgerDay(source.date).slice(0, 7);
      if (source.debtStoreId) {
        const peer = storeMap.get(source.debtStoreId);
        if (!peer || peer.id === store.id || companyOf(peer) !== companyId) throw new Error('peer-ownership-mismatch');
      }
      if (!source.companyId) inferredOwnership.push({ recordId: source.id, companyId, storeId: store.id });
      const key = `${store.id}/${month}`;
      if (!monthly.has(key)) monthly.set(key, emptyLedgerMonth(companyId, store.id));
      // Preserve every economic value and each side's original date. Ownership
      // is resolved only for the derived view; no source repair is proposed.
      applyLedgerDelta(expected.get(store.id), monthly.get(key), { ...source, companyId }, 1);
    } catch (error) {
      blockingIssues.push({ type: error.message, recordId: source.id });
    }
    if (source.debtStoreId && !source.relatedRecordId) reviewCases.push({ type: 'peer-without-link', recordIds: [source.id] });
    if (!source.relatedRecordId) continue;
    const mate = recordMap.get(source.relatedRecordId);
    if (!mate) { reviewCases.push({ type: 'missing-counterpart', recordIds: [source.id, source.relatedRecordId] }); continue; }
    const pairKey = [source.id, mate.id].sort().join('|');
    if (pairs.has(pairKey)) continue;
    pairs.add(pairKey);
    const differences = [];
    if (mate.relatedRecordId !== source.id) differences.push('reciprocal-link');
    if (source.debtStoreId !== mate.storeId || mate.debtStoreId !== source.storeId || source.storeId === mate.storeId) differences.push('store-links');
    if (Math.abs(Math.abs(source.amount) - Math.abs(mate.amount)) > 0.005) differences.push('amount');
    if (source.accountType !== mate.accountType) differences.push('account');
    if (source.date !== mate.date) differences.push('date');
    if (differences.length) reviewCases.push({ type: 'counterpart-difference', recordIds: [source.id, mate.id], differences });
  }
  const fingerprint = createHash('sha256').update(JSON.stringify([...recordMap.values()].sort((a, b) => a.id.localeCompare(b.id)).map(source => sourceFields.map(field => [field, source[field] ?? null])))).digest('hex');
  return {
    mode: 'offline-plan-only', snapshot, fingerprint, sourceCount: records.length,
    canBuildProjection: blockingIssues.length === 0, canActivate: false,
    blockingIssues, reviewCases, inferredOwnership,
    expectedStores: [...expected.values()], expectedMonths: [...monthly].map(([key, value]) => ({ key, ...value })),
    sourceChanges: [],
  };
}
