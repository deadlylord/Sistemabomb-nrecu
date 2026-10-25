import test from 'node:test';import assert from 'node:assert/strict';
import {prepareCompatibleBusinessRules} from '../functions/src/compatibleBusinessRules.mjs';
import {prepareCompatibleLedgerRules} from '../functions/src/compatibleLedgerRules.mjs';
import {productionBusinessValue,projectBusinessBatch} from '../functions/src/onlineBusinessSummary.mjs';
const legacy="rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /inventory/{document=**} { allow read: if true; allow write: if request.auth != null; } match /categories/{document=**} { allow read: if true; allow write: if request.auth != null; } match /{document=**} { allow read, write: if request.auth != null; } } }";
test('business rule patch accepts only reviewed ledger policy and preserves public catalog while excluding derived writes',()=>{
 const original=prepareCompatibleLedgerRules(legacy).source,result=prepareCompatibleBusinessRules(original);
 assert.match(result.source,/match \/inventory\/\{document=\*\*\} \{ allow read: if true;/);
 assert.match(result.source,/match \/categories\/\{document=\*\*\} \{ allow read: if true;/);
 assert.match(result.source,/'businessSummaryCompanies', 'businessSummaryState', 'businessSummaryErrors'/);
 assert.equal(prepareCompatibleBusinessRules(result.source).hash,result.hash);
 assert.throws(()=>prepareCompatibleBusinessRules(original.replace('request.auth != null','true')),/Unknown/);
});
test('ordinary old sales index later payment months without copying amounts or indexing converted layaway sales',()=>{
 const data={createdAt:'2026-01-01T12:00:00Z',payments:[{date:'2026-01-02T12:00:00Z',amount:10,method:'Efectivo'},{date:'2026-10-01T12:00:00Z',amount:20,method:'QR'}],totalAmount:30,items:[]};
 assert.deepEqual(productionBusinessValue('sales',data).paymentMonths,['2026-10']);
 assert.deepEqual(productionBusinessValue('sales',{...data,layawayId:'converted'}).paymentMonths,[]);
});
test('invalid or oversized batches stop before opening a transaction',async()=>{
 const db={runTransaction:()=>{throw Error('unexpected transaction')}};
 for(const values of [[],Array.from({length:51},(_,i)=>({kind:'sales',id:'s'+i})),[{kind:'sellers',id:'u'}],[{kind:'sales',id:'bad/path'}],[{kind:'sales',id:'s'},{kind:'sales',id:'s'}]])await assert.rejects(projectBusinessBatch(db,values),/Invalid/);
});

test('recurring expense templates carry no dated income or expense contribution and remain unchanged',()=>{
 const template={date:'TEMPLATE',storeId:'s',amount:50000,description:'Recurring'};const before=structuredClone(template);
 assert.deepEqual(productionBusinessValue('expenses',template),{days:{},inventoryValue:0,inventoryUnits:0,invoiceDays:[],paymentMonths:[]});assert.deepEqual(template,before);
});

test('production chart matches browser Colombia dates for date-only strings and indexes old gift payments too',()=>{
 const data={createdAt:'2026-01-02',items:[],payments:[{date:'2026-10-01',amount:10,method:'Efectivo'},{date:'2026-11-02',amount:20,method:'Bono de Regalo'}]};
 const value=productionBusinessValue('sales',data);assert.equal(value.days['2026-09-30'].income,10);assert.equal(value.days['2026-11-01'].income,0);assert.deepEqual(value.paymentMonths,['2026-09','2026-11']);assert.equal(data.payments[0].date,'2026-10-01');
});

test('monthly coverage includes creation dates whose legacy timezone format falls outside the ISO query range',()=>{
 const data={createdAt:'2026-10-01T03:00:00',payments:[],items:[],totalAmount:10};
 assert.deepEqual(productionBusinessValue('sales',data).paymentMonths,['2026-10']);
 assert.deepEqual(productionBusinessValue('sales',{...data,layawayId:'converted'}).paymentMonths,['2026-10']);
});
