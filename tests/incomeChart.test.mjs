import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIncomeChart, bogotaDateKey, isPeriodIncome } from '../services/incomeChart.ts';

const payments = [
  { date: '2026-10-01T04:30:00Z', amount: 10000, paymentMethod: 'Efectivo' },
  { date: '2026-10-01T05:30:00Z', amount: 20000, paymentMethod: 'QR' },
  { date: '2026-10-05T18:00:00Z', amount: 15000, paymentMethod: 'Efectivo' },
  { date: '2026-10-06T18:00:00Z', amount: 5000, paymentMethod: 'QR' },
  { date: '2026-10-07T18:00:00Z', amount: 8000, paymentMethod: 'Bono de Regalo' },
  { date: '2026-10-07T18:00:00Z', amount: 9000, paymentMethod: 'Recaudo Sistecredito' },
];

test('daily and monthly bars reconcile to period income from the same ledger, including abonos and exchange income', () => {
  for (const mode of ['daily', 'monthly', 'all-months']) {
    const points = buildIncomeChart(payments, mode);
    assert.equal(points.reduce((sum, point) => sum + point.total, 0), 50000);
    assert.equal(points.reduce((sum, point) => sum + point.total, 0), payments.filter(p => isPeriodIncome(p.paymentMethod)).reduce((sum, p) => sum + p.amount, 0));
  }
  assert.deepEqual(buildIncomeChart(payments, 'monthly').map(p => [p.label, p.total]), [['2026-09', 10000], ['2026-10', 40000]]);
});

test('Bogotá midnight determines the day and month, independently of device timezone', () => {
  assert.equal(bogotaDateKey('2026-10-01T04:59:59Z'), '2026-09-30');
  assert.equal(bogotaDateKey('2026-10-01T05:00:00Z'), '2026-10-01');
  assert.equal(buildIncomeChart(payments, 'daily')[0].label, '2026-09-30');
});

test('empty data and excluded methods cannot create phantom income', () => {
  assert.deepEqual(buildIncomeChart([], 'daily'), []);
  assert.deepEqual(buildIncomeChart(payments.slice(-2), 'monthly'), []);
});
