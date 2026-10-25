import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {developerSession,browserGlobals} from './helpers/developerSession.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('dashboard avoids purchases, vouchers and unused notes; operational navigation still loads live data and returns safely',async()=>{
 const restore=browserGlobals();const m=await developerSession({summaries:true,verified:true});let r;
 try{
  const company={id:'load',name:'Load',allowedViews:Object.values(m.View)};
  const stores=['large','small'].map(id=>({id,companyId:company.id,name:id,accentColorsUpdated:true}));
  const role={id:'admin',companyId:company.id,name:'Administrador',userType:'admin',permissions:Object.values(m.View).filter(v=>v!==m.View.DEVELOPER_CENTER)};
  const user={id:'load-admin',companyId:company.id,storeId:'large',roleId:role.id,name:'Load admin'};
  const oldPayment={id:'old-layaway',companyId:company.id,storeId:'large',createdAt:'2020-01-01',payments:[{date:'2026-10-24',method:'QR',amount:5000}],status:'active'};
  const purchases=Array.from({length:1500},(_,i)=>({id:'purchase-'+i,companyId:company.id,storeId:'large',productId:'p',createdAt:'2026-10-01',quantity:1}));
  for(const [name,rows] of Object.entries({companies:[company],stores,roles:[role],sellers:[user],inventory:[{id:'p',companyId:company.id,storeId:'large',stock:5,price:50000,cost:20000}],sales:[{id:'sale',companyId:company.id,storeId:'large',createdAt:'2026-10-24',totalAmount:50000}],purchases,layaways:[oldPayment],giftVouchers:[{id:'voucher',companyId:company.id,storeId:'large',amount:10000}],dailyNotes:[{id:'note',companyId:company.id,storeId:'large'}],expenses:[{id:'expense',companyId:company.id,storeId:'large',date:'2026-10-24',amount:1000}]}))m.records.set(name,rows);
  await act(async()=>{r=create(React.createElement(m.App,{initialSession:{user,role,company,store:stores[0]}}))});
  const connections=name=>m.connections.filter(c=>c.q.name===name&&!c.q.id);
  const live=name=>connections(name).filter(c=>!c.closed);
  for(const name of ['purchases','giftVouchers','dailyNotes'])assert.equal(connections(name).length,0,`${name} must not be queried during login/dashboard`);
  const screen=name=>r.root.findByProps({screen:name});
  assert.equal(screen('DashboardView').props.sales.length,1);assert.equal(screen('DashboardView').props.layaways[0].id,oldPayment.id,'old layaway with recent payment remains available');
  assert.equal(screen('DashboardView').props.inventory.length,1);assert.equal(screen('DashboardView').props.expenses.length,1);
  const navigate=async view=>act(async()=>r.root.findByType(m.Header).props.setCurrentView(view));
  await navigate(m.View.PURCHASES);assert.ok(live('purchases').length);assert.equal(screen('PurchasesView').props.purchases.length,1500);
  const purchaseListener=live('purchases').find(c=>c.q.filters.some(f=>f.field==='storeId'&&f.value==='large'));
  m.records.set('purchases',[...purchases,{...purchases[0],id:'new-purchase'}]);await act(async()=>purchaseListener.apply(m.snapshot(purchaseListener.q)));
  assert.equal(screen('PurchasesView').props.purchases.length,1501,'purchase screen remains live');
  await navigate(m.View.DASHBOARD);assert.equal(live('purchases').length,0);assert.equal(connections('giftVouchers').length,0);assert.equal(connections('dailyNotes').length,0);
  await navigate(m.View.POS);assert.ok(live('purchases').length);assert.ok(live('giftVouchers').length);assert.equal(screen('PosView').props.giftVouchers[0].id,'voucher');
  assert.equal(screen('PosView').props.dailyNotes[0].id,'note','POS notes load where they are displayed');
  await act(async()=>r.root.findByType(m.Header).props.onSwitchStore('small'));
  assert.ok(live('purchases').every(c=>c.q.filters.some(f=>f.field==='storeId'&&f.value==='small')));assert.equal(screen('PosView').props.purchases.length,0);
  assert.equal(screen('PosView').props.giftVouchers.length,0);assert.equal(screen('PosView').props.dailyNotes.length,0);
  await navigate(m.View.DASHBOARD);assert.equal(live('purchases').length,0);assert.equal(live('giftVouchers').length,0);
 }finally{if(r)await act(async()=>r.unmount());await m.cleanup();restore()}
});
