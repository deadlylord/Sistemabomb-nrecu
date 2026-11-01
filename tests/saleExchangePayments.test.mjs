import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import React from 'react';
import {create,act} from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
async function fixture(run){
 const dir=await mkdtemp(join(process.cwd(),'tests/.exchange-payments-'));let renderer;const connections=[];
 globalThis.__exchangeWatch=(q,apply,error)=>{const c={q,apply,error,closed:false};connections.push(c);return()=>{c.closed=true;}};
 try{
 const bundle=await build({entryPoints:['services/useSaleExchangePayments.ts'],bundle:true,write:false,format:'esm',platform:'node',external:['react'],plugins:[{name:'scoped-firestore',setup(b){b.onResolve({filter:/^(\.\.\/firebase|\.\/measuredFirestore)$/},a=>({path:a.path,namespace:'fake'}));b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:a.path==='../firebase'?'export const db={};':`export const collection=(_,name)=>({name});export const where=(field,op,value)=>({field,op,value});export const query=(base,...filters)=>({...base,filters});export const onSnapshot=(q,next,error)=>globalThis.__exchangeWatch(q,next,error);`}));}}]});
 const path=join(dir,'hook.mjs');await writeFile(path,bundle.outputFiles[0].text);const {useSaleExchangePayments}=await import(pathToFileURL(path).href);let state;
 function View(props){state=useSaleExchangePayments(props.sale,props.enabled);return null;}
 const sale={id:'sale',companyId:'a',storeId:'a1'};
 const render=async props=>act(async()=>{if(renderer)renderer.update(React.createElement(View,props));else renderer=create(React.createElement(View,props));});
 await run({connections,sale,render,get state(){return state},emit:async(c,rows)=>act(async()=>c.apply({docs:rows.map(row=>({data:()=>row}))}))});
 }finally{if(renderer)await act(async()=>renderer.unmount());delete globalThis.__exchangeWatch;assert.ok(connections.every(c=>c.closed));await rm(dir,{recursive:true,force:true});}
}
const incident={companyId:'a',storeId:'a1',originalSaleId:'sale',type:'Cambio de Producto',status:'Cambio Procesado',adjustmentAmount:55000,paymentMethod:'Sistecredito'};
test('exchange lookup only opens with editor and scopes by company, store and invoice',()=>fixture(async f=>{
 await f.render({sale:f.sale,enabled:false});assert.equal(f.connections.length,0);
 await f.render({sale:f.sale,enabled:true});const c=f.connections[0];assert.deepEqual(c.q.filters.map(x=>[x.field,x.value]),[['companyId','a'],['storeId','a1'],['originalSaleId','sale']]);
 assert.equal(f.state.ready,false);await f.emit(c,[incident,{...incident,status:'Cambio Solicitado',adjustmentAmount:999}]);assert.equal(f.state.amount,55000);assert.equal(f.state.ready,true);
 await f.render({sale:f.sale,enabled:false});assert.equal(c.closed,true);
}));
test('changing tenant discards old totals and ignores late snapshots',()=>fixture(async f=>{
 await f.render({sale:f.sale,enabled:true});const first=f.connections[0];await f.emit(first,[incident]);assert.equal(f.state.amount,55000);
 await f.render({sale:{id:'other',companyId:'b',storeId:'b1'},enabled:true});assert.equal(first.closed,true);assert.equal(f.state.ready,false);assert.equal(f.state.amount,0);
 await f.emit(first,[incident]);assert.equal(f.state.ready,false);await f.emit(f.connections[1],[]);assert.equal(f.state.ready,true);assert.equal(f.state.amount,0);
}));
test('foreign records and failed queries never become a zero ready to save',()=>fixture(async f=>{
 await f.render({sale:f.sale,enabled:true});const c=f.connections[0];await f.emit(c,[{...incident,companyId:'foreign'}]);assert.equal(f.state.ready,false);assert.ok(f.state.error);
 await act(async()=>c.error(Error('permission denied')));assert.equal(f.state.ready,false);assert.ok(f.state.error);
}));
