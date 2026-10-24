import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(join(process.cwd(),'tests/.company-admin-'));
const bundle=await build({bundle:true,write:false,platform:'node',format:'esm',entryPoints:['services/createVerifiedCompanyAdmin.ts']});
const path=join(dir,'helper.mjs');await writeFile(path,bundle.outputFiles[0].text);const {createVerifiedCompanyAdmin:createAdmin}=await import(pathToFileURL(path).href);
test.after(()=>rm(dir,{recursive:true,force:true}));
const company={id:'load-company',allowedViews:['dashboard','pos','financial_reconciliation']},store={id:'small',companyId:company.id},data={name:'Test',username:'test',password:'test-only'};
const fixture=()=>{const calls=[];return {calls,role:async input=>{calls.push(['role',input]);return{id:'new-role'}},user:async input=>calls.push(['user',input])}};
test('missing legacy template creates target-company admin via verified services with licensed modules only',async()=>{
 const f=fixture();await createAdmin(company,store,[],data,f.role,f.user);
 assert.deepEqual(f.calls[0],['role',{action:'create',companyId:company.id,name:'Administrador',userType:'admin',permissions:company.allowedViews}]);
 assert.deepEqual(f.calls[1],['user',{action:'create',companyId:company.id,storeId:store.id,roleId:'new-role',...data}]);
});
test('reuses target-company admin across small, medium and large stores without rewriting permissions',async()=>{
 const roles=[{id:'target-admin',companyId:company.id,name:'Administrador propio',userType:'admin',permissions:['pos']}];const f=fixture();
 for(const id of ['small','medium','large'])await createAdmin(company,{...store,id},roles,data,f.role,f.user);
 assert.equal(f.calls.length,3);assert.ok(f.calls.every(([kind,input])=>kind==='user'&&input.roleId==='target-admin'));assert.deepEqual(f.calls.map(([,v])=>v.storeId),['small','medium','large']);
});
test('never borrows another company or platform role; rejects foreign store before writes',async()=>{
 const f=fixture();const roles=[{id:'other',companyId:'other',name:'Administrator',permissions:['pos']},{id:'developer',companyId:company.id,name:'Developer',userType:'developer',permissions:['developer_center']}];
 await createAdmin(company,store,roles,data,f.role,f.user);assert.equal(f.calls[1][1].roleId,'new-role');
 const blocked=fixture();await assert.rejects(createAdmin(company,{...store,companyId:'other'},roles,data,blocked.role,blocked.user),/otra empresa/);assert.equal(blocked.calls.length,0);
});
test('service rejection preserves server enforcement for duplicates and licences; no fallback user write',async()=>{
 const f=fixture();const error=Object.assign(new Error('licence or duplicate'),{code:'resource-exhausted'});
 await assert.rejects(createAdmin(company,store,[],data,f.role,async()=>{throw error}),e=>e===error);
 const failed=fixture();await assert.rejects(createAdmin(company,store,[],data,async()=>{throw error},failed.user),e=>e===error);assert.equal(failed.calls.length,0);
});
