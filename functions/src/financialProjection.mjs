// Pure aggregation shared by the projector, backfill verification and tests.
export const LEDGER_SCHEMA = 1;
export const ledgerRoot = (companyId, storeId) => `financialLedgerCompanies/${companyId}/stores/${storeId}`;
export function ledgerDay(date) {
  if (typeof date !== 'string' || !date || !Number.isFinite(new Date(date).getTime())) throw new Error('Invalid financial date');
  if (/^\d{4}-\d\d-\d\d(?:T\d\d:\d\d(?::\d\d(?:\.\d+)?)?)?$/.test(date)) return date.slice(0, 10);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(date));
  const part = key => parts.find(p => p.type === key).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function ledgerTime(date) {
  return new Date(/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?$/.test(date) ? `${date}-05:00` : date.length === 10 ? `${date}T00:00:00-05:00` : date).getTime();
}
export const interStoreImpact = record => {
  const cat = (record.subCategory || '').toLowerCase();
  return (cat.startsWith('cruce') || cat.includes('préstamo')) ? -record.amount : record.amount;
};
export const emptyLedgerSummary = (companyId, storeId) => ({ companyId, storeId, schemaVersion: LEDGER_SCHEMA, ready: false, accounts: {}, peers: {}, count: 0 });
export const emptyLedgerMonth = (companyId, storeId) => ({ companyId, storeId, schemaVersion: LEDGER_SCHEMA, categories: {}, count: 0 });
const money = amount => Math.round(amount * 100) / 100;
const add = (object, key, amount) => { object[key] = money((object[key] || 0) + amount); if (Math.abs(object[key]) < 1e-8) delete object[key]; };
export function applyLedgerDelta(summary, month, record, sign) {
  if (!Number.isFinite(record.amount) || !['cash', 'qr', 'addi', 'sistecredito'].includes(record.accountType)) throw new Error('Invalid financial amount/account');
  const account = record.accountType, amount = record.amount * sign;
  summary.count += sign; month.count += sign;
  if (record.affectsCashBalance !== false) add(summary.accounts, account, amount);
  if (record.debtStoreId) {
    const key = record.debtStoreId;
    const peer = summary.peers[key] ||= { total: 0, cash: 0, qr: 0, count: 0 };
    const impact = interStoreImpact(record) * sign;
    peer.total = money(peer.total + impact); peer.count += sign;
    if (account === 'cash') peer.cash = money(peer.cash + impact);
    if (account === 'qr' || account === 'addi') peer.qr = money(peer.qr + impact);
    if (peer.count === 0) delete summary.peers[key];
  }
  if (record.subCategory !== 'Cruce Sedes' && record.amount !== 0) {
    const key = encodeURIComponent((record.subCategory || 'Sin Categoría').trim().toUpperCase());
    const category = month.categories[key] ||= { name: (record.subCategory || 'Sin Categoría').trim().toUpperCase(), income: 0, expense: 0, incomeAccounts: {}, expenseAccounts: {} };
    const kind = record.amount > 0 ? 'income' : 'expense';
    category[kind] = money(category[kind] + Math.abs(record.amount) * sign);
    add(category[`${kind}Accounts`], account, Math.abs(record.amount) * sign);
    if (Math.abs(category.income) < 1e-8 && Math.abs(category.expense) < 1e-8) delete month.categories[key];
  }
}
export function projectionLocations(record) {
  if (!record) return [];
  const root = ledgerRoot(record.companyId, record.storeId);
  const month = ledgerDay(record.date).slice(0, 7);
  const id = record.id;
  return [`${root}/accounts/${record.accountType}/entries/${id}`, `${root}/months/${month}/entries/${id}`,
    ...(record.debtStoreId ? [`${root}/peers/${record.debtStoreId}/entries/${id}`] : [])];
}

// Read the current source INSIDE the transaction, rather than trusting trigger
// ordering. Duplicate or out-of-order events converge to the current document.
export async function projectFinancialRecord(db, id) {
  const sourceRef = db.doc(`financialRecords/${id}`), stateRef = db.doc(`financialLedgerState/${id}`);
  return db.runTransaction(async tx => {
    const [source, state] = await Promise.all([tx.get(sourceRef), tx.get(stateRef)]);
    const before = state.exists ? state.data().record : null;
    let after = source.exists ? { ...source.data(), id } : null;
    if (after) {
      const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 128 && !value.includes('/');
      if (!validId(after.storeId)) throw new Error('Financial source store invalid');
      const store = await tx.get(db.doc(`stores/${after.storeId}`));
      if (!store.exists) throw new Error('Financial source store missing');
      const companyId = store.data().companyId || 'default_company';
      if (!validId(companyId)) throw new Error('Financial source company invalid');
      if (after.companyId && after.companyId !== companyId) throw new Error('Financial source company mismatch');
      after.companyId = companyId;
      if (after.debtStoreId) {
        if (!validId(after.debtStoreId)) throw new Error('Financial peer store invalid');
        const peer = await tx.get(db.doc(`stores/${after.debtStoreId}`));
        if (!peer.exists || (peer.data().companyId || 'default_company') !== companyId || after.debtStoreId === after.storeId) throw new Error('Financial peer company mismatch');
      }
      ledgerDay(after.date);
    }
    const sourceVersion = source.exists ? `${source.updateTime.seconds}:${source.updateTime.nanoseconds}` : null;
    if (state.exists && state.data().sourceVersion === sourceVersion) return;
    const summaryPaths = [...new Set([before, after].filter(Boolean).map(r => ledgerRoot(r.companyId, r.storeId)))];
    const monthPaths = [...new Set([before, after].filter(Boolean).map(r => `${ledgerRoot(r.companyId, r.storeId)}/months/${ledgerDay(r.date).slice(0, 7)}`))];
    const values = new Map();
    for (const path of [...summaryPaths, ...monthPaths]) {
      const snap = await tx.get(db.doc(path));
      const owner = [before, after].find(r => r && (path === ledgerRoot(r.companyId, r.storeId) || path.startsWith(`${ledgerRoot(r.companyId, r.storeId)}/`)));
      values.set(path, snap.exists ? snap.data() : summaryPaths.includes(path) ? emptyLedgerSummary(owner.companyId, owner.storeId) : emptyLedgerMonth(owner.companyId, owner.storeId));
    }
    for (const [record, sign] of [[before, -1], [after, 1]]) if (record) {
      const root = ledgerRoot(record.companyId, record.storeId);
      applyLedgerDelta(values.get(root), values.get(`${root}/months/${ledgerDay(record.date).slice(0, 7)}`), record, sign);
    }
    for (const [path, value] of values) tx.set(db.doc(path), { ...value, revision: (value.revision || 0) + 1 });
    const afterPaths = new Set(projectionLocations(after));
    for (const path of projectionLocations(before)) if (!afterPaths.has(path)) tx.delete(db.doc(path));
    if (after) for (const path of afterPaths) tx.set(db.doc(path), { ...after, ledgerTime: ledgerTime(after.date), balanceAmount: after.affectsCashBalance === false ? 0 : after.amount });
    tx.set(stateRef, { sourceVersion, record: after });
    tx.delete(db.doc(`financialLedgerErrors/${id}`));
  });
}

// A permanently invalid source must never leave a previously verified balance
// advertised as current. Resolve affected roots through trusted store/state
// documents, rather than trusting a client's companyId.
export async function invalidateFinancialProjection(db, id, reason) {
  await db.runTransaction(async tx => {
    const [source, state] = await Promise.all([tx.get(db.doc(`financialRecords/${id}`)), tx.get(db.doc(`financialLedgerState/${id}`))]);
    const roots = new Set();
    const before = state.exists ? state.data().record : null;
    if (before) roots.add(ledgerRoot(before.companyId, before.storeId));
    const storeId = source.exists ? source.data().storeId : null;
    if (typeof storeId === 'string' && storeId && !storeId.includes('/')) {
      const store = await tx.get(db.doc(`stores/${storeId}`));
      if (store.exists) roots.add(ledgerRoot(store.data().companyId || 'default_company', storeId));
    }
    const summaries = [];
    for (const path of roots) summaries.push([path, await tx.get(db.doc(path))]);
    for (const [path, snapshot] of summaries) if (snapshot.exists) tx.set(db.doc(path), { ...snapshot.data(), ready: false, invalidatedAt: new Date().toISOString() });
    tx.set(db.doc(`financialLedgerErrors/${id}`), { reason, at: new Date().toISOString() });
  });
}
