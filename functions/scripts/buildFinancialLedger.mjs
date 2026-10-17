// Run with Firebase Admin ADC. Defaults to read-only; --write projects records,
// --activate additionally verifies current sources transactionally before use.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';
import { isDeepStrictEqual } from 'node:util';
import { projectFinancialRecord, ledgerRoot, ledgerDay, emptyLedgerSummary, emptyLedgerMonth, applyLedgerDelta } from '../src/financialProjection.mjs';
const args = process.argv.slice(2);
const option = name => args[args.indexOf(name) + 1];
if (!args.includes('--project') || !args.includes('--company') || !args.includes('--store')) throw new Error('Required: --project ID --company ID --store ID [--write] [--activate]');
const projectId = option('--project'), companyId = option('--company'), storeId = option('--store');
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const store = await db.doc(`stores/${storeId}`).get();
if (!store.exists || (store.data().companyId || 'default_company') !== companyId) throw new Error('Store/company mismatch');
const base = db.collection('financialRecords').where('storeId', '==', storeId);
let cursor, count = 0;
while (true) {
  const query = (cursor ? base.orderBy(FieldPath.documentId()).startAfter(cursor) : base.orderBy(FieldPath.documentId())).limit(200);
  const page = await query.get();
  if (page.empty) break;
  for (const source of page.docs) {
    if (source.data().companyId && source.data().companyId !== companyId) throw new Error(`Foreign financial record: ${source.id}`);
    ledgerDay(source.data().date);
    if (args.includes('--write')) await projectFinancialRecord(db, source.id);
    count++;
  }
  cursor = page.docs.at(-1);
  process.stdout.write(`Verified/projected ${count} records\n`);
}
if (args.includes('--activate')) {
  if (!args.includes('--write')) throw new Error('--activate requires --write');
  // One-off consistent snapshot: if another writer changes the sources while
  // verifying, Firestore retries. Never activate partially built balances.
  await db.runTransaction(async tx => {
    const sources = await tx.get(base);
    const expected = emptyLedgerSummary(companyId, storeId), months = new Map();
    for (const source of sources.docs) {
      const record = { ...source.data(), id: source.id, companyId };
      const state = await tx.get(db.doc(`financialLedgerState/${source.id}`));
      if (!state.exists || state.data().sourceVersion !== `${source.updateTime.seconds}:${source.updateTime.nanoseconds}`) throw new Error('Projection is catching up; retry the build before activation');
      const key = ledgerDay(record.date).slice(0, 7);
      if (!months.has(key)) months.set(key, emptyLedgerMonth(companyId, storeId));
      applyLedgerDelta(expected, months.get(key), record, 1);
    }
    const rootRef = db.doc(ledgerRoot(companyId, storeId));
    const actual = await tx.get(rootRef);
    for (const key of ['count', 'accounts', 'peers']) if (!isDeepStrictEqual(actual.exists ? actual.data()[key] : expected[key], expected[key])) throw new Error(`Summary mismatch: ${key}`);
    for (const [key, month] of months) {
      const actualMonth = await tx.get(db.doc(`${rootRef.path}/months/${key}`));
      if (!actualMonth.exists || actualMonth.data().count !== month.count || !isDeepStrictEqual(actualMonth.data().categories, month.categories)) throw new Error(`Monthly summary mismatch: ${key}`);
    }
    tx.set(rootRef, { ...(actual.exists ? actual.data() : expected), ready: true, verifiedAt: new Date().toISOString() });
  });
  process.stdout.write('Verified and activated store projection\n');
} else process.stdout.write(args.includes('--write') ? 'Projection built; not activated\n' : 'Dry run completed; no writes\n');
