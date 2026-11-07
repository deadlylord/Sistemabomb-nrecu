import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { warehouseOperation } from '../../functions/src/warehouse.mjs';
import { identityUid } from '../../functions/src/stagingUsers.mjs';
if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw Error('Local emulator required');
const require=createRequire(new URL('../../functions/package.json',import.meta.url));
const {Firestore}=require('@google-cloud/firestore');
const projectId='demo-vestika-warehouse',db=new Firestore({projectId});
test('real Firestore transactions and private warehouse rules',async t=>{
 const env=await initializeTestEnvironment({projectId,firestore:{rules:await readFile(new URL('../../security/firestore.staging.rules',import.meta.url),'utf8')}});
 const claims={identityVersion:1,sellerId:'u',companyId:'co',storeId:'st',roleId:'seller',authVersion:1};
 const auth={uid:identityUid('u'),token:claims};const client=env.authenticatedContext(auth.uid,{...claims,firebase:{sign_in_provider:'custom'}}).firestore();
 const run=data=>warehouseOperation(db,auth,{companyId:'co',storeId:'st',...data});
 try{
  await db.doc('companies/co').set({status:'active'});await db.doc('stores/st').set({companyId:'co'});await db.doc('roles/seller').set({companyId:'co',userType:'seller',permissions:['pos','inventory']});await db.doc('sellers/u').set({companyId:'co',storeId:'st',roleId:'seller',name:'Vendedora',authVersion:1});await db.doc('inventory/p').set({companyId:'co',storeId:'st',categoryId:'cat',name:'Blusa',stock:10,cost:1000});
  await t.test('legacy product edits remain valid before warehouse ownership',async()=>{await assertSucceeds(updateDoc(doc(client,'inventory/p'),{price:3000}));await assertFails(setDoc(doc(client,'inventory/spoof'),{companyId:'co',storeId:'st',categoryId:'cat',stock:1,warehouseUnits:4}));});
  await t.test('concurrent duplicate move uses one receipt and transaction',async()=>{const move={action:'move',operationId:'one',productId:'p',quantity:4,direction:'toWarehouse'};await Promise.all([run(move),run(move)]);const local=(await db.doc('inventory/p').get()).data();assert.equal(local.stock,6);assert.equal(local.warehouseUnits,4);assert.equal(local.stock+local.warehouseUnits,10);await assert.rejects(run({action:'history'}), /administrador/);assert.equal((await db.collection('warehouseCompanies/co/stores/st/movements').get()).size,1);assert.equal((await db.doc('productHistory/warehouse_one').get()).data().changedBy,'Sistema');});
  await t.test('private nested paths cannot be read, listed, written or deleted by client',async()=>{const base='warehouseCompanies/co/stores/st/products';await assertFails(getDoc(doc(client,base+'/p')));await assertFails(getDocs(collection(client,base)));await assertFails(setDoc(doc(client,base+'/p'),{stock:50}));await assertFails(deleteDoc(doc(client,base+'/p')));});
  await t.test('server-owned mirror cannot be forged or removed; deletion/category change blocked while warehouse has stock',async()=>{await assertFails(updateDoc(doc(client,'inventory/p'),{warehouseUnits:0}));await assertFails(setDoc(doc(client,'inventory/p'),{companyId:'co',storeId:'st',categoryId:'cat',stock:6}));await assertFails(deleteDoc(doc(client,'inventory/p')));await assertFails(updateDoc(doc(client,'inventory/p'),{categoryId:'new'}));await assertSucceeds(updateDoc(doc(client,'inventory/p'),{name:'Blusa nueva',cost:1200,stock:5}));});
  await t.test('pagination query is supported and return restores independently of metadata updates',async()=>{const page=await run({action:'products',categoryId:'cat'});assert.equal(page.rows[0].id,'p');await run({action:'move',operationId:'back',productId:'p',quantity:4,direction:'toStore'});const p=(await db.doc('inventory/p').get()).data();assert.equal(p.stock,9);assert.equal(p.warehouseUnits,0);await assertSucceeds(updateDoc(doc(client,'inventory/p'),{categoryId:'new'}));await assertSucceeds(deleteDoc(doc(client,'inventory/p')));});
 }finally{await env.cleanup();await db.terminate()}
});
