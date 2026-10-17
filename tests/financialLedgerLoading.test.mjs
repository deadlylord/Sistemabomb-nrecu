import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { build } from 'esbuild';
import React from 'react';
import {create,act} from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const fake = `
 export const data=new Map(),connections=[],requests=[];
 export const doc=(_,path)=>({path});export const collection=(_,path)=>({path});
 export const where=(field,op,value)=>({type:'where',field,op,value}),orderBy=(field,direction)=>({type:'order',field,direction}),limit=value=>({type:'limit',value}),startAfter=value=>({type:'cursor',value});
 export const query=(source,...constraints)=>({source,constraints});
 const snap=ref=>({id:ref.path.split('/').at(-1),exists:()=>data.has(ref.path),data:()=>data.get(ref.path)});
 const rows=q=>{let docs=[...data].filter(([path])=>path.startsWith(q.source.path+'/')&&!path.slice(q.source.path.length+1).includes('/')).map(([path])=>snap({path}));for(const c of q.constraints){if(c.type==='where')docs=docs.filter(d=>d.data()[c.field]===c.value);if(c.type==='order')docs.sort((a,b)=>(c.direction==='desc'?-1:1)*((a.data()[c.field]||0)-(b.data()[c.field]||0)));if(c.type==='cursor')docs=docs.slice(docs.findIndex(d=>d.id===c.value.id)+1);if(c.type==='limit')docs=docs.slice(0,c.value)}return {docs,size:docs.length,docChanges:()=>docs.map(doc=>({type:'added',doc}))}};
 export const getDoc=async ref=>snap(ref),getDocs=async q=>{requests.push(q);return rows(q)};export const sum=field=>field;export const getAggregateFromServer=async()=>({data:()=>({amount:0})});
 export const onSnapshot=(q,apply)=>{const c={q,closed:false,emit:()=>{if(!c.closed)apply(q.source?rows(q):snap(q))}};connections.push(c);queueMicrotask(c.emit);return()=>{c.closed=true}};
`;
async function withHook(indexed,run){
 const dir=await mkdtemp(fileURLToPath(new URL('./.ledger-load-',import.meta.url)));
 try {
 const result=await build({bundle:true,write:false,format:'esm',platform:'node',external:['react'],define:{'import.meta.env':JSON.stringify({VITE_FINANCIAL_LEDGER_INDEXED:indexed?'true':'false'})},stdin:{contents:`export {useFinancialLedger} from './services/useFinancialLedger';export {data,connections,requests} from 'firebase/firestore';`,resolveDir:process.cwd()},plugins:[{name:'fake',setup(b){
 b.onResolve({filter:/^firebase\/firestore$|^\.\.\/firebase$|tenantWrites$/},a=>({path:a.path.endsWith('tenantWrites')?'tenantWrites':a.path,namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:a.path==='../firebase'?'export const db={}':a.path==='tenantWrites'?`export function assertTenantData(_,r,s){if(r.companyId&&r.companyId!==s.companyId)throw Error('foreign company');for(const id of [r.storeId,r.debtStoreId])if(id&&!s.storeIds.has(id))throw Error('foreign store')}`:fake}));
 }}]});
 const path=join(dir,'hook.mjs');await writeFile(path,result.outputFiles[0].text);await run(await import(pathToFileURL(path).href));
 }finally{await rm(dir,{recursive:true,force:true})}
}

test('legacy finance opens only the active store and keeps authorized inter-store crossings',()=>withHook(false,async({useFinancialLedger,data,connections})=>{
 data.set('financialRecords/cross',{companyId:'bombon',storeId:'metro',debtStoreId:'divino',amount:-10});
 data.set('financialRecords/foreign',{companyId:'mayla',storeId:'metro',amount:100});
 let value,renderer;const outputs=[],setRows=rows=>outputs.push(rows);const storeIds=['metro','divino',...Array.from({length:98},(_,i)=>'s'+i)];
 function Screen({store='metro',company='bombon',scope='carlos:bombon'}){value=useFinancialLedger({companyId:company,storeId:store,storeIds,scopeKey:scope,accountType:'cash',month:'2026-10',showGlobal:false,search:'',rangeStart:'',rangeEnd:'',setRows});return null}
 await act(async()=>{renderer=create(React.createElement(Screen))});
 assert.equal(connections.length,1);assert.equal(connections[0].q.constraints[0].value,'metro');assert.deepEqual(outputs.at(-1).map(r=>r.id),['cross']);
 await act(async()=>renderer.update(React.createElement(Screen,{store:'divino'})));assert.equal(connections[0].closed,true);assert.equal(connections.length,2);assert.deepEqual(outputs.at(-1),[]);
 await act(async()=>renderer.unmount());assert.ok(connections.every(c=>c.closed));
}));

test('monthly detail subscribes only while closures are open and unsubscribes on close',()=>withHook(true,async({useFinancialLedger,data,connections})=>{
 const root='financialLedgerCompanies/bombon/stores/metro';
 data.set(root,{companyId:'bombon',storeId:'metro',schemaVersion:1,ready:true,accounts:{},peers:{},count:1000,revision:1});
 for(let i=0;i<1000;i++)data.set(root+'/months/2026-10/entries/'+i,{companyId:'bombon',storeId:'metro',accountType:'cash',amount:10,ledgerTime:i});
 let renderer;const setRows=()=>{};
 function Screen({open=false}){useFinancialLedger({companyId:'bombon',storeId:'metro',storeIds:['metro'],scopeKey:'carlos:bombon',accountType:'cash',month:'2026-10',showGlobal:false,showClosures:open,search:'',rangeStart:'',rangeEnd:'',setRows});return null}
 await act(async()=>{renderer=create(React.createElement(Screen))});
 assert.equal(connections.some(c=>c.q.source?.path===root+'/months/2026-10/entries'),false);
 await act(async()=>renderer.update(React.createElement(Screen,{open:true})));
 const detail=connections.find(c=>c.q.source?.path===root+'/months/2026-10/entries');assert.ok(detail);assert.equal(detail.closed,false);
 await act(async()=>renderer.update(React.createElement(Screen,{open:false})));assert.equal(detail.closed,true);
 await act(async()=>renderer.unmount());
}));

test('crossing detail pages by 50, excludes other stores, and full export does not grow displayed rows',()=>withHook(true,async({useFinancialLedger,data,requests})=>{
 const root='financialLedgerCompanies/bombon/stores/metro';
 data.set(root,{companyId:'bombon',storeId:'metro',schemaVersion:1,ready:true,accounts:{cash:10000},peers:{divino:{total:10000,cash:10000,qr:0,count:1000}},count:1000,revision:1});
 for(let i=0;i<1000;i++)data.set(root+'/peers/divino/entries/'+i,{companyId:'bombon',storeId:'metro',debtStoreId:'divino',accountType:'cash',amount:10,ledgerTime:i});
 let value,renderer;const setRows=()=>{};
 function Screen(){value=useFinancialLedger({companyId:'bombon',storeId:'metro',storeIds:['metro','divino',...Array.from({length:98},(_,i)=>'s'+i)],scopeKey:'carlos:bombon',accountType:'cash',month:'2026-10',showGlobal:false,search:'',rangeStart:'',rangeEnd:'',setRows});return null}
 await act(async()=>{renderer=create(React.createElement(Screen))});assert.equal(requests.length,0);
 await act(async()=>value.loadPeerPage('foreign'));assert.equal(requests.length,0);
 await act(async()=>value.loadPeerPage('divino'));assert.equal(value.peerRows.length,50);assert.equal(value.peerHasMore('divino'),true);
 assert.equal(requests.at(-1).constraints.find(c=>c.type==='limit').value,50);
 await act(async()=>value.loadPeerPage('divino',true));assert.equal(value.peerRows.length,100);assert.equal(new Set(value.peerRows.map(r=>r.id)).size,100);
 const exported=await value.readPeer('divino');assert.equal(exported.length,1000);assert.equal(value.peerRows.length,100);
 await act(async()=>renderer.unmount());
}));
test('verified index loads summaries plus a 50-row account page without opening historic source listeners',()=>withHook(true,async({useFinancialLedger,data,connections})=>{
 const root='financialLedgerCompanies/bombon/stores/metro';data.set(root,{companyId:'bombon',storeId:'metro',schemaVersion:1,ready:true,accounts:{cash:10000},peers:{},count:1000,revision:1});
 for(let i=0;i<100;i++)data.set(root+'/accounts/cash/entries/'+i,{companyId:'bombon',storeId:'metro',accountType:'cash',amount:10,date:'2026-10-01T12:00:00-05:00',ledgerTime:i});
 let value,renderer;const outputs=[],setRows=rows=>outputs.push(rows);
 function Screen(){value=useFinancialLedger({companyId:'bombon',storeId:'metro',storeIds:['metro','divino',...Array.from({length:98},(_,i)=>'s'+i)],scopeKey:'carlos:bombon',accountType:'cash',month:'2026-10',showGlobal:false,search:'',rangeStart:'',rangeEnd:'',setRows});return null}
 await act(async()=>{renderer=create(React.createElement(Screen))});
 assert.equal(value.indexed,true);assert.equal(value.summary.accounts.cash,10000);assert.equal(value.accountRows.length,50);assert.equal(value.hasMore,true);
 assert.equal(connections.some(c=>c.q.source?.path==='financialRecords'),false,'do not load full history while waiting for the summary');
 assert.equal(connections.some(c=>c.q.path?.includes('divino')),false);
 assert.equal(connections.some(c=>c.q.source?.path===root+'/months/2026-10/entries'),false,'monthly details remain closed until requested');
 await act(async()=>renderer.unmount());assert.ok(connections.every(c=>c.closed));
}));
