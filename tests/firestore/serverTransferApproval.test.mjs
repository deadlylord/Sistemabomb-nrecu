import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {approveTransferRequest} from '../../functions/src/transferApproval.mjs';
import {identityUid} from '../../functions/src/stagingUsers.mjs';
if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw Error('Local emulator required; never run against a cloud project');
const require=createRequire(new URL('../../functions/package.json',import.meta.url));
const {Firestore}=require('@google-cloud/firestore');
const projectId='demo-vestika-transfer-approval',db=new Firestore({projectId});
const input={companyId:'co',storeId:'creator',incidentId:'request',diagnostics:true};
const auth={uid:identityUid('u'),token:{identityVersion:1,sellerId:'u',companyId:'co',storeId:'creator',roleId:'admin',authVersion:1}};
async function seed(){
 const response=await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`,{method:'DELETE'});assert.equal(response.ok,true);
 const rows={'companies/co':{status:'active',allowedViews:['incidents']},'stores/creator':{companyId:'co',name:'Creator'},'stores/origin':{companyId:'co',name:'Origin'},'stores/destination':{companyId:'co',name:'Destination'},'roles/admin':{companyId:'co',userType:'admin',permissions:['incidents']},'sellers/u':{name:'Test',companyId:'co',storeId:'creator',roleId:'admin',authVersion:1},'categories/c':{companyId:'co'},'inventory/p':{companyId:'co',storeId:'origin',name:'TEST',stock:1,cost:5,categoryId:'c',warehouseUnits:3},'inventory/q':{companyId:'co',storeId:'destination',name:'TEST',stock:0,cost:5,categoryId:'c'},'incidents/request':{companyId:'co',storeId:'creator',fromStoreId:'origin',toStoreId:'destination',productId:'p',quantity:1,type:'Solicitud de Traslado',status:'Traslado Solicitado',sellerName:'Test',history:[]}};
 const batch=db.batch();for(const[path,data]of Object.entries(rows))batch.set(db.doc(path),data);await batch.commit();
}
test('real emulator: server approval atomically applies once and preserves warehouse units',async()=>{
 await seed();await Promise.all([approveTransferRequest(db,auth,input),approveTransferRequest(db,auth,input)]);
 assert.equal((await db.doc('inventory/p').get()).data().stock,0);assert.equal((await db.doc('inventory/q').get()).data().stock,1);assert.equal((await db.doc('inventory/p').get()).data().warehouseUnits,3);assert.equal((await db.collection('inventoryTransfers').get()).size,1);assert.equal((await db.collection('productHistory').get()).size,2);
 assert.equal((await approveTransferRequest(db,auth,input)).alreadyProcessed,true);
});
test('real emulator: foreign category rejects every write',async()=>{
 await seed();await db.doc('categories/c').update({companyId:'foreign'});await assert.rejects(approveTransferRequest(db,auth,input));assert.equal((await db.doc('inventory/p').get()).data().stock,1);assert.equal((await db.collection('inventoryTransfers').get()).empty,true);assert.equal((await db.collection('productHistory').get()).empty,true);
});
test('real emulator: ambiguous destination query does not select an arbitrary garment',async()=>{
 await seed();await db.doc('inventory/q2').set((await db.doc('inventory/q').get()).data());await assert.rejects(approveTransferRequest(db,auth,input));assert.equal((await db.doc('incidents/request').get()).data().status,'Traslado Solicitado');assert.equal((await db.doc('inventory/p').get()).data().stock,1);
});
test.after(async()=>db.terminate());
