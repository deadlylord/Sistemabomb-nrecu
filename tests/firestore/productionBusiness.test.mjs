import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {readFile} from 'node:fs/promises';
import {projectBusinessBatch,buildBusinessStore,verifyBusinessStore} from '../../functions/src/onlineBusinessSummary.mjs';
import {businessRoot} from '../../functions/src/businessSummary.mjs';
if(!/^(localhost|127\.0\.0\.1):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||''))throw Error('Local emulator required');
const require=createRequire(new URL('../../functions/package.json',import.meta.url));const {Firestore,FieldPath}=require('@google-cloud/firestore');
const db=new Firestore({projectId:'demo-production-business'});
test('production batch builder verifies counts, live edits, old-sale payments and deletions without modifying source stock',async()=>{
 const storeId='production_test_store',companyId='production_company',root=businessRoot(companyId,storeId);
 await db.doc('stores/'+storeId).set({companyId});const batch=db.batch();
 for(let i=0;i<25;i++)batch.set(db.doc('sales/prod_sale_'+i),{storeId,companyId,createdAt:'2026-01-02T12:00:00Z',totalAmount:100,items:[{quantity:1,price:100,cost:40}],payments:[{date:'2026-10-01T12:00:00Z',amount:100,method:'Efectivo'}]});
 batch.set(db.doc('expenses/prod_template'),{storeId,date:'TEMPLATE',amount:50000});
 batch.set(db.doc('inventory/prod_inventory'),{storeId,stock:4,cost:50});await batch.commit();
 await buildBusinessStore(db,{storeId,documentId:FieldPath.documentId()});
 let result=await verifyBusinessStore(db,{companyId,storeId,activate:true,assertDeploymentReady:async()=>true});assert.equal(result.sources,27);assert.equal(result.months,2);
 assert.equal((await db.doc(root).get()).data().inventoryValue,200);assert.equal((await db.collection(root+'/paymentSalesByMonth').get()).size,25);
 assert.equal((await db.doc(root+'/days/2026-10-01').get()).data().income,2500);
 await projectBusinessBatch(db,[{kind:'sales',id:'prod_sale_1'},{kind:'sales',id:'prod_sale_2'}]);assert.equal((await db.doc(root+'/days/2026-10-01').get()).data().income,2500);
 await db.doc('sales/prod_sale_1').update({payments:[{date:'2026-11-01T12:00:00Z',amount:100,method:'QR'}]});
 await assert.rejects(verifyBusinessStore(db,{companyId,storeId,activate:true,assertDeploymentReady:async()=>true}),/state\/version/);
 await Promise.all([projectBusinessBatch(db,[{kind:'sales',id:'prod_sale_1'}]),projectBusinessBatch(db,[{kind:'sales',id:'prod_sale_1'}])]);
 assert.equal((await db.doc(root+'/days/2026-10-01').get()).data().income,2400);assert.equal((await db.doc(root+'/days/2026-11-01').get()).data().income,100);
 assert.equal((await db.doc(root+'/paymentSalesByMonth/2026-10__prod_sale_1').get()).exists,false);
 await db.doc('sales/prod_sale_2').delete();await projectBusinessBatch(db,[{kind:'sales',id:'prod_sale_2'}]);
 result=await verifyBusinessStore(db,{companyId,storeId});assert.equal(result.sources,26);assert.equal((await db.collection(root+'/paymentSalesByMonth').get()).size,24);
 assert.equal((await db.doc('inventory/prod_inventory').get()).data().stock,4);
 const revision=(await db.doc(root).get()).data().revision;await db.doc('sales/prod_foreign').set({companyId:'foreign',storeId,createdAt:'2026-10-01',payments:[],items:[]});
 await assert.rejects(projectBusinessBatch(db,[{kind:'sales',id:'prod_foreign'}]),/company mismatch/);assert.equal((await db.doc(root).get()).data().revision,revision);
 await db.doc('sales/prod_foreign').delete();
 await assert.rejects(verifyBusinessStore(db,{companyId,storeId,activate:true}),/deployment/);
});
test('large backfill batches split before the write limit and still verify all payment days',async()=>{
 const storeId='wide_store',companyId='wide_company';await db.doc('stores/'+storeId).set({companyId});const batch=db.batch();
 for(let i=0;i<20;i++){const year=2020+i;batch.set(db.doc('sales/wide_'+i),{storeId,companyId,createdAt:'2026-01-02T12:00:00Z',items:[],totalAmount:30,payments:Array.from({length:30},(_,day)=>({date:year+'-01-'+String(day+1).padStart(2,'0')+'T12:00:00Z',amount:1,method:'QR'}))});}await batch.commit();
 await buildBusinessStore(db,{storeId,documentId:FieldPath.documentId()});const result=await verifyBusinessStore(db,{companyId,storeId});assert.equal(result.sources,20);assert.equal(result.months,20);
 const days=await db.collection(businessRoot(companyId,storeId)+'/days').get();assert.equal(days.docs.reduce((n,d)=>n+d.data().income,0),600);
});
test('production summary rules preserve catalog and legacy POS reads but deny summary/state pollution',async()=>{
 const {initializeTestEnvironment,assertSucceeds,assertFails}=await import('@firebase/rules-unit-testing');
 const {doc,setDoc,getDoc,getDocs,collection,query,where}=await import('firebase/firestore');
 const env=await initializeTestEnvironment({projectId:'demo-production-business-rules',firestore:{rules:await readFile(new URL('../../security/production-business.rules.local',import.meta.url),'utf8')}});
 try{
  await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();await setDoc(doc(d,'stores/s'),{companyId:'a'});await setDoc(doc(d,'inventory/p'),{storeId:'s',categoryId:'c'});await setDoc(doc(d,'categories/c'),{name:'Cat'});await setDoc(doc(d,'businessSummaryCompanies/a/stores/s'),{companyId:'a',storeId:'s',inventoryValue:20});await setDoc(doc(d,'businessSummaryState/sales_s'),{sourceVersion:'private'});});
  const anonymous=env.unauthenticatedContext().firestore(),legacy=env.authenticatedContext('legacy',{firebase:{sign_in_provider:'anonymous'}}).firestore();
  await assertSucceeds(getDocs(query(collection(anonymous,'inventory'),where('storeId','==','s'))));await assertSucceeds(getDoc(doc(anonymous,'categories/c')));
  await assertSucceeds(getDoc(doc(legacy,'businessSummaryCompanies/a/stores/s')));
  await assertFails(getDoc(doc(anonymous,'businessSummaryCompanies/a/stores/s')));
  for(const path of ['businessSummaryCompanies/a/stores/s','businessSummaryCompanies/a/stores/s/months/2026-10','businessSummaryState/sales_s','businessSummaryErrors/sales_s'])await assertFails(setDoc(doc(legacy,path),{inventoryValue:999}));
  await assertFails(getDoc(doc(legacy,'businessSummaryState/sales_s')));await assertFails(getDoc(doc(legacy,'businessSummaryCompanies/wrong/stores/s')));
 }finally{await env.cleanup();await db.terminate();}
});
