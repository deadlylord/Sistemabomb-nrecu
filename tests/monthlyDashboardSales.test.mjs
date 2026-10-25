import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {developerSession,browserGlobals} from './helpers/developerSession.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('month boundaries use Colombia midnight; history queries separate requested months, while Todo is explicit',async()=>{
 const dir=await mkdtemp(join(process.cwd(),'tests/.month-range-'));try{
 const b=await build({bundle:true,write:false,format:'esm',platform:'node',entryPoints:['services/dashboardSalesRange.ts']});const p=join(dir,'range.mjs');await writeFile(p,b.outputFiles[0].text);const m=await import(pathToFileURL(p).href);
 assert.deepEqual(m.monthRange('2026-10-24'),{start:'2026-10-01T05:00:00.000Z',end:'2026-11-01T05:00:00.000Z'});
 assert.equal(m.dashboardSalesRanges('2026-10-24','2026-10-24','2026-06','','').length,2);
 assert.deepEqual(m.dashboardSalesRanges('','','','',''),[null]);
 assert.equal(m.dashboardSalesRanges('2026-10-24','2026-10-24','2026-10','','').length,1);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('original dashboard loads monthly sales, retains old layaway payments, and previous-month edits remain accessible',async()=>{
 const restore=browserGlobals();const m=await developerSession({summaries:true,verified:true,monthlySales:true});let r;
 try{
 const company={id:'a'},store={id:'one',companyId:'a',name:'One',accentColorsUpdated:true},role={id:'r',companyId:'a',name:'Administrador',userType:'admin',permissions:Object.values(m.View).filter(v=>v!==m.View.DEVELOPER_CENTER)},user={id:'u',companyId:'a',storeId:'one',roleId:'r',name:'User'};
 const date=new Date(),prefix=date.toISOString().slice(0,7),current={id:'current',companyId:'a',storeId:'one',createdAt:prefix+'-15T12:00:00.000Z'};
 for(const [name,rows] of Object.entries({companies:[company],stores:[store],roles:[role],sellers:[user],inventory:[],sales:[current,{...current,id:'old',createdAt:'2020-01-15T12:00:00.000Z'}],layaways:[{id:'old-layaway',companyId:'a',storeId:'one',createdAt:'2020-01-01',payments:[{date:date.toISOString(),amount:1000,method:'QR'}]}]}))m.records.set(name,rows);
 await act(async()=>{r=create(React.createElement(m.App,{initialSession:{user,role,company,store}}))});const screen=()=>r.root.findByProps({screen:'DashboardView'});
 assert.equal(r.root.findAllByProps({screen:'BusinessOverview'}).length,0);assert.deepEqual(screen().props.sales.map(s=>s.id),['current']);assert.equal(screen().props.layaways[0].id,'old-layaway');
 const sales=()=>m.connections.filter(c=>!c.closed&&c.q.name==='sales'&&!c.q.id);assert.equal(sales().length,1);assert.ok(sales()[0].q.filters.some(f=>f.field==='createdAt'&&f.op==='>='));
 await act(async()=>screen().props.onSalesRangesChange([{start:'2020-01-01T05:00:00.000Z',end:'2020-02-01T05:00:00.000Z'}]));
 assert.deepEqual(screen().props.sales.map(s=>s.id),['old']);
 await act(async()=>r.root.findByType(m.Header).props.setCurrentView(m.View.POS));assert.equal(sales()[0].q.filters.some(f=>f.field==='createdAt'),false,'POS keeps its full operational source');
 }finally{if(r)await act(async()=>r.unmount());await m.cleanup();restore()}
});

test('month-scoped dashboard includes current payments on older ordinary sales and cleans their listeners on store change',async()=>{
 const restore=browserGlobals();const m=await developerSession({summaries:true,verified:true,monthlySales:true});let r;
 try{
 const company={id:'a'},store={id:'one',companyId:'a',name:'One',accentColorsUpdated:true},role={id:'r',companyId:'a',name:'Administrador',userType:'admin',permissions:Object.values(m.View).filter(v=>v!==m.View.DEVELOPER_CENTER)},user={id:'u',companyId:'a',storeId:'one',roleId:'r',name:'User'};
 const date=new Date(),month=date.toISOString().slice(0,7),payment={date:date.toISOString(),amount:1234,method:'QR'};
 const sale={id:'older-sale',companyId:'a',storeId:'one',createdAt:'2020-01-02',payments:[payment]};
 for(const [name,rows]of Object.entries({companies:[company],stores:[store,{...store,id:'two'}],roles:[role],sellers:[user],inventory:[],sales:[sale],layaways:[]}))m.records.set(name,rows);
 m.records.set('businessSummaryCompanies/a/stores/one/paymentSalesByMonth',[{id:month+'__older-sale',companyId:'a',storeId:'one',month,saleId:sale.id}]);
 await act(async()=>{r=create(React.createElement(m.App,{initialSession:{user,role,company,store}}))});
 const screen=()=>r.root.findByProps({screen:'DashboardView'});
 assert.deepEqual(screen().props.sales.map(s=>s.id),['older-sale']);assert.equal(screen().props.sales[0].payments[0].amount,1234);
 const point=m.connections.find(c=>!c.closed&&c.q.name==='sales'&&c.q.id==='older-sale');assert.ok(point);
 await act(async()=>r.root.findByType(m.Header).props.onSwitchStore('two'));
 assert.equal(point.closed,true);assert.deepEqual(screen().props.sales,[]);
 point.apply({exists:()=>true,data:()=>sale});await act(async()=>{});assert.deepEqual(screen().props.sales,[]);
 }finally{if(r)await act(async()=>r.unmount());await m.cleanup();restore()}
});

test('production month filtering falls back to full sales until its historical-payment index is verified',async()=>{
 const restore=browserGlobals();const m=await developerSession({summaries:true,verified:true,monthlySales:true,paymentIndex:true});let r;
 try{
 const company={id:'a'},store={id:'one',companyId:'a',name:'One',accentColorsUpdated:true},role={id:'r',companyId:'a',name:'Administrador',userType:'admin',permissions:Object.values(m.View).filter(v=>v!==m.View.DEVELOPER_CENTER)},user={id:'u',companyId:'a',storeId:'one',roleId:'r',name:'User'};
 for(const [name,rows]of Object.entries({companies:[company],stores:[store],roles:[role],sellers:[user],inventory:[],sales:[{id:'older-sale',companyId:'a',storeId:'one',createdAt:'2020-01-02',payments:[{date:new Date().toISOString(),amount:1234,method:'QR'}]}],layaways:[]}))m.records.set(name,rows);
 await act(async()=>{r=create(React.createElement(m.App,{initialSession:{user,role,company,store}}))});
 const screen=r.root.findByProps({screen:'DashboardView'});
 assert.deepEqual(screen.props.sales.map(s=>s.id),['older-sale']);
 const q=m.connections.find(c=>!c.closed&&c.q.name==='sales'&&!c.q.id);assert.ok(q);assert.equal(q.q.filters.some(f=>f.field==='createdAt'),false);
 }finally{if(r)await act(async()=>r.unmount());await m.cleanup();restore()}
});


test('production waits for summary metadata without opening a full-history sales listener',async()=>{
 const restore=browserGlobals();const m=await developerSession({summaries:true,verified:true,monthlySales:true,paymentIndex:true});let r;
 try{
 const company={id:'a'},store={id:'one',companyId:'a',name:'One',accentColorsUpdated:true},role={id:'r',companyId:'a',name:'Administrador',userType:'admin',permissions:Object.values(m.View).filter(v=>v!==m.View.DEVELOPER_CENTER)},user={id:'u',companyId:'a',storeId:'one',roleId:'r',name:'User'};
 for(const [name,rows]of Object.entries({companies:[company],stores:[store],roles:[role],sellers:[user],inventory:[],sales:[],layaways:[]}))m.records.set(name,rows);
 const root='businessSummaryCompanies/a/stores/one';m.deferredSnapshots.add(root);
 await act(async()=>{r=create(React.createElement(m.App,{initialSession:{user,role,company,store}}))});
 assert.equal(m.connections.some(c=>c.q.name==='sales'),false,'pending metadata must not download the entire sales history');
 const metadata=m.connections.find(c=>c.q.name===root);assert.ok(metadata);
 await act(async()=>metadata.apply({exists:()=>true,data:()=>({companyId:'a',storeId:'one',schemaVersion:1,ready:true,paymentIndexVersion:1}),metadata:{fromCache:false}}));
 const sales=m.connections.filter(c=>c.q.name==='sales'&&!c.q.id);assert.ok(sales.length);assert.ok(sales.every(c=>c.q.filters.some(f=>f.field==='createdAt')),'verified summaries start only range-filtered sales');
 }finally{if(r)await act(async()=>r.unmount());await m.cleanup();restore()}
});
