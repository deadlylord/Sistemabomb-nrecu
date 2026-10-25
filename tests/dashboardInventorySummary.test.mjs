import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {developerSession,browserGlobals} from './helpers/developerSession.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

async function setup(ready=true) {
 const m=await developerSession({summaries:true,verified:true,inventorySummary:true,operationalWrites:true});
 const company={id:'a'},stores=['one','two'].map(id=>({id,companyId:'a',name:id,accentColorsUpdated:true}));
 const role={id:'r',companyId:'a',name:'Administrador',userType:'admin',permissions:Object.values(m.View).filter(v=>v!==m.View.DEVELOPER_CENTER)};
 const user={id:'u',companyId:'a',storeId:'one',roleId:'r',name:'User'};
 const products=Array.from({length:1500},(_,i)=>({id:'p'+i,companyId:'a',storeId:'one',name:'Product '+i,stock:5,cost:10,price:20}));
 for(const [name,rows] of Object.entries({companies:[company],stores,roles:[role],sellers:[user],sales:[],layaways:[],inventory:[...products,{...products[0],id:'foreign',storeId:'two'}]}))m.records.set(name,rows);
 for(const store of stores)m.records.set('businessSummaryCompanies/a/stores/'+store.id,[{id:'new-id',companyId:'a',storeId:store.id,ready,schemaVersion:1,inventoryValue:store.id==='one'?75000:50,inventoryUnits:store.id==='one'?7500:5}]);
 let r;await act(async()=>{r=create(React.createElement(m.App,{initialSession:{user,role,company,store:stores[0]}}))});
 return {m,r,products,screen:()=>r.root.findByProps({screen:'DashboardView'}),full:()=>m.connections.filter(c=>!c.closed&&c.q.name==='inventory'&&!c.q.id)};
}
test('verified inventory total avoids catalog download; referenced prices stay live; editor gets complete inventory and stock updates',async()=>{
 const restore=browserGlobals();let s;
 try{
  s=await setup();const {m,r,products,screen,full}=s;
  assert.equal(screen().props.inventorySummary.value,75000);assert.equal(full().length,0);assert.deepEqual(screen().props.inventory,[]);
  await act(async()=>screen().props.onInventoryRequest({productIds:['p1','p1','foreign','voucher-code'],full:false}));
  assert.equal(full().length,0);assert.deepEqual(screen().props.inventory.map(p=>p.id),['p1']);
  const price=m.connections.find(c=>!c.closed&&c.q.name==='inventory'&&c.q.id==='p1');
  m.records.set('inventory',[...m.records.get('inventory').filter(p=>p.id!=='p1'),{...products[1],price:99}]);
  await act(async()=>price.apply(m.snapshot(price.q)));assert.equal(screen().props.inventory[0].price,99);
  await act(async()=>price.error(new Error('offline')));assert.ok(screen().props.inventoryStatus.error);
  await act(async()=>price.apply(m.snapshot(price.q)));assert.ok(screen().props.inventoryStatus.error,'a later partial snapshot cannot erase the query failure');
  await act(async()=>screen().props.onInventoryRequest({productIds:['p1'],full:true}));
  assert.equal(full().length,1);assert.equal(screen().props.inventory.length,1500);assert.equal(screen().props.inventoryStatus.editReady,true);
  const sale={id:'s',companyId:'a',storeId:'one',createdAt:new Date().toISOString(),invoiceNumber:1,seller:'User',items:[{...products[1],quantity:1}],payments:[],totalAmount:20};
  const updated={...sale,items:[{...products[2],quantity:1}]};
  await act(async()=>screen().props.onUpdateSale(updated,sale));
  assert.ok(m.writes.some(w=>w.ref.name==='inventory'&&w.ref.id==='p2'&&w.data.stock===-1),'new product outside initial report subset still updates stock');
  await act(async()=>screen().props.onInventoryRequest({productIds:[],full:false}));assert.equal(full().length,0);
  await act(async()=>r.root.findByType(m.Header).props.onSwitchStore('two'));
  assert.equal(screen().props.inventorySummary.value,50);assert.deepEqual(screen().props.inventory,[]);
  await act(async()=>price.apply(m.snapshot(price.q)));assert.deepEqual(screen().props.inventory,[],'late old-store listener cannot restore old products');
  await act(async()=>screen().props.onInventoryRequest({productIds:[],full:true}));
  await act(async()=>r.root.findByType(m.Header).props.setCurrentView(m.View.POS));assert.equal(full().length,1);assert.equal(r.root.findByProps({screen:'PosView'}).props.inventory.length,1);
  await act(async()=>r.root.findByType(m.Header).props.setCurrentView(m.View.DASHBOARD));assert.equal(full().length,0,'returning from POS must not restore an old full-catalog editor request');
 }finally{if(s){await act(async()=>s.r.unmount());await s.m.cleanup()}restore()}
});
test('unverified summary retains original full inventory and total calculation',async()=>{
 const restore=browserGlobals();let s;
 try{s=await setup(false);assert.equal(s.screen().props.inventorySummary,undefined);assert.equal(s.screen().props.inventory.length,1500);assert.equal(s.full().length,1);}finally{if(s){await act(async()=>s.r.unmount());await s.m.cleanup()}restore()}
});
