import test from 'node:test';import assert from 'node:assert/strict';
import {prepareBackupSnapshot} from '../functions/src/migrationBackup.mjs';import {planProductionIdentity,wireFields} from '../functions/src/productionIdentityPlan.mjs';import {verifyPassword,loginIndexId} from '../functions/src/identity.mjs';
function fixture(){const data={'companies/default_company':{name:'Company'},'stores/s':{name:'Store'},'roles/r':{name:'Administrator',permissions:{arrayValue:{values:[{stringValue:'dashboard'}]}}},'sellers/u':{name:'User',username:'USER',password:' test-password ',storeId:'s',roleId:'r'}};
 const documents=Object.entries(data).map(([path,value])=>({name:'projects/factura2-6e811/databases/(default)/documents/'+path,fields:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,typeof v==='object'?v:wireFields({[k]:v})[k]])),updateTime:'2026-10-24T00:00:00.000Z'}));
 documents.find(d=>d.name.endsWith('/sellers/u')).fields.createdAt={timestampValue:'2020-01-01T00:00:00Z'};
 return prepareBackupSnapshot({projectId:'factura2-6e811',readTime:'2026-10-24T00:00:01Z',collections:['companies','stores','roles','sellers','authCredentials','authLoginIndex','platformDevelopers','categories'],documents,complete:true});}
test('identity migration retains password compatibility, metadata and wire types while guarding every affected original version',async()=>{
 const snapshot=fixture(),before=structuredClone(snapshot),plan=await planProductionIdentity(snapshot);
 assert.equal(plan.users,1);assert.equal(plan.aliases,1);const seller=plan.writes.find(w=>w.path==='sellers/u');
 assert.equal('password'in seller.update.fields,false);assert.deepEqual(seller.update.fields.createdAt,{timestampValue:'2020-01-01T00:00:00Z'});
 assert.equal(seller.update.fields.companyId.stringValue,'default_company');assert.equal(seller.currentDocument.updateTime,'2026-10-24T00:00:00.000Z');
 const credential=plan.writes.find(w=>w.path==='authCredentials/u');assert.equal(await verifyPassword('test-password',credential.update.fields.passwordHash.stringValue),true);assert.deepEqual(credential.currentDocument,{exists:false});
 assert.equal(plan.writes.find(w=>w.path==='authLoginIndex/'+loginIndexId('User')).update.fields.sellerId.stringValue,'u');
 assert.equal(plan.writes.find(w=>w.path==='roles/r').update.fields.userType.stringValue,'admin');assert.deepEqual(snapshot,before);
 assert.ok(plan.writes.every(w=>!['sales','inventory','financialRecords','layaways'].includes(w.path.split('/')[0])));
});
test('migration rejects ambiguous aliases, incompatible ownership and invalid credentials before returning writes',async()=>{
 for(const change of [s=>s.items.find(i=>i.path==='sellers/u').document.fields.password={stringValue:''},s=>s.items.find(i=>i.path==='sellers/u').document.fields.companyId={stringValue:'other'},s=>{const d=structuredClone(s.items.find(i=>i.path==='sellers/u'));d.path='sellers/v';d.document.name=d.document.name.replace('/sellers/u','/sellers/v');s.items.push(d);}]){
  const snapshot=fixture();change(snapshot);await assert.rejects(planProductionIdentity(snapshot));
 }
});
