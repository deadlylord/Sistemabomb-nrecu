import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareCompatibleLedgerRules } from '../functions/src/compatibleLedgerRules.mjs';
import { projectionOnlyDb, projectionWritePath, legacyLedgerBalances, backfillOnlineLedger, verifyOnlineLedger } from '../functions/src/onlineFinancialLedger.mjs';
const legacy="rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if request.auth != null; } } }";

test('a rules patch is bound to the exact known legacy policy; unknown restrictions are never overwritten',()=>{
 const result=prepareCompatibleLedgerRules(legacy);
 assert.match(result.source,/financialLedgerCompanies/);assert.equal(result.hash.length,64);assert.notEqual(result.hash,result.previousHash);
 for(const source of [legacy.replace('!= null','== null'),legacy.replace('read, write','read'),legacy.replace('request.auth != null',"request.auth.token.companyId == 'a'"),legacy.replace('} } }',"} match /custom/{id} {allow read: if true;} } }")])assert.throws(()=>prepareCompatibleLedgerRules(source),/Unknown production rules/);
});
test('projection writer blocks every source/identity/audit write before committing',async()=>{
 const writes=[];const raw={projectId:'factura2-6e811',doc:path=>({path}),runTransaction:async cb=>cb({set:ref=>writes.push(ref.path),delete:ref=>writes.push(ref.path)})};
 const db=projectionOnlyDb(raw);
 for(const path of ['financialRecords/a','financialRecordsHistory/a','sellers/a','stores/a','companies/a','authCredentials/a']){
  assert.equal(projectionWritePath(path),false);
  await assert.rejects(db.runTransaction(tx=>tx.set(db.doc(path),{})),/Source writes are forbidden/);
 }
 assert.deepEqual(writes,[]);
 await db.runTransaction(tx=>tx.set(db.doc('financialLedgerCompanies/a/stores/s/accounts/cash/entries/id'),{}));assert.equal(writes.length,1);
});
test('production target and activation deployment checks fail before any database call',async()=>{
 const db={projectId:'wrong'};const options={projectId:'factura2-6e811',companyId:'a',storeId:'s'};
 await assert.rejects(backfillOnlineLedger(db,options),/Explicit production/);
 await assert.rejects(verifyOnlineLedger(db,options),/Explicit production/);
 await assert.rejects(verifyOnlineLedger({projectId:'factura2-6e811'},{...options,activate:true}),/Deployment verification/);
 await assert.rejects(verifyOnlineLedger({projectId:'factura2-6e811'},{...options,storeId:'foreign/invalid'}),/Explicit production/);
});
test('independent legacy balances preserve cash exclusions, Addi/QR debts and opposite historic dates',()=>{
 const result=legacyLedgerBalances([
  {accountType:'cash',amount:100}, {accountType:'cash',amount:-20,affectsCashBalance:false,debtStoreId:'peer',subCategory:'Cruce Sedes',date:'2026-08-01'},
  {accountType:'addi',amount:30,debtStoreId:'peer',subCategory:'Préstamo a sede',date:'2026-07-31'},
  {accountType:'qr',amount:40,debtStoreId:'peer',subCategory:'Gasto por otra sede'},
  {accountType:'sistecredito',amount:-5}
 ]);
 assert.deepEqual(result,{accounts:{cash:100,addi:30,qr:40,sistecredito:-5},peers:{peer:{total:30,cash:20,qr:10,count:3}}});
});
