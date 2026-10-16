import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { build } from 'esbuild';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, writeBatch } from 'firebase/firestore';
import { authenticateIdentity, hashPassword, loginIndexId } from '../../functions/src/identity.mjs';
import { identityUid, manageStagingUser } from '../../functions/src/stagingUsers.mjs';
import { manageStagingRole } from '../../functions/src/stagingRoles.mjs';

if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required.');
const req = createRequire(new URL('../../functions/package.json',import.meta.url));
const { Firestore } = req('@google-cloud/firestore');
const projectId = 'demo-vestika-identity';
const db = new Firestore({projectId});
const baseClaims = { identityVersion:1, authVersion:1, sellerId:'admin', companyId:'a', storeId:'a1', roleId:'admin', platformOwner:false, platformDeveloper:false };
const auth = { uid:identityUid('admin'), token:baseClaims };
const record = (id, storeId='a1', extra={}) => ({id,companyId:'a',storeId,amount:100,date:'2026-10-16T08:00:00-05:00',accountType:'cash',type:'income_manual',description:'Prueba aislada',registeredBy:'Test',...extra});
const read = async (collection,id) => { const s=await db.doc(`${collection}/${id}`).get();return s.exists?s.data():null; };
const login = (identifier,password) => authenticateIdentity({identifier,password},{enabled:true,read,consumeAttempt:async()=>{},createCustomToken:async()=> 'signed-test-token'});

test('verified staging login, user management and tenant rules',async t=>{
  const env=await initializeTestEnvironment({projectId,firestore:{rules:await readFile(new URL('../../security/firestore.staging.rules',import.meta.url),'utf8')}});
  const password='only-a-test-password';
  const encoded=await hashPassword(password);
  const fixtures={
    'companies/a':{name:'A',status:'active',maxAdmins:3,maxSellers:5}, 'companies/b':{name:'B',status:'active'},
    'stores/a1':{companyId:'a',name:'A1',nextInvoiceNumber:1}, 'stores/a2':{companyId:'a',name:'A2'}, 'stores/b1':{companyId:'b',name:'B1'},
    'roles/admin':{companyId:'a',name:'Administrator',userType:'admin',permissions:['sellers','role_manager','financial_reconciliation','pos','settings','inventory','dashboard','payroll']},
    'roles/seller':{companyId:'a',name:'Vendedor',userType:'seller',permissions:['pos','inventory','financial_reconciliation']},
    'roles/foreign':{companyId:'b',name:'Admin',userType:'admin',permissions:['sellers']},
    'sellers/admin':{name:'Admin Name',username:'MiXeD.Legacy',companyId:'a',storeId:'a1',roleId:'admin',authVersion:1,isDisabled:false},
    'sellers/seller':{name:'Seller',username:'seller',companyId:'a',storeId:'a1',roleId:'seller',authVersion:1,isDisabled:false},
    'sellers/foreign':{name:'Other company',companyId:'b',storeId:'b1',roleId:'foreign',authVersion:1,isDisabled:false},
    'authCredentials/admin':{passwordHash:encoded,disabled:false},
    ['authLoginIndex/'+loginIndexId('mixed.legacy')]:{sellerId:'admin'}, ['authLoginIndex/'+loginIndexId('Admin Name')]:{sellerId:'admin'},
    'financialRecords/own':record('own'), 'financialRecords/otherStore':record('otherStore','a2'), 'financialRecords/foreign':record('foreign','b1',{companyId:'b'}),
    'inventory/p1':{id:'p1',companyId:'a',storeId:'a1',name:'One',stock:1}, 'inventory/p2':{id:'p2',companyId:'b',storeId:'b1',name:'Other',stock:10},
    'financialLedgerCompanies/a/stores/a1':{companyId:'a',storeId:'a1',ready:true,accounts:{cash:100}},
    'financialLedgerCompanies/b/stores/b1':{companyId:'b',storeId:'b1',ready:true,accounts:{cash:100}}
  };
  try {
    const batch=db.batch();for(const[path,data]of Object.entries(fixtures))batch.set(db.doc(path),data);await batch.commit();
    await t.test('existing case-insensitive username/name login remains valid without returning password/hash',async()=>{
      for(const identifier of [' mixed.LEGACY ','ADMIN NAME']){
        const result=await login(identifier,password);assert.equal(result.user.id,'admin');assert.equal(result.claims.authVersion,1);assert.equal(result.user.companyId,'a');
        assert.equal('password' in result.user,false);assert.ok(!JSON.stringify(result).includes(encoded));
      }
      await assert.rejects(login('mixed.legacy','incorrect'),{code:'unauthenticated'});
    });
    await t.test('actual initial queries work; anonymous/global/cross-company reads fail',async()=>{
      const client=env.authenticatedContext(auth.uid,{...baseClaims,firebase:{sign_in_provider:'custom'}}).firestore();
      for(const name of ['stores','roles','sellers'])await assertSucceeds(getDocs(query(collection(client,name),where('companyId','==','a'))));
      await assertSucceeds(getDocs(query(collection(client,'companies'),where('__name__','==','a'))));
      await assertSucceeds(getDocs(query(collection(client,'financialRecords'),where('storeId','==','a1'))));
      await assertSucceeds(getDocs(query(collection(client,'inventory'),where('storeId','==','a1'))));
      await assertFails(getDocs(collection(client,'sellers')));
      for(const path of ['companies/b','stores/b1','sellers/foreign','financialRecords/foreign','authCredentials/admin','authLoginIndex/'+loginIndexId('mixed.legacy')])await assertFails(getDoc(doc(client,path)));
      await assertFails(getDoc(doc(env.authenticatedContext('anonymous',{firebase:{sign_in_provider:'anonymous'}}).firestore(),'sellers/admin')));
      await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'inventory/p1')));
    });
    await t.test('client cannot write identity/roles/private collections, move ownership, forge peers or alter summaries',async()=>{
      const client=env.authenticatedContext(auth.uid,{...baseClaims,firebase:{sign_in_provider:'custom'}}).firestore();
      for(const path of ['sellers/admin','roles/admin','platformDevelopers/admin','authCredentials/admin','authLoginIndex/injected','financialLedgerState/own','financialLedgerCompanies/a/stores/a1'])await assertFails(setDoc(doc(client,path),{companyId:'a',storeId:'a1',roleId:'admin',authVersion:2}));
      await assertFails(updateDoc(doc(client,'inventory/p1'),{companyId:'b',storeId:'b1'}));
      await assertFails(setDoc(doc(client,'financialRecords/injected'),record('injected','a1',{debtStoreId:'b1'})));
      await assertFails(setDoc(doc(client,'financialRecords/bad'),record('bad','a1',{amount:'not-number'})));
      await assertFails(updateDoc(doc(client,'financialRecords/own'),{amount:'not-number'}));
      await assertFails(updateDoc(doc(client,'financialRecords/own'),{description:'x'.repeat(10001)}));
    });
    await t.test('seller is limited to its store for finance; admin may read another own-company store',async()=>{
      const token={...baseClaims,sellerId:'seller',roleId:'seller',firebase:{sign_in_provider:'custom'}};
      const client=env.authenticatedContext(identityUid('seller'),token).firestore();
      await assertSucceeds(getDoc(doc(client,'financialRecords/own')));
      await assertFails(getDoc(doc(client,'financialRecords/otherStore')));
      await assertFails(getDoc(doc(client,'financialLedgerCompanies/b/stores/b1')));
      await assertFails(updateDoc(doc(client,'inventory/p2'),{stock:0}));
    });
    await t.test('create/update/change password/rename/disable/enable/delete maintain private aliases and invalidate old sessions',async()=>{
      const created=await manageStagingUser(db,auth,{action:'create',name:'New User',username:'New.Login',password:'first-secret',storeId:'a1',roleId:'seller'});
      assert.equal((await login(' new.LOGIN ','first-secret')).user.id,created.id);
      const safe=await read('sellers',created.id);assert.equal('password' in safe,false);
      const oldClaims={...baseClaims,sellerId:created.id,roleId:'seller',authVersion:safe.authVersion};
      const oldClient=env.authenticatedContext(identityUid(created.id),{...oldClaims,firebase:{sign_in_provider:'custom'}}).firestore();
      await assertSucceeds(getDoc(doc(oldClient,'inventory/p1')));
      await manageStagingUser(db,auth,{action:'update',id:created.id,name:'Renamed User',username:'renamed.login',password:'second-secret',storeId:'a1',roleId:'seller'});
      await assert.rejects(login('new.login','first-secret'),{code:'unauthenticated'});
      await assert.rejects(login('renamed.login','first-secret'),{code:'unauthenticated'});
      assert.equal((await login('RENAMED.LOGIN','second-secret')).claims.authVersion,2);
      await assertFails(getDoc(doc(oldClient,'inventory/p1')));
      await manageStagingUser(db,auth,{action:'toggle',id:created.id});await assert.rejects(login('renamed.login','second-secret'),{code:'unauthenticated'});
      await manageStagingUser(db,auth,{action:'toggle',id:created.id});assert.equal((await login('renamed.login','second-secret')).user.id,created.id);
      await manageStagingUser(db,auth,{action:'delete',id:created.id});assert.equal(await read('authCredentials',created.id),null);assert.equal(await read('sellers',created.id),null);await assert.rejects(login('renamed.login','second-secret'),{code:'unauthenticated'});
    });
    await t.test('server rejects forged role/company, foreign users/stores, self-deactivation and normalized alias collisions',async()=>{
      await assert.rejects(manageStagingUser(db,auth,{action:'delete',id:'foreign'}),{code:'permission-denied'});
      await assert.rejects(manageStagingUser(db,auth,{action:'toggle',id:'admin'}),{code:'permission-denied'});
      await assert.rejects(manageStagingUser(db,auth,{action:'create',name:'Foreign store',password:'valid',storeId:'b1',roleId:'seller'}),{code:'permission-denied'});
      await assert.rejects(manageStagingUser(db,auth,{action:'create',name:'Another',username:' MIXED.LEGACY ',password:'valid',storeId:'a1',roleId:'seller'}),{code:'already-exists'});
      const forged={uid:identityUid('seller'),token:{...baseClaims,sellerId:'seller',roleId:'admin'}};
      await assert.rejects(manageStagingUser(db,forged,{action:'delete',id:'admin'}),{code:'permission-denied'});
      const attempted={...auth,token:{...baseClaims,companyId:'b'}};await assert.rejects(manageStagingUser(db,attempted,{action:'delete',id:'foreign'}),{code:'permission-denied'});
    });
    await t.test('concurrent duplicate identifiers create exactly one account; licence assignment is serialized',async()=>{
      const create=()=>manageStagingUser(db,auth,{action:'create',name:'Concurrent Name',username:'unique.concurrent',password:'valid',storeId:'a1',roleId:'seller'});
      const result=await Promise.allSettled([create(),create()]);assert.equal(result.filter(r=>r.status==='fulfilled').length,1);
      const id=result.find(r=>r.status==='fulfilled').value.id;
      await manageStagingUser(db,auth,{action:'delete',id});
      await db.doc('companies/a').update({maxSellers:1});
      await assert.rejects(manageStagingUser(db,auth,{action:'create',name:'Licence Overflow',password:'valid',storeId:'a1',roleId:'seller'}),{code:'resource-exhausted'});
      await db.doc('companies/a').update({maxSellers:5});
    });
    await t.test('roles are managed on server without platform escalation or editing own permissions',async()=>{
      const role=await manageStagingRole(db,auth,{action:'create',name:'Limited',userType:'seller',permissions:['pos']});
      await manageStagingRole(db,auth,{action:'update',id:role.id,name:'Limited Updated',userType:'seller',permissions:['pos','inventory']});
      await assert.rejects(manageStagingRole(db,auth,{action:'update',id:'admin',name:'Own',userType:'admin',permissions:['pos']}),{code:'permission-denied'});
      await assert.rejects(manageStagingRole(db,auth,{action:'create',name:'Developer',userType:'admin',permissions:['developer_center']}),{code:'invalid-argument'});
    });
    await t.test('paired tenant writer works with strict rules; direct partial changes are rejected',async()=>{
      const dir=await mkdtemp(fileURLToPath(new URL('../.identity-writer-',import.meta.url)));
      try {
        const path=join(dir,'writer.mjs');await build({entryPoints:['services/tenantWrites.ts'],outfile:path,bundle:true,format:'esm',platform:'node',external:['firebase/firestore']});
        const{createTenantWriter}=await import(pathToFileURL(path).href);
        const client=env.authenticatedContext(auth.uid,{...baseClaims,firebase:{sign_in_provider:'custom'}}).firestore();
        const writer=createTenantWriter(client,{companyId:'a',storeIds:new Set(['a1','a2'])});
        const left=record('left','a1',{amount:-100,type:'expense',relatedRecordId:'right',debtStoreId:'a2',subCategory:'Cruce Sedes'});
        const right=record('right','a2',{relatedRecordId:'left',debtStoreId:'a1',subCategory:'Cruce Sedes'});
        const batch=writer.writeBatch();batch.set(doc(client,'financialRecords/left'),left);batch.set(doc(client,'financialRecords/right'),right);
        for (const data of [left,right]) batch.set(doc(client,'financialRecordsHistory/create_'+data.id),{companyId:'a',storeId:data.storeId,recordId:data.id,action:'create',newState:data});
        await batch.commit();
        await assertFails(updateDoc(doc(client,'financialRecords/left'),{amount:-200}));
        const edited={...left,amount:-200};const edit=writer.writeBatch();edit.set(doc(client,'financialRecords/left'),edited);edit.set(doc(client,'financialRecordsHistory/edit_left'),{companyId:'a',storeId:'a1',recordId:'left',action:'update',previousState:left,newState:edited});await edit.commit();
        assert.equal((await getDoc(doc(client,'financialRecords/right'))).data().amount,200);
        await assertFails(deleteDoc(doc(client,'financialRecords/left')));
        const remove=writer.writeBatch();remove.delete(doc(client,'financialRecords/left'));remove.set(doc(client,'financialRecordsHistory/delete_left'),{companyId:'a',storeId:'a1',recordId:'left',action:'delete',previousState:edited});await remove.commit();assert.equal((await getDoc(doc(client,'financialRecords/right'))).exists(),false);
        const deletion=(await getDoc(doc(client,'financialRecordsHistory/delete_left'))).data();
        const restore=writer.writeBatch();restore.set(doc(client,'financialRecords/left'),edited);restore.set(doc(client,'financialRecordsHistory/restore_left'),{companyId:'a',storeId:'a1',recordId:'left',action:'restore',newState:edited,relatedPreviousState:deletion.relatedPreviousState});await restore.commit();assert.equal((await getDoc(doc(client,'financialRecords/right'))).data().amount,200);
        const bulk=writer.writeBatch();for(let i=0;i<50;i++){const row=record('bulk_'+i);bulk.set(doc(client,'financialRecords/'+row.id),row);bulk.set(doc(client,'financialRecordsHistory/create_'+row.id),{companyId:'a',storeId:'a1',recordId:row.id,action:'create',newState:row});}await bulk.commit();
        assert.equal((await getDoc(doc(client,'financialRecords/bulk_49'))).data().amount,100);
      }finally{await rm(dir,{recursive:true,force:true});}
    });
    await t.test('disabled role/company and changed user version immediately invalidate old tokens',async()=>{
      const client=env.authenticatedContext(auth.uid,{...baseClaims,firebase:{sign_in_provider:'custom'}}).firestore();
      for(const[path,patch,restore]of [['roles/admin',{isDisabled:true},{isDisabled:false}],['companies/a',{status:'suspended'},{status:'active'}],['sellers/admin',{authVersion:2},{authVersion:1}]]){
        await db.doc(path).update(patch);await assertFails(getDoc(doc(client,'financialRecords/own')));await db.doc(path).update(restore);
      }
    });
  } finally { await env.cleanup(); await db.terminate(); }
});
