import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {build} from 'esbuild';
import React from 'react';
import {create,act} from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

test('indexed UI advances to page two and lists a crossing before its detail is loaded',async()=>{
 const dir=await mkdtemp(fileURLToPath(new URL('./.indexed-ui-',import.meta.url)));
 const old={localStorage:globalThis.localStorage,window:globalThis.window,alert:globalThis.alert};
 globalThis.localStorage={getItem:()=>null,setItem(){}};globalThis.window={confirm:()=>true};globalThis.alert=()=>{};
 let renderer;
 try {
  const result=await build({bundle:true,write:false,format:'esm',platform:'node',external:['react','react-dom'],stdin:{contents:`export {default as Screen} from './components/FinancialReconciliationView';`,resolveDir:process.cwd()},plugins:[{name:'indexed-ui-fixtures',setup(b){
   b.onResolve({filter:/(tenantWrites|useFinancialLedger|useCompanyCollection)$|^(firebase\/firestore|\.\.\/firebase)$/},a=>({path:a.path.split('/').at(-1),namespace:'fixture'}));
   b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:
    a.path==='tenantWrites'?`export const assertTenantData=()=>{};export const createTenantWriter=()=>({registerNew(){}});`:
    a.path==='useCompanyCollection'?`export function useCompanyCollection(){}`:
    a.path==='useFinancialLedger'?`
     import {useState,useEffect} from 'react';export const LEDGER_PAGE_SIZE=50;
     const records=Array.from({length:100},(_,i)=>({id:'row'+i,companyId:'bombon',storeId:'metro',accountType:'cash',amount:10,date:'2026-10-01T12:00:00-05:00',type:'income_manual',description:'Fila '+i,registeredBy:'Prueba'}));
     export function useFinancialLedger({setRows}){const [rows,setRowsLoaded]=useState(records.slice(0,50));useEffect(()=>setRows(rows),[setRows,rows]);return {indexed:true,summary:{accounts:{cash:1000},peers:{divino:{total:-100,cash:-100,qr:0,count:20}}},globals:{},accountRows:rows,peerRows:[],hasMore:rows.length===50,reading:false,error:'',accountNewerTotal:0,loadMore:async()=>setRowsLoaded(records),peerHasMore:()=>false,peerLoading:()=>false,loadPeerPage:async()=>{}}}
    `:
    a.path==='firestore'?`export const collection=()=>{},query=()=>{},where=()=>{},onSnapshot=()=>()=>{},doc=()=>{};`:
    `export const db={};`
   }));
  }}]});
  const path=join(dir,'screen.mjs');await writeFile(path,result.outputFiles[0].text);const {Screen}=await import(pathToFileURL(path).href);
  const props={companyId:'bombon',isAdmin:true,stores:[{id:'metro',companyId:'bombon',name:'Metro'},{id:'divino',companyId:'bombon',name:'Divino'}],activeStoreId:'metro',sales:[],layaways:[],expenses:[],incidents:[],currentUser:{id:'qa',name:'Prueba',storeId:'metro'},onAddExpense(){}};
  await act(async()=>{renderer=create(React.createElement(Screen,props))});
  const buttons=()=>renderer.root.findAllByType('button');
  const button=label=>buttons().find(b=>b.children.some(c=>typeof c==='string'&&c===label));
  await act(async()=>button('Siguiente').props.onClick());
  const text=node=>node==null?'':typeof node==='string'?node:Array.isArray(node)?node.map(text).join(''):(node.children||[]).map(text).join('');
  const rendered=text(renderer.toJSON());assert.ok(rendered.includes('Página 2'),'loading another page must not reset navigation to page one');assert.ok(rendered.includes('Fila 50'));assert.equal(rendered.includes('Fila 0'),false);
  const modal=buttons().find(b=>b.props.title==='Abrir modal detallado de intercambios');assert.ok(modal);
  await act(async()=>modal.props.onClick({stopPropagation(){}}));
  assert.match(JSON.stringify(renderer.toJSON()),/Ver movimientos/);assert.doesNotMatch(JSON.stringify(renderer.toJSON()),/No hay movimientos de intercambio encontrados/);
 }finally{if(renderer)await act(async()=>renderer.unmount());Object.assign(globalThis,old);await rm(dir,{recursive:true,force:true});}
});
