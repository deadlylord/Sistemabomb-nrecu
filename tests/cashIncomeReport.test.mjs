import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import { buildIncomeChart, isPeriodIncome, completeChartYear, bogotaDateKey } from '../services/incomeChart.ts';
import { sumCashCollections } from '../services/cashCollections.ts';

const PaymentMethod = { Efectivo: 'Efectivo', Bono: 'Bono de Regalo' };
const IncidentType = { RECAUDO: 'Recaudo', CASH_ADJUSTMENT: 'Ajuste de Caja', PRODUCT_EXCHANGE: 'Cambio de Producto', ADDITIONAL_INCOME: 'Ingreso Adicional' };
const IncidentStatus = { PENDIENTE_APROBACION: 'Pendiente de Aprobación' };
const day = '2026-10-14T18:00:00Z';
const isWithinRange = date => date.startsWith('2026-10-14');
async function calculation(file, startMarker, endMarker, names) {
  const source = await readFile(file, 'utf8');
  const start = source.indexOf(startMarker) + startMarker.length;
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= startMarker.length && end > start, 'actual report calculation is present');
  const code = `export default function(scope) { const {${names.join(',')}} = scope; ${source.slice(start, end)} }`;
  const result = await transform(code, { loader: 'ts', format: 'esm' });
  return (await import('data:text/javascript;base64,' + Buffer.from(result.code).toString('base64'))).default;
}
const ledger = await calculation('components/DashboardView.tsx', '  const loadedPaymentLedger = useMemo(() => {', '  }, [sales, layaways', ['sales','layaways','allIncidents','currentStore','PaymentMethod','IncidentType','IncidentStatus']);
const report = await calculation('components/DashboardView.tsx', '  const detailedReportData = useMemo(() => {', '  }, [loadedPaymentLedger', ['loadedPaymentLedger','isWithinRange','COMMISSION_RATES','paymentMethodFilter','isPeriodIncome']);
const dashboard = scope => report({...scope, loadedPaymentLedger:ledger(scope)});
const chart = await calculation('components/DashboardView.tsx', '  const salesChartData = useMemo(() => {', '  }, [sales, layaways', ['chartMetric','chartViewMode','detailedReportData','loadedPaymentLedger','chartYear','buildIncomeChart','completeChartYear','bogotaDateKey','sales','layaways']);
const cash = await calculation('components/DashboardView.tsx', '  const cashBreakdown = useMemo(() => {', '  }, [sales, layaways', ['inventory','currentStore','sales','layaways','allIncidents','isWithinRange','PaymentMethod','IncidentType','IncidentStatus','sumCashCollections']);
const metrics = await calculation('components/DashboardView.tsx', '    const metricsForCurrentStore = useMemo(() => {', '    }, [sales, layaways', ['sales','layaways','inventory','expenses','allIncidents','currentStore','isWithinRange','PaymentMethod','IncidentType','IncidentStatus','COMMISSION_RATES']);
const daily = await calculation('components/DailySalesReportModal.tsx', '  const reportData = useMemo(() => {', '  }, [sales, layaways', ['sales','layaways','sellers','incidents','isWithinDay','storeId','PaymentMethod','IncidentType','IncidentStatus','sumCashCollections']);
function scope(incidents = []) {
  const payment = {date: day, amount: 20000, method: 'Efectivo', seller: 'Ana'};
  const order = {id:'l1',storeId:'store',seller:'Ana',createdAt:day,status:'active',totalAmount:100000,items:[],payments:[payment]};
  return { sales: [{...order,id:'s1',layawayId:'l1'}], layaways:[order], allIncidents:incidents, incidents, currentStore:{id:'store'},storeId:'store',inventory:[],expenses:[],sellers:[{name:'Ana'}], isWithinRange,isWithinDay:isWithinRange,PaymentMethod,IncidentType,IncidentStatus,COMMISSION_RATES:{},paymentMethodFilter:[],sumCashCollections,isPeriodIncome };
}
const collection = overrides => ({ id:'r1',type:'Recaudo',status:'Resuelto',storeId:'store',createdAt:day,adjustmentAmount:40000,sellerName:'Ana',description:'Recaudo cliente',...overrides });
test('actual income ledger counts only 20,000 on a 100,000 layaway, without duplicating its linked sale', () => {
  const report = dashboard(scope());
  for (const mode of ['daily','monthly']) assert.equal(buildIncomeChart(report.allPayments,mode).reduce((sum,p)=>sum+p.total,0),20000);
});
test('40,000 cash collection plus 20,000 abono reconciles across dashboard, chart and seller daily report with empty inventory', () => {
  const input = scope([collection({})]);
  const report = dashboard(input);
  const income = Object.entries(report.totalsByMethod).filter(([method])=>isPeriodIncome(method)).reduce((sum,[,amount])=>sum+amount,0);
  assert.equal(income,60000);
  assert.equal(buildIncomeChart(report.allPayments,'daily')[0].total,60000);
  assert.equal(cash(input).netTotal,60000);
  const seller = daily(input).grandTotals;
  assert.equal(seller.totalCashCollections,40000);
  assert.equal(seller.totalCashSales+seller.totalCashLayaways+seller.totalCashCollections+seller.incomeAdjustments-seller.expenseAdjustments,60000);
});
test('explicit QR collections enter income but cannot increase physical cash', () => {
  const input = scope([collection({paymentMethod:'QR'})]);
  assert.equal(buildIncomeChart(dashboard(input).allPayments,'daily')[0].total,60000);
  assert.equal(cash(input).netTotal,20000);
  assert.equal(daily(input).grandTotals.totalCashCollections,0);
});
test('pending, another store and another day collections cannot affect cash or current income', () => {
  const input = scope([collection({status:'Pendiente de Aprobación'}),collection({storeId:'other'}),collection({createdAt:'2026-10-13T18:00:00Z'})]);
  assert.equal(cash(input).netTotal,20000);
  assert.equal(daily(input).grandTotals.totalCashCollections,0);
  assert.equal(buildIncomeChart(dashboard(input).allPayments,'daily')[0].total,20000);
});

test('external collection increases received money but not store sales or profit', () => {
  const before=metrics(scope());
  const after=metrics(scope([collection({})]));
  assert.equal(before.salesCollected,20000);
  assert.equal(after.salesCollected,20000);
  assert.equal(after.totalProfit,before.totalProfit);
  assert.equal(after.netProfit,before.netProfit);
});

test('later abono is assigned by payment date, not garment price or original reservation date', () => {
  const input=scope();
  input.layaways[0].createdAt='2026-09-01T18:00:00Z';
  input.layaways[0].payments.push({date:'2026-09-01T18:00:00Z',amount:30000,method:'Efectivo',seller:'Ana'});
  assert.equal(buildIncomeChart(dashboard(input).allPayments,'daily')[0].total,20000);
});

test('monthly chart shows 12 complete months of the chosen year, ignoring period dates', () => {
  const input = scope([collection({})]);
  input.layaways[0].payments.push({date:'2026-01-01T18:00:00Z',amount:30000,method:'Efectivo',seller:'Ana'});
  input.layaways[0].payments.push({date:'2025-10-14T18:00:00Z',amount:7000,method:'Efectivo',seller:'Ana'});
  const detailedReportData=dashboard(input);
  const points=chart({...input,chartMetric:'income',chartViewMode:'monthly',chartYear:2026,loadedPaymentLedger:ledger(input),detailedReportData,buildIncomeChart,completeChartYear,bogotaDateKey});
  assert.equal(points.length,12);
  assert.equal(points[0].label,'2026-01');
  assert.equal(points[0].total,30000);
  assert.equal(points[9].total,60000);
  assert.equal(points[11].label,'2026-12');
  assert.equal(points[11].total,0);
  assert.equal(points.reduce((sum,point)=>sum+point.total,0),90000);
  assert.equal(buildIncomeChart(detailedReportData.allPayments,'daily')[0].total,60000);
});
