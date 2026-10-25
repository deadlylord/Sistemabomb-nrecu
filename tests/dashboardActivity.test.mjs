import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {create,act} from 'react-test-renderer';
import {developerSession,browserGlobals} from './helpers/developerSession.mjs';
import {activityProjection,activityBucket,activityMonth} from '../functions/src/dashboardActivity.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('monthly activity includes old payments and pending work but excludes resolved nonfinancial history',()=>{
 assert.equal(activityMonth('2026-10-01'),'2026-09');assert.equal(activityMonth('2026-10-01T01:00:00'),'2026-10');
 const value=activityProjection('layaways',{createdAt:'2020-01-02',status:'cancelled',payments:[{date:'2026-10-02',method:'Bono de Regalo'}],notes:'private editor detail'});
 assert.deepEqual(value.months,['2020-01','2026-10']);assert.ok(!('notes'in value.record));
 assert.deepEqual(activityProjection('incidents',{type:'Prenda Dañada',status:'Devuelto y Resuelto',createdAt:'2026-10-02'}).months,[]);
 assert.deepEqual(activityProjection('incidents',{type:'Garantía',status:'Garantía Activa',createdAt:'2020-01-02'}).months,['pending']);
});
test('dashboard reads monthly activity without raw history, retains old payments, original editing and operational navigation',async()=>{
 const restore=browserGlobals(),m=await developerSession({summaries:true,monthlySales:true,activitySummary:true});let r;
 try{
  const company={id:'a'},store={id:'one',companyId:'a',name:'One',accentColorsUpdated:true},role={id:'r',companyId:'a',name:'Administrador',userType:'admin',permissions:Object.values(m.View).filter(v=>v!==m.View.DEVELOPER_CENTER)},user={id:'u',companyId:'a',storeId:'one',roleId:'r',name:'User'};
  const month=activityMonth(new Date().toISOString()),root='businessSummaryCompanies/a/stores/one',source={id:'old',companyId:'a',storeId:'one',status:'active',createdAt:'2020-01-02',payments:[{date:new Date().toISOString(),method:'QR',amount:5000}],items:[],notes:'Fresh full original'};
  for(const [name,rows] of Object.entries({companies:[company],stores:[store],roles:[role],sellers:[user],inventory:[],sales:[],layaways:[source,{...source,id:'unneeded-old',payments:[]}],incidents:[{id:'old-closed',companyId:'a',storeId:'one',createdAt:'2020-01-02',type:'Prenda Dañada',status:'Devuelto y Resuelto'}]}))m.records.set(name,rows);
  m.records.set(root,[{id:'new-id',companyId:'a',storeId:'one',ready:true,schemaVersion:1,paymentIndexVersion:1,dashboardActivityVersion:1,dashboardActivityMonths:{'2020-01':2}}]);
  const data=activityProjection('layaways',source).record;
  const warranty={id:'old-warranty',companyId:'a',storeId:'one',createdAt:'2020-01-02',type:'Garantía',status:'Garantía Activa'};m.records.set('incidents',[...m.records.get('incidents'),warranty]);
  m.records.set(root+'/dashboardActivity',[{id:activityBucket('layaways','old',month),month,kind:'layaways',companyId:'a',storeId:'one',schemaVersion:1,payload:JSON.stringify({old:{version:'100:000000000',data}})},{id:'pending__incidents__1',month:'pending',kind:'incidents',companyId:'a',storeId:'one',schemaVersion:1,payload:JSON.stringify({'old-warranty':{version:'100:000000000',data:activityProjection('incidents',warranty).record}})}]);
  await act(async()=>{r=create(React.createElement(m.App,{initialSession:{user,role,company,store}}))});
  const screen=()=>r.root.findByProps({screen:'DashboardView'});
  assert.deepEqual(screen().props.layaways.map(v=>v.id),['old']);assert.equal(screen().props.layaways[0].payments[0].amount,5000);assert.ok(r.root.findByType(m.Header).props.incidents.some(i=>i.id==='old-warranty'),'old pending badges survive monthly loading');
  assert.ok(!m.connections.some(c=>['incidents','layaways'].includes(c.q.name)),'no provisional full-source query during metadata loading');
  assert.deepEqual(screen().props.activityMonths,['2020-01']);const original=await screen().props.onResolveLayaway('old');assert.equal(original.notes,'Fresh full original');
  await act(async()=>r.root.findByType(m.Header).props.setCurrentView(m.View.LAYAWAY));
  assert.equal(r.root.findByProps({screen:'LayawayView'}).props.layaways.length,2,'operational page retains full source history');
  assert.ok(m.connections.some(c=>!c.closed&&c.q.name==='incidents'));
  await act(async()=>r.root.findByType(m.Header).props.setCurrentView(m.View.DASHBOARD));
  assert.equal(m.connections.filter(c=>!c.closed&&['incidents','layaways'].includes(c.q.name)).length,0);
  const bad=m.connections.find(c=>!c.closed&&c.q.name===root+'/dashboardActivity');await act(async()=>bad.error(new Error('network')));
  assert.equal(screen().props.layaways.length,2,'a read-model error retains the complete working source route');
  assert.ok(m.connections.some(c=>!c.closed&&c.q.name==='layaways'));
 }finally{if(r)await act(async()=>r.unmount());await m.cleanup();restore();}
});
