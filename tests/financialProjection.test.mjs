import test from 'node:test';
import assert from 'node:assert/strict';
import { projectFinancialRecord, projectFinancialRecords, invalidateFinancialProjection, ledgerRoot, ledgerDay, ledgerTime, emptyLedgerSummary, emptyLedgerMonth, applyLedgerDelta } from '../functions/src/financialProjection.mjs';
function memoryDb() {
  const data = new Map(), versions = new Map(), reads={single:0,batchSizes:[]}; let version = 0;
  const put = (path, value) => { data.set(path, structuredClone(value)); versions.set(path, ++version); };
  const snapshot = ref => ({ exists: data.has(ref.path), data: () => structuredClone(data.get(ref.path)), updateTime: { seconds: 0, nanoseconds: versions.get(ref.path) || 0 } });
  const db = { doc: path => ({ path }), runTransaction: async callback => {
    const writes = []; let writing = false;
    const tx = { get: async ref => { reads.single++; assert.equal(writing, false, 'all reads precede writes'); return snapshot(ref); },
      getAll: async(...refs)=>{reads.batchSizes.push(refs.length);assert.equal(writing,false,'all reads precede writes');return refs.map(snapshot);},
      set: (ref, value) => { writing = true; writes.push(() => put(ref.path, value)); },
      delete: ref => { writing = true; writes.push(() => data.delete(ref.path)); } };
    const result = await callback(tx); for (const write of writes) write(); return result;
  } };
  return { db, data, put, reads };
}
const record = (id, extras = {}) => ({ id, companyId: 'bombon', storeId: 'metro', amount: -100, accountType: 'cash', date: '2026-10-01T23:59:00-05:00', subCategory: 'Servicios', description: 'Factura', ...extras });

test('projection converges on current source under duplicate/out-of-order events, edits across dates/accounts, deletion and restoration', async () => {
  const {db,data,put}=memoryDb();put('stores/metro',{companyId:'bombon'});put('stores/divino',{companyId:'bombon'});
  put('financialRecords/a',record('a',{debtStoreId:'divino'}));await projectFinancialRecord(db,'a');
  const root=ledgerRoot('bombon','metro');assert.equal(data.get(root).accounts.cash,-100);assert.equal(data.get(root).peers.divino.total,-100);
  const revision=data.get(root).revision;await projectFinancialRecord(db,'a');assert.equal(data.get(root).revision,revision);
  put('financialRecords/a',record('a',{debtStoreId:'divino',amount:-250,date:'2026-09-30T23:59:00-05:00',accountType:'qr'}));
  await projectFinancialRecord(db,'a');await projectFinancialRecord(db,'a');
  assert.deepEqual(data.get(root).accounts,{qr:-250});assert.equal(data.get(`${root}/months/2026-10`).count,0);assert.equal(data.get(`${root}/months/2026-09`).count,1);
  assert.equal(data.has(`${root}/accounts/cash/entries/a`),false);assert.equal(data.has(`${root}/accounts/qr/entries/a`),true);
  data.delete('financialRecords/a');await projectFinancialRecord(db,'a');assert.deepEqual(data.get(root).accounts,{});assert.deepEqual(data.get(root).peers,{});assert.equal(data.get(root).count,0);assert.equal(data.has(`${root}/accounts/qr/entries/a`),false);
  put('financialRecords/a',record('a',{amount:0}));await projectFinancialRecord(db,'a');assert.equal(data.get(root).count,1);
});
test('projection keeps company partitions and rejects foreign source/peer ownership with no partial writes', async () => {
  const {db,data,put}=memoryDb();put('stores/metro',{companyId:'bombon'});put('stores/mayla',{companyId:'mayla'});
  put('financialRecords/a',record('a',{companyId:'mayla'}));await assert.rejects(projectFinancialRecord(db,'a'),/company mismatch/);assert.equal(data.has(ledgerRoot('bombon','metro')),false);
  put('financialRecords/a',record('a',{debtStoreId:'mayla'}));await assert.rejects(projectFinancialRecord(db,'a'),/company mismatch/);
  put('financialRecords/a',record('a'));put('financialRecords/b',record('b',{companyId:'mayla',storeId:'mayla',amount:900}));await projectFinancialRecord(db,'a');await projectFinancialRecord(db,'b');
  assert.equal(data.get(ledgerRoot('bombon','metro')).accounts.cash,-100);assert.equal(data.get(ledgerRoot('mayla','mayla')).accounts.cash,900);
});
test('legacy records resolve company from store, cash-excluded crossings still affect debt, and dates use Colombia boundaries', async () => {
  const {db,data,put}=memoryDb();put('stores/metro',{});put('stores/divino',{});
  put('financialRecords/a',record('a',{companyId:undefined,debtStoreId:'divino',affectsCashBalance:false,subCategory:'Cruce Sedes'}));await projectFinancialRecord(db,'a');
  const summary=data.get(ledgerRoot('default_company','metro'));assert.deepEqual(summary.accounts,{});assert.equal(summary.peers.divino.total,100);
  assert.equal(ledgerDay('2026-10-01T02:00:00Z'),'2026-09-30');assert.equal(ledgerDay('2026-10-01T00:00:00'),'2026-10-01');
  assert.equal(ledgerTime('2026-10-01T00:00:00'),ledgerTime('2026-10-01T05:00:00Z'));
});
test('100 stores and 50,000 historical rows keep totals isolated; delta cost is independent of other stores/history', () => {
  const summaries=new Map(),months=new Map();
  for(let store=0;store<100;store++) {
    const id='store-'+store;const summary=emptyLedgerSummary('bombon',id),month=emptyLedgerMonth('bombon',id);
    for(let index=0;index<500;index++)applyLedgerDelta(summary,month,record(String(index),{storeId:id,amount:0.1}),1);
    summaries.set(id,summary);months.set(id,month);
    assert.equal(summary.accounts.cash,50);assert.equal(summary.count,500);
  }
  const own=summaries.get('store-50'),month=months.get('store-50');applyLedgerDelta(own,month,record('x',{storeId:'store-50',amount:0.1}),-1);
  assert.equal(own.accounts.cash,49.9);assert.equal(summaries.get('store-49').accounts.cash,50);
});

test('invalid data revokes a verified balance; correction clears diagnostics but requires reverification',async()=>{
 const {db,data,put}=memoryDb();put('stores/metro',{companyId:'bombon'});
 put('financialRecords/a',record('a'));await projectFinancialRecord(db,'a');
 const root=ledgerRoot('bombon','metro');put(root,{...data.get(root),ready:true});
 put('financialRecords/a',record('a',{companyId:'foreign'}));
 await assert.rejects(projectFinancialRecord(db,'a'),/company mismatch/);
 await invalidateFinancialProjection(db,'a','Financial source company mismatch');
 assert.equal(data.get(root).ready,false);assert.equal(data.has(ledgerRoot('foreign','metro')),false);assert.equal(data.has('financialLedgerErrors/a'),true);
 put('financialRecords/a',record('a',{amount:-250}));await projectFinancialRecord(db,'a');
 assert.equal(data.get(root).accounts.cash,-250);assert.equal(data.get(root).ready,false);assert.equal(data.has('financialLedgerErrors/a'),false);
});


test('online backfill groups 50 rows into one summary revision and retries without duplicating sources',async()=>{
 const {db,data,put,reads}=memoryDb();put('stores/metro',{companyId:'bombon'});put('stores/divino',{companyId:'bombon'});
 const ids=Array.from({length:50},(_,i)=>String(i));for(const id of ids)put('financialRecords/'+id,record(id,{amount:10,debtStoreId:'divino'}));
 const originals=new Map([...data].filter(([path])=>path.startsWith('financialRecords/')).map(([path,value])=>[path,structuredClone(value)]));
 await projectFinancialRecords(db,ids);const root=ledgerRoot('bombon','metro');
 assert.deepEqual(reads.batchSizes,[100]);assert.ok(reads.single<=4,'shared store and summary reads stay bounded');
 assert.equal(data.get(root).revision,1);assert.equal(data.get(root).count,50);assert.equal(data.get(root).accounts.cash,500);
 await projectFinancialRecords(db,ids);assert.equal(data.get(root).revision,1);
 put('financialRecords/0',record('0',{amount:30,debtStoreId:'divino'}));data.delete('financialRecords/1');
 await projectFinancialRecords(db,ids);assert.equal(data.get(root).count,49);assert.equal(data.get(root).accounts.cash,510);
 for(const[path,value]of originals)if(!['financialRecords/0','financialRecords/1'].includes(path))assert.deepEqual(data.get(path),value);
});
test('invalid or oversized backfill batches fail atomically',async()=>{
 const {db,data,put}=memoryDb();put('stores/metro',{companyId:'bombon'});
 put('financialRecords/good',record('good'));put('financialRecords/bad',record('bad',{companyId:'foreign'}));
 await assert.rejects(projectFinancialRecords(db,['good','bad']),/company mismatch/);
 assert.equal([...data.keys()].some(path=>path.startsWith('financialLedger')),false);
 for(const ids of [[],['good','good'],Array.from({length:51},(_,i)=>String(i)),['invalid/id']])await assert.rejects(projectFinancialRecords(db,ids),/Invalid financial projection batch/);
});
