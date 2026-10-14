import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIncomeChart, bogotaDateKey, isPeriodIncome, completeChartYear, estimateMonthClose } from '../services/incomeChart.ts';

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
    assert.equal(points.reduce((sum, point) => sum + point.total, 0), 59000);
    assert.equal(points.reduce((sum, point) => sum + point.total, 0), payments.filter(p => isPeriodIncome(p.paymentMethod)).reduce((sum, p) => sum + p.amount, 0));
  }
  assert.deepEqual(buildIncomeChart(payments, 'monthly').map(p => [p.label, p.total]), [['2026-09', 10000], ['2026-10', 49000]]);
});

test('Bogotá midnight determines the day and month, independently of device timezone', () => {
  assert.equal(bogotaDateKey('2026-10-01T04:59:59Z'), '2026-09-30');
  assert.equal(bogotaDateKey('2026-10-01T05:00:00Z'), '2026-10-01');
  assert.equal(buildIncomeChart(payments, 'daily')[0].label, '2026-09-30');
});

test('empty data and excluded methods cannot create phantom income', () => {
  assert.deepEqual(buildIncomeChart([], 'daily'), []);
  assert.deepEqual(buildIncomeChart(payments.slice(-2,-1), 'monthly'), []);
});

test('year chart fills empty months, excludes other years and keeps complete peso amounts', () => {
  const points=completeChartYear([{label:'2026-02',total:1234567,partialTotal:234567},{label:'2025-02',total:900,partialTotal:900}],2026);
  assert.equal(points.length,12);
  assert.equal(points[1].total,1234567);
  assert.equal(points[1].partialTotal,234567);
  assert.equal(points[0].total,0);
  assert.equal(points[11].label,'2026-12');
});

test('monthly comparison counts only paid money through the same Bogotá day in every month', () => {
  const rows = [
    {date:'2026-09-01T18:00:00Z',amount:10000,paymentMethod:'Efectivo'},
    {date:'2026-09-14T23:00:00Z',amount:20000,paymentMethod:'Efectivo'},
    {date:'2026-09-15T04:59:59Z',amount:5000,paymentMethod:'QR'},
    {date:'2026-09-15T05:00:00Z',amount:90000,paymentMethod:'Efectivo'},
    {date:'2026-10-14T18:00:00Z',amount:40000,paymentMethod:'Recaudo Sistecredito'},
    {date:'2026-10-14T18:00:00Z',amount:50000,paymentMethod:'Bono de Regalo'},
  ];
  const points=buildIncomeChart(rows,'monthly',new Date('2026-10-14T21:00:00Z'));
  assert.deepEqual(points,[{label:'2026-09',total:125000,partialTotal:35000},{label:'2026-10',total:40000,partialTotal:40000}]);
  assert.equal(completeChartYear(points,2026)[8].partialTotal,35000);
});

test('same-day comparison includes all available days in shorter months', () => {
  const points=buildIncomeChart([{date:'2026-02-28T18:00:00Z',amount:123456,paymentMethod:'Efectivo'}],'monthly',new Date('2026-03-31T18:00:00Z'));
  assert.equal(points[0].total,123456);
  assert.equal(points[0].partialTotal,123456);
});

test('month close estimate uses actual cash through the comparable day and correct month length', () => {
  const today=new Date('2026-10-14T21:00:00Z');
  assert.equal(estimateMonthClose({label:'2026-10',total:999999,partialTotal:140000},today),310000);
  assert.equal(estimateMonthClose({label:'2026-09',total:999999,partialTotal:140000},today),300000);
  assert.equal(estimateMonthClose({label:'2026-11',total:0,partialTotal:0},today),null);
  assert.equal(estimateMonthClose({label:'2026-10',total:0,partialTotal:0},today),0);
});

test('estimate handles short months and leap years without overstating comparable days', () => {
  assert.equal(estimateMonthClose({label:'2026-02',total:280000,partialTotal:280000},new Date('2026-03-31T18:00:00Z')),280000);
  assert.equal(estimateMonthClose({label:'2024-02',total:290000,partialTotal:140000},new Date('2026-10-14T18:00:00Z')),290000);
});
