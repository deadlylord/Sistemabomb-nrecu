import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {developerSession,browserGlobals} from './helpers/developerSession.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('summary entry avoids sales and inventory, opens full tools on demand, and resets details on store/user scope',async()=>{
 const restore=browserGlobals();const m=await developerSession({summaries:true,verified:true,dailySummary:true});let r;
 try{
 const company={id:'load',name:'Load'},stores=['small','large'].map(id=>({id,companyId:'load',name:id,accentColorsUpdated:true}));
 const role={id:'admin',companyId:'load',name:'Administrador',userType:'admin',permissions:Object.values(m.View).filter(v=>v!==m.View.DEVELOPER_CENTER)};
 const user={id:'load-admin',companyId:'load',storeId:'small',roleId:role.id,name:'Admin'};
 for(const [name,rows] of Object.entries({companies:[company],stores,roles:[role],sellers:[user],inventory:[{id:'p',companyId:'load',storeId:'small',stock:1}],sales:[{id:'sale',companyId:'load',storeId:'small'}],layaways:[]}))m.records.set(name,rows);
 await act(async()=>{r=create(React.createElement(m.App,{initialSession:{user,role,company,store:stores[0]}}))});
 const screen=name=>r.root.findByProps({screen:name});const live=name=>m.connections.filter(c=>!c.closed&&!c.q.id&&c.q.name===name);
 assert.equal(screen('BusinessOverview').props.store.id,'small');assert.equal(r.root.findAllByProps({screen:'DashboardView'}).length,0);
 for(const name of ['inventory','sales','expenses','stockTakes','purchases'])assert.equal(live(name).length,0,name);
 await act(async()=>screen('BusinessOverview').props.onOpenDetails('price-analysis'));
 assert.equal(screen('DashboardView').props.initialSection,'price-analysis');for(const name of ['inventory','sales','expenses'])assert.equal(live(name).length,1);assert.equal(live('stockTakes').length,0);
 assert.equal(screen('DashboardView').props.sales[0].id,'sale');
 await act(async()=>r.root.findAllByType('button').find(b=>b.children.join('')==='Volver al resumen').props.onClick());
 assert.ok(screen('BusinessOverview'));assert.equal(live('inventory').length,0);assert.equal(live('sales').length,0);
 await act(async()=>screen('BusinessOverview').props.onSummaryUnavailable());assert.ok(screen('DashboardView'),'unverified store falls back to full working dashboard');
 await act(async()=>r.root.findByType(m.Header).props.onSwitchStore('large'));assert.equal(screen('BusinessOverview').props.store.id,'large');assert.equal(live('sales').length,0);
 await act(async()=>screen('BusinessOverview').props.onOpenVerification());assert.equal(live('inventory').length,1,'inventory verification retains inventory access');
 }finally{if(r)await act(async()=>r.unmount());await m.cleanup();restore()}
});
