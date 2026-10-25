import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {create,act} from 'react-test-renderer';import {developerSession,browserGlobals} from './helpers/developerSession.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('production Developer creates companies/stores/platform users through verified services without legacy credential writes',async()=>{
 const restore=browserGlobals(),m=await developerSession({summaries:true,verified:true,verifiedManagement:true});let renderer;
 try{
 const company={id:'default_company',name:'Own'},store={id:'s',companyId:company.id,name:'Store',accentColorsUpdated:true},role={id:'r',companyId:company.id,name:'Administrator',userType:'admin',permissions:[m.View.DASHBOARD]},user={id:m.PLATFORM_OWNER_USER_ID,companyId:company.id,storeId:store.id,roleId:role.id,name:'Owner'};
 for(const [name,rows]of Object.entries({companies:[company],stores:[store],roles:[role],sellers:[user]}))m.records.set(name,rows);
 await act(async()=>{renderer=create(React.createElement(m.App,{initialSession:{user,company,store,role}}))});await act(async()=>renderer.root.findByType(m.Header).props.setCurrentView(m.View.DEVELOPER_CENTER));
 const center=()=>renderer.root.findByType(m.DeveloperCenter);
 await act(async()=>center().props.onCreateCompany({name:'New Company'},'First Store',{name:'Admin',username:'newadmin',password:'fixture-password'}));
 await act(async()=>center().props.onCreateStoreForCompany(company.id,{name:'Extra Store',accountNames:{cash:'Caja',qr:'QR'}}));
 await act(async()=>center().props.onCreatePlatformDeveloper({name:'Delegate',username:'delegate',password:'fixture-password',storeId:store.id}));
 await act(async()=>center().props.onSetPlatformDeveloper('target',true));
 assert.deepEqual(m.verifiedCalls.map(c=>c.kind),['platform','platform','platform','platform']);assert.deepEqual(m.verifiedCalls.map(c=>c.input.action),['createCompany','createStore','createDeveloper','setDeveloper']);assert.equal(m.verifiedCalls[0].input.admin.password,'fixture-password');assert.deepEqual(m.verifiedCalls[1].input.store.accountNames,{cash:'Caja',qr:'QR'});
 assert.equal(m.writes.some(w=>['sellers','authCredentials','roles','companies','platformDevelopers'].includes(w.ref.name)),false);
 }finally{if(renderer)await act(async()=>renderer.unmount());await m.cleanup();restore()}
});
