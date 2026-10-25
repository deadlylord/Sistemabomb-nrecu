import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';import {doc,getDoc,getDocs,setDoc,updateDoc,collection,query,where} from 'firebase/firestore';
import {OWNER_ID,hashPassword,loginIndexId,authenticateIdentity} from '../../functions/src/identity.mjs';import {identityUid,verifiedActor,manageStagingUser} from '../../functions/src/stagingUsers.mjs';import {manageStagingRole} from '../../functions/src/stagingRoles.mjs';import {manageProductionPlatform} from '../../functions/src/productionPlatform.mjs';
if(!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||''))throw Error('Local emulator required');
const require=createRequire(new URL('../../functions/package.json',import.meta.url));const {Firestore}=require('firebase-admin/firestore');const projectId='demo-production-pos-identity',db=new Firestore({projectId});
const options={allowOwnerUpdate:true,excludePlatformUsers:true,preserveProfile:true};
const ownerToken={identityVersion:1,authVersion:1,sellerId:OWNER_ID,companyId:'default_company',storeId:'s',roleId:'admin',platformOwner:true,platformDeveloper:true};const owner={uid:identityUid(OWNER_ID),token:ownerToken};
const read=async(c,id)=>{const s=await db.doc(c+'/'+id).get();return s.exists?s.data():null;};
let env;
test('production identity supports Developer company/admin creation, store limits, grants, hashed users and owner edits',async()=>{
 env=await initializeTestEnvironment({projectId,firestore:{rules:await readFile(new URL('../../security/production-identity.rules.local',import.meta.url),'utf8')}});
 await db.doc('companies/default_company').set({name:'Company',status:'active',maxAdmins:3,maxSellers:20,maxStores:10,allowedViews:['dashboard','pos','sellers','role_manager','stores','settings','inventory','financial_reconciliation']});
 await db.doc('stores/s').set({companyId:'default_company',name:'Store'});
 await db.doc('roles/admin').set({companyId:'default_company',name:'Administrator',userType:'admin',permissions:['dashboard','pos','sellers','role_manager','stores','settings','inventory','financial_reconciliation']});
 await db.doc('sellers/'+OWNER_ID).set({id:OWNER_ID,name:'Owner',username:'owner',companyId:'default_company',storeId:'s',roleId:'admin',authVersion:1});
 const created=await manageProductionPlatform(db,owner,{action:'createCompany',company:{name:'Temporary Company',maxStores:1,maxAdmins:2,maxSellers:3,allowedViews:['dashboard','pos','sellers']},initialStoreName:'Initial Store',admin:{name:'Initial Admin',username:'initial.admin',password:'fixture-password'}});
 assert.ok(created.id&&created.storeId&&created.sellerId);const seller=await read('sellers',created.sellerId);assert.equal(seller.companyId,created.id);assert.equal('password'in seller,false);assert.equal((await read('businessSummaryCompanies/'+created.id+'/stores',created.storeId)).ready,true);
 const login=await authenticateIdentity({identifier:'INITIAL.ADMIN',password:'fixture-password'},{enabled:true,includeContext:true,consumeAttempt:async()=>{},read,createCustomToken:async()=> 'test-token'});assert.equal(login.user.id,created.sellerId);assert.equal(login.role.companyId,created.id);
 await assert.rejects(manageProductionPlatform(db,owner,{action:'createStore',companyId:created.id,store:{name:'Over limit'}}),{code:'resource-exhausted'});
 const roleCount=(await db.collection('roles').get()).size;
 const delegated=await manageProductionPlatform(db,owner,{action:'createDeveloper',storeId:'s',name:'Delegate',username:'delegate',password:'fixture-password'});assert.equal((await db.collection('roles').get()).size,roleCount);assert.equal((await read('platformDevelopers',delegated.id)).active,true);
 const delegatedSeller=await read('sellers',delegated.id);const delegateAuth={uid:identityUid(delegated.id),token:{...ownerToken,sellerId:delegated.id,authVersion:delegatedSeller.authVersion,platformOwner:false}};
 assert.equal((await verifiedActor(delegateAuth,read)).developer,true);await manageProductionPlatform(db,owner,{action:'setDeveloper',userId:delegated.id,active:false});await assert.rejects(verifiedActor(delegateAuth,read),{code:'permission-denied'});
 const before=(await db.collection('companies').get()).size;
 await assert.rejects(manageProductionPlatform(db,{...owner,uid:'wrong'},{action:'createCompany',company:{name:'Forged'}}),{code:'permission-denied'});assert.equal((await db.collection('companies').get()).size,before);
 const user=await manageStagingUser(db,owner,{action:'create',name:'Seller',username:'seller',password:'fixture-password',companyId:'default_company',storeId:'s',roleId:'admin'},options);assert.equal('password'in await read('sellers',user.id),false);
 await assert.rejects(manageStagingUser(db,owner,{action:'create',name:'Another',username:'SELLER',password:'fixture-password',companyId:'default_company',storeId:'s',roleId:'admin'},options),{code:'already-exists'});
 const sellerAuth={uid:identityUid(user.id),token:{...ownerToken,sellerId:user.id,platformOwner:false,platformDeveloper:false}};
 const storeAdded=await manageProductionPlatform(db,sellerAuth,{action:'createStore',companyId:'default_company',store:{name:'Extra',labelConfig:{width:50,height:25},accountNames:{cash:'Caja',qr:'Cuenta QR'},footerText:'Gracias\n💜'}});
 assert.deepEqual((await read('stores',storeAdded.id)).labelConfig,{width:50,height:25});assert.equal((await read('stores',storeAdded.id)).footerText,'Gracias\n💜');
 await assert.rejects(manageProductionPlatform(db,sellerAuth,{action:'createStore',companyId:created.id,store:{name:'Foreign'}}),{code:'permission-denied'});
 await manageStagingRole(db,owner,{action:'update',id:'admin',name:'Administrator',userType:'admin',permissions:['dashboard','pos','sellers','role_manager','stores','settings','inventory','financial_reconciliation']},options);
 await manageStagingUser(db,owner,{action:'update',id:OWNER_ID,name:'Owner',username:'owner',password:'new-fixture-password',storeId:'s',roleId:'admin'},options);
 assert.equal((await read('sellers',OWNER_ID)).authVersion,2);assert.equal('password'in await read('sellers',OWNER_ID),false);
});
test('production identity rules keep public catalog and compatible POS reads while denying credential access and authority forgery',async()=>{
 try{
 const anon=env.unauthenticatedContext().firestore(),legacy=env.authenticatedContext('legacy',{firebase:{sign_in_provider:'anonymous'}}).firestore();
 const token={...ownerToken,authVersion:2,firebase:{sign_in_provider:'custom'}};const ownerClient=env.authenticatedContext(identityUid(OWNER_ID),token).firestore();
 await db.doc('inventory/p').set({storeId:'s',companyId:'default_company',stock:1});await db.doc('categories/c').set({name:'Category'});
 await db.doc('businessSummaryCompanies/default_company/stores/s').set({companyId:'default_company',storeId:'s',ready:true});
 await assertSucceeds(getDocs(query(collection(anon,'inventory'),where('storeId','==','s'))));await assertSucceeds(getDoc(doc(anon,'categories/c')));
 await assertSucceeds(getDoc(doc(ownerClient,'businessSummaryCompanies/default_company/stores/s')));
 for(const path of ['authCredentials/'+OWNER_ID,'authLoginIndex/'+loginIndexId('owner'),'authLoginAttempts/ip']){await assertFails(getDoc(doc(anon,path)));await assertFails(getDoc(doc(legacy,path)));await assertFails(setDoc(doc(ownerClient,path),{forged:true}));}
 for(const path of ['sellers/forged','roles/forged','platformDevelopers/forged'])await assertFails(setDoc(doc(legacy,path),{role:'developer',companyId:'default_company',permissions:['role_manager']}));
 await assertFails(setDoc(doc(legacy,'companies/forged'),{name:'Forged'}));
 await assertSucceeds(updateDoc(doc(ownerClient,'companies/default_company'),{phone:'123'}));
 await assertFails(updateDoc(doc(ownerClient,'companies/default_company'),{name:42}));
 await assertFails(setDoc(doc(ownerClient,'businessSummaryCompanies/default_company/stores/s'),{inventoryValue:999}));
 }finally{await env.cleanup();await db.terminate();}
});
