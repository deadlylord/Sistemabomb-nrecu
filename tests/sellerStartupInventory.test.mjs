import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {developerSession,browserGlobals} from './helpers/developerSession.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
for (const admin of [false,true]) test(`${admin ? 'admin' : 'seller'} inventory survives the late company store list and remains live without reconnecting`,async()=>{
 const restore=browserGlobals(),m=await developerSession({summaries:true,verified:true});let r;
 try {
  const company={id:'startup',name:'Startup',allowedViews:[m.View.POS]};
  const stores=[{id:'assigned',companyId:'startup',name:'Assigned',accentColorsUpdated:true},{id:'other',companyId:'startup',name:'Other',accentColorsUpdated:true}];
  const role={id:'seller-role',companyId:'startup',name:admin?'Administrator':'Vendedor',userType:admin?'admin':'seller',permissions:[m.View.POS]};
  const user={id:'seller',companyId:'startup',storeId:'assigned',roleId:role.id,name:'Seller'};
  const product={id:'product',storeId:'assigned',companyId:'startup',name:'Visible product',stock:10,price:20000};
  for(const [name,rows]of Object.entries({companies:[company],stores,roles:[role],sellers:[user],inventory:[product]}))m.records.set(name,rows);
  m.deferredSnapshots.add('stores');
  await act(async()=>{r=create(React.createElement(m.App,{initialSession:{user,role,company,store:stores[0]}}))});
  if(admin) await act(async()=>r.root.findByType(m.Header).props.setCurrentView(m.View.POS));
  const pos=()=>r.root.findByProps({screen:'PosView'});
  assert.equal(pos().props.inventory.length,1,'initial inventory reached the seller');
  const inventoryConnections=()=>m.connections.filter(c=>c.q.name==='inventory'&&!c.q.id);
  const first=inventoryConnections().find(c=>!c.closed);assert.ok(first);
  const storeListener=m.connections.find(c=>c.q.name==='stores'&&!c.closed);
  await act(async()=>storeListener.apply(m.snapshot(storeListener.q)));
  assert.deepEqual(pos().props.inventory.map(p=>p.id),['product'],'receiving additional stores must not erase already loaded products');
  assert.equal(first.closed,false,'metadata must not reconnect inventory');assert.equal(inventoryConnections().length,1);
  m.records.set('inventory',[{...product,stock:9}]);await act(async()=>first.apply(m.snapshot(first.q)));
  assert.equal(pos().props.inventory[0].stock,9,'stock stays live');
  await act(async()=>r.root.findByType(m.Header).props.onSwitchStore('other'));
  assert.equal(first.closed,true);assert.deepEqual(pos().props.inventory,[],'the prior store inventory must never appear in another store');
 }finally{if(r)await act(async()=>r.unmount());await m.cleanup();restore()}
});
