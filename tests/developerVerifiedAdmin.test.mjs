import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {developerSession,browserGlobals} from './helpers/developerSession.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('Developer creates admin for a load-test store through verified callables without a legacy role',async()=>{
 const restore=browserGlobals();const m=await developerSession({summaries:true,verified:true,verifiedManagement:true});let r;
 try{
 const role={id:'own-role',companyId:'own',name:'Admin local',userType:'admin',permissions:[m.View.DASHBOARD]};
 const user={id:m.PLATFORM_OWNER_USER_ID,companyId:'own',name:'Owner',storeId:'own-store',roleId:role.id};
 const ownCompany={id:'own',name:'Own',allowedViews:[m.View.DASHBOARD]},target={id:'load',name:'Load',maxAdmins:5,allowedViews:[m.View.DASHBOARD,m.View.POS,m.View.FINANCIAL_RECONCILIATION]};
 const ownStore={id:'own-store',name:'Own',companyId:'own',accentColorsUpdated:true},loadStore={id:'load-large',name:'Grande',companyId:'load',accentColorsUpdated:true};
 for(const [name,rows] of Object.entries({companies:[ownCompany,target],stores:[ownStore,loadStore],roles:[role],sellers:[user]}))m.records.set(name,rows);
 await act(async()=>{r=create(React.createElement(m.App,{initialSession:{user,role,company:ownCompany,store:ownStore}}))});
 await act(async()=>r.root.findByType(m.Header).props.setCurrentView(m.View.DEVELOPER_CENTER));
 await act(async()=>r.root.findByType(m.DeveloperCenter).props.onCreateAdminUser('load','load-large',{name:'Load admin',username:'loadadmin',password:'test-only'}));
 assert.deepEqual(m.verifiedCalls.map(c=>c.kind),['role','user']);assert.equal(m.verifiedCalls[0].input.companyId,'load');assert.deepEqual(m.verifiedCalls[0].input.permissions,target.allowedViews);
 assert.equal(m.verifiedCalls[1].input.storeId,'load-large');assert.equal(m.verifiedCalls[1].input.roleId,'created-role');
 assert.equal(m.writes.some(w=>w.ref.name==='sellers'),false,'no legacy seller or plaintext password write');
 }finally{if(r)await act(async()=>r.unmount());await m.cleanup();restore()}
});

test('delegated Developer replaces tenant-only user subscription when grant arrives and sees new company admins',async()=>{
 const restore=browserGlobals();const m=await developerSession({summaries:true,verified:true,verifiedManagement:true});let r;
 try{
  const company={id:'own',name:'Own'},store={id:'own-store',companyId:'own',name:'Own',accentColorsUpdated:true};
  const role={id:'own-role',companyId:'own',name:'Admin',userType:'admin',permissions:[m.View.DASHBOARD]};
  const user={id:'staging-admin',companyId:'own',storeId:store.id,roleId:role.id,name:'Staging admin'};
  const existing={id:'created-before-reload',companyId:'load',storeId:'large',roleId:'load-admin',name:'Existing Load Admin'};
  for(const [name,rows] of Object.entries({companies:[company,{id:'load',name:'Load'}],stores:[store,{id:'large',companyId:'load',name:'Large',accentColorsUpdated:true}],roles:[role,{id:'load-admin',companyId:'load',name:'Administrador',userType:'admin',permissions:[m.View.POS]}],sellers:[user,existing],platformDevelopers:[{id:user.id,userId:user.id,role:'developer',active:true,grantedBy:m.PLATFORM_OWNER_USER_ID}]}))m.records.set(name,rows);
  await act(async()=>{r=create(React.createElement(m.App,{initialSession:{user,role,company,store}}))});
  await act(async()=>r.root.findByType(m.Header).props.setCurrentView(m.View.DEVELOPER_CENTER));
  const center=()=>r.root.findByType(m.DeveloperCenter);
  assert.ok(center().props.sellers.some(s=>s.id===existing.id),'already-created administrator must be visible to delegated Developer');
  const userListeners=m.connections.filter(c=>c.q.name==='sellers'&&!c.q.id);
  const global=userListeners.find(c=>!c.closed&&!c.q.filters?.some(f=>f.field==='companyId'));
  assert.ok(global,'a global user subscription replaces the initial tenant-only query');
  assert.ok(userListeners.filter(c=>c.q.filters?.some(f=>f.field==='companyId')).every(c=>c.closed));
  const next={...existing,id:'new-admin',name:'New Load Admin'};m.records.set('sellers',[user,existing,next]);
  await act(async()=>global.apply(m.snapshot(global.q)));
  assert.ok(center().props.sellers.some(s=>s.id===next.id),'new admin arrives through the live user list');
  const stale=userListeners.find(c=>c.closed);if(stale)await act(async()=>stale.apply(m.snapshot(stale.q)));
  assert.ok(center().props.sellers.some(s=>s.id===next.id),'late tenant callback cannot hide another company admin');
  m.records.set('platformDevelopers',[]);const grant=m.connections.find(c=>!c.closed&&c.q.name==='platformDevelopers'&&c.q.id===user.id);
  await act(async()=>grant.apply(m.snapshot(grant.q)));
  assert.ok(global.closed);assert.equal(r.root.findAllByType(m.DeveloperCenter).length,0);
  const final=m.connections.filter(c=>!c.closed&&c.q.name==='sellers'&&!c.q.id);
  assert.ok(final.length&&final.every(c=>c.q.filters.some(f=>f.field==='companyId'&&f.value==='own')),'revocation restores own-company scope');
 }finally{if(r)await act(async()=>r.unmount());await m.cleanup();restore()}
});
