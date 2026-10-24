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
