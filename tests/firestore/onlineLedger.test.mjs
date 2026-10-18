import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, limit, writeBatch } from 'firebase/firestore';
import { prepareCompatibleLedgerRules } from '../../functions/src/compatibleLedgerRules.mjs';
import { backfillOnlineLedger, verifyOnlineLedger } from '../../functions/src/onlineFinancialLedger.mjs';
import { projectFinancialRecord } from '../../functions/src/financialProjection.mjs';
if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw Error('Local emulator required');
const req=createRequire(new URL('../../functions/package.json',import.meta.url));const{Firestore,FieldPath}=req('@google-cloud/firestore');
const projectId='demo-vestika-online-ledger',db=new Firestore({projectId});
// Requests still use the explicitly local demo database. Only target metadata
// is adapted to exercise the production-only orchestration guard.
const facade={projectId:'factura2-6e811',doc:db.doc.bind(db),collection:db.collection.bind(db),batch:db.batch.bind(db),runTransaction:db.runTransaction.bind(db)};
const options={projectId:'factura2-6e811',companyId:'a',storeId:'s1',documentId:FieldPath.documentId()};
const root='financialLedgerCompanies/a/stores/s1';
const legacy="rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /inventory/{document=**} { allow read: if true; allow write: if request.auth != null; } match /categories/{document=**} { allow read: if true; allow write: if request.auth != null; } match /{document=**} { allow read, write: if request.auth != null; } } }";

test('production-compatible rules and online construction preserve ongoing work',async t=>{
 const env=await initializeTestEnvironment({projectId,firestore:{rules:prepareCompatibleLedgerRules(legacy).source}});
 try{
  await db.doc('companies/a').set({status:'active'});await db.doc('stores/s1').set({companyId:'a'});await db.doc('stores/s2').set({companyId:'a'});await db.doc('stores/foreign').set({companyId:'b'});
  await db.doc('sellers/admin').set({name:'Admin',companyId:'a',storeId:'s1',roleId:'admin',authVersion:1});await db.doc('roles/admin').set({companyId:'a',userType:'admin'});
  const original=new Map();
  for(let start=0;start<1005;start+=400){const batch=db.batch();for(let index=start;index<Math.min(1005,start+400);index++){
   const id='r'+String(index).padStart(4,'0');const row={storeId:'s1',amount:index%2?10:-3,accountType:['cash','qr','addi','sistecredito'][index%4],date:index%2?'2026-08-01T12:00:00-05:00':'2026-07-31T12:00:00-05:00',subCategory:index%3?'Servicios':'Cruce Sedes',description:'Local test',...(index<20?{debtStoreId:'s2',relatedRecordId:'historic-counterpart-'+index,affectsCashBalance:false}:{})};
   batch.set(db.doc('financialRecords/'+id),row);original.set(id,row);
  }await batch.commit();}
  await t.test('paged build processes 1,005 historic sources in bounded batches; rerunning preserves exact totals and all source fields',async()=>{
   const progress=[];const result=await backfillOnlineLedger(facade,{...options,onProgress:value=>progress.push(value)});
   assert.equal(result.processed,1005);assert.equal(result.pages,21);assert.equal(progress.length,21);assert.equal(result.activated,false);
   const first=(await db.doc(root).get()).data();assert.equal(first.ready,false);assert.equal(first.count,1005);
   await backfillOnlineLedger(facade,options);assert.deepEqual((await db.doc(root).get()).data(),first);
   const sources=await db.collection('financialRecords').get();assert.equal(sources.size,1005);for(const source of sources.docs)assert.deepEqual(source.data(),original.get(source.id));
  });
  await t.test('snapshot verification checks full page entries, dates, balances and monthly totals without activating',async()=>{
   const result=await verifyOnlineLedger(facade,options);assert.equal(result.sources,1005);assert.equal(result.entries,2030);assert.equal(result.months,2);assert.equal(result.activated,false);
  });
  await t.test('legacy login/business reads and writes remain usable; derived writes and private state remain denied',async()=>{
   const client=env.authenticatedContext('anonymous',{firebase:{sign_in_provider:'anonymous'}}).firestore();
   await assertSucceeds(getDocs(collection(client,'sellers')));
   const publicClient=env.unauthenticatedContext().firestore();
   await assertSucceeds(getDocs(collection(publicClient,'inventory')));await assertSucceeds(getDocs(collection(publicClient,'categories')));
   await assertFails(getDocs(collection(publicClient,'financialRecords')));
   await assertSucceeds(getDocs(query(collection(client,root+'/accounts/cash/entries'),orderBy('ledgerTime','desc'),limit(50))));
   await assertSucceeds(setDoc(doc(client,'financialRecords/business-write'),{storeId:'s1',amount:5}));await assertSucceeds(deleteDoc(doc(client,'financialRecords/business-write')));
   for(const path of [root,root+'/accounts/cash/entries/r0000',root+'/months/2026-08',root+'/peers/s2/entries/r0000']){
    await assertFails(setDoc(doc(client,path),{companyId:'a',storeId:'s1',ready:true}));await assertFails(updateDoc(doc(client,path),{ready:true}));await assertFails(deleteDoc(doc(client,path)));
   }
   for(const path of ['financialLedgerState/r0000','financialLedgerErrors/r0000']){await assertFails(getDoc(doc(client,path)));await assertFails(setDoc(doc(client,path),{}));}
   await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),root)));
   await assertFails(getDoc(doc(client,'financialLedgerCompanies/b/stores/s1')));
   const batch=writeBatch(client);batch.set(doc(client,'financialRecords/mixed-bypass'),{storeId:'s1'});batch.set(doc(client,root),{ready:true});await assertFails(batch.commit());assert.equal((await db.doc('financialRecords/mixed-bypass').get()).exists,false);
  });
  await t.test('verified tokens cannot use the authenticated catch-all to read a foreign company projection',async()=>{
   await db.doc('financialLedgerCompanies/b/stores/foreign').set({companyId:'b',storeId:'foreign',ready:true});
   const claims={identityVersion:1,sellerId:'admin',companyId:'a',storeId:'s1',roleId:'admin',authVersion:1};
   const client=env.authenticatedContext('custom-user',{...claims,firebase:{sign_in_provider:'custom'}}).firestore();
   await assertSucceeds(getDoc(doc(client,root)));await assertFails(getDoc(doc(client,'financialLedgerCompanies/b/stores/foreign')));
  });
  await t.test('tampered entries fail verification even when aggregate totals still match',async()=>{
   const entry=db.doc(root+'/accounts/cash/entries/r0000'),before=(await entry.get()).data();await entry.update({description:'tampered'});
   await assert.rejects(verifyOnlineLedger(facade,options),/entry mismatch/);await entry.set(before);
  });
  await t.test('a user can save during the audit; a changed projection prevents stale activation',async()=>{
   let changed=false;
   const concurrent={...facade,runTransaction:(callback,config)=>{
    assert.equal(config.readOnly,true);
    return db.runTransaction(async tx=>callback({get:async ref=>{
     const snapshot=await tx.get(ref);
     if(!changed&&ref.path===undefined){changed=true;const write=db.doc('financialRecords/r0000').update({amount:-7});let timer;
      try{await Promise.race([write,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Business write was blocked by the audit')),5000))]);}finally{clearTimeout(timer);}
      await projectFinancialRecord(db,'r0000');
     }
     return snapshot;
    },getAll:(...refs)=>tx.getAll(...refs)}),config);
   }};
   await assert.rejects(verifyOnlineLedger(concurrent,{...options,activate:true,assertDeploymentReady:async()=>true}));assert.equal(changed,true);
   assert.equal((await db.doc('financialRecords/r0000').get()).data().amount,-7);assert.equal((await db.doc(root).get()).data().ready,false);
  });
  await t.test('only a verified, current projection activates; users, passwords and sources are never written by activation',async()=>{
   await assert.rejects(verifyOnlineLedger(facade,{...options,activate:true,assertDeploymentReady:async()=>false}),/not verified/);
   const before=await db.doc('sellers/admin').get();const result=await verifyOnlineLedger(facade,{...options,activate:true,assertDeploymentReady:async()=>true});
   assert.equal(result.activated,true);assert.equal((await db.doc(root).get()).data().ready,true);assert.deepEqual((await db.doc('sellers/admin').get()).data(),before.data());
  });
 }finally{await env.cleanup();await db.terminate();}
});
