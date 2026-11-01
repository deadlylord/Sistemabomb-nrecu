import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build,transform} from 'esbuild';
const src=await readFile('components/FinancialReconciliationView.tsx','utf8');
const code=(await transform(src.slice(src.indexOf('  const dailySystemTotals ='),src.indexOf('  const hasMismatches =')),{loader:'ts'})).code;
const bundled=await build({stdin:{contents:"export {PaymentMethod,IncidentType} from './types'",loader:'ts',resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const types=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
function calculate({method='Sistecredito',commission=0,storeId='a1',date='2026-10-02T15:00:00.000Z'}={}){
 const scope={...types,useMemo:fn=>fn(),selectedYear:2026,selectedMonth:9,activeStoreId:'a1',activeStore:{paymentCommissions:{[method]:commission}},stores:[],layaways:[],formatCOP:String,getLocalDateString:date=>new Date(date).toLocaleDateString('en-CA',{timeZone:'America/Bogota'}),
 sales:[{id:'sale',storeId:'a1',customerName:'Test',totalAmount:365000,payments:[{amount:310000,method,date:'2026-10-01T15:00:00.000Z',seller:'Test'}]}],
 incidents:[{id:'exchange',storeId,type:types.IncidentType.PRODUCT_EXCHANGE,adjustmentAmount:55000,paymentMethod:method,createdAt:date,sellerName:'Test',customerName:'Test'}]};
 return new Function('scope',`with(scope){${code};return dailySystemTotals;}`)(scope);
}
for(const [method,key]of [['Sistecredito','sistecredito'],['Addi','addi'],['Efectivo','cash'],['QR','qr']])test(`exchange surplus is counted once in ${method} on its own date`,()=>{
 const rows=calculate({method});assert.equal(rows.find(r=>r.date==='2026-10-01')[key],310000);const exchange=rows.find(r=>r.date==='2026-10-02');assert.equal(exchange[key],55000);assert.equal(exchange.transactions[key].length,1);assert.equal(rows.reduce((sum,r)=>sum+r[key],0),365000);
});
test('exchange applies configured Sistecredito commission just like original payments',()=>{
 const rows=calculate({commission:.1});assert.equal(rows.find(r=>r.date==='2026-10-02').sistecredito,49500);assert.equal(rows.reduce((sum,r)=>sum+r.sistecredito,0),328500);
});
test('other stores and other months cannot add this surplus',()=>{
 for(const options of [{storeId:'a2'},{date:'2026-09-02T15:00:00.000Z'}]){const rows=calculate(options);assert.equal(rows.reduce((sum,r)=>sum+r.sistecredito,0),310000);}
});
