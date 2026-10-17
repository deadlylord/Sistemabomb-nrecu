import test from 'node:test';
import assert from 'node:assert/strict';
import { planFinancialMigration } from '../functions/src/financialMigrationPlan.mjs';
const snapshot = { complete: true, readTime: '2026-10-17T03:35:57.841Z' };
const stores = [{ id: 'a1', companyId: 'a' }, { id: 'a2', companyId: 'a' }, { id: 'b1', companyId: 'b' }];
const row = changes => ({ id: 'r1', storeId: 'a1', date: '2026-03-25T19:07:00', amount: -100, accountType: 'cash', subCategory: 'Cruce Sedes', debtStoreId: 'a2', relatedRecordId: 'r2', ...changes });
const pair = () => [row({}), row({ id: 'r2', storeId: 'a2', debtStoreId: 'a1', relatedRecordId: 'r1', amount: 100, date: '2026-03-27T19:07:00' })];
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
test('historic dates and balances survive different-day counterparts without changing sources', () => {
  const input = freeze({ stores: structuredClone(stores), records: pair(), snapshot: { ...snapshot } });
  const before = JSON.stringify(input), plan = planFinancialMigration(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(plan.canBuildProjection, true); assert.equal(plan.canActivate, false);
  assert.deepEqual(plan.sourceChanges, []);
  assert.deepEqual(plan.reviewCases, [{ type: 'counterpart-difference', recordIds: ['r1', 'r2'], differences: ['date'] }]);
  assert.equal(plan.expectedStores.find(s => s.storeId === 'a1').accounts.cash, -100);
  assert.equal(plan.expectedStores.find(s => s.storeId === 'a2').accounts.cash, 100);
  assert.equal(plan.inferredOwnership.length, 2);
});
test('different month dates retain their own month, rather than forcing the counterpart date', () => {
  const records = pair(); records[1].date = '2026-04-02T19:07:00';
  const plan = planFinancialMigration({ stores, records, snapshot });
  assert.deepEqual(plan.expectedMonths.map(m => m.key), ['a1/2026-03', 'a2/2026-04']);
});
test('a missing counterpart stays an exception and does not invent a balancing movement', () => {
  const records = [row({})], plan = planFinancialMigration({ stores, records, snapshot });
  assert.equal(plan.canBuildProjection, true); assert.equal(plan.sourceCount, 1);
  assert.deepEqual(plan.reviewCases, [{ type: 'missing-counterpart', recordIds: ['r1', 'r2'] }]);
  assert.equal(plan.expectedStores.find(s => s.storeId === 'a1').accounts.cash, -100);
  assert.deepEqual(plan.expectedStores.find(s => s.storeId === 'a2').accounts, {});
});
test('cross-company ownership, foreign peers and invalid money block construction', () => {
  for (const record of [row({ companyId: 'b' }), row({ debtStoreId: 'b1' }), row({ storeId: 'gone' }), row({ amount: '100' }), row({ date: 'invalid' }), row({ accountType: 'foreign' })]) {
    const plan = planFinancialMigration({ stores, records: [record], snapshot });
    assert.equal(plan.canBuildProjection, false); assert.equal(plan.canActivate, false);
    assert.equal(plan.blockingIssues.length, 1);
  }
});
test('incomplete snapshots and duplicate IDs are rejected as migration input', () => {
  assert.throws(() => planFinancialMigration({ stores, records: [], snapshot: { ...snapshot, complete: false } }), /complete/);
  const plan = planFinancialMigration({ stores, records: [row({}), row({})], snapshot });
  assert.equal(plan.canBuildProjection, false);
});
test('account exclusions, cash and QR remain separate; fingerprints detect economic changes', () => {
  const records = [row({ affectsCashBalance: false }), row({ id: 'qr', amount: 75, accountType: 'qr', debtStoreId: undefined, relatedRecordId: undefined })];
  const plan = planFinancialMigration({ stores, records, snapshot });
  const own = plan.expectedStores.find(s => s.storeId === 'a1');
  assert.deepEqual(own.accounts, { qr: 75 }); assert.equal(own.peers.a2.total, 100);
  assert.equal(plan.fingerprint, planFinancialMigration({ stores, records: [...records].reverse(), snapshot }).fingerprint);
  assert.notEqual(plan.fingerprint, planFinancialMigration({ stores, records: records.map(r => ({ ...r, amount: r.amount + 1 })), snapshot }).fingerprint);
});
