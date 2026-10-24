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
