import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { build } from 'esbuild';
import React from 'react';
import { create, act } from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('ledger renders 50 of 5,000 rows with full balances, blocks double save and retains a rejected draft', async () => {
 const dir=await mkdtemp(fileURLToPath(new URL('./.finance-ui-',import.meta.url)));
 const old={localStorage:globalThis.localStorage,window:globalThis.window,alert:globalThis.alert};
 const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};globalThis.window={confirm:()=>true};globalThis.alert=()=>{};
 let renderer;
 try {
  const bundle=await build({bundle:true,write:false,format:'esm',platform:'node',external:['react'],stdin:{contents:`export {default as Screen} from './components/FinancialReconciliationView';export {batches} from './services/tenantWrites';`,resolveDir:process.cwd()},plugins:[{name:'finance-fixtures',setup(b){
   b.onResolve({filter:/(tenantWrites|useFinancialLedger|useCompanyCollection)$|^(firebase\/firestore|\.\.\/firebase)$/},a=>({path:/(tenantWrites|useFinancialLedger|useCompanyCollection)$/.test(a.path)?a.path.split('/').at(-1):a.path,namespace:'fixture'}));
   b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:
    a.path.endsWith('tenantWrites')?`export const batches=[];export const assertTenantData=()=>{};export function createTenantWriter(){return {registerNew(){},writeBatch(){const operations=[];const b={set:(ref,data)=>{operations.push({ref,data});return b},delete(){return b},update(){return b},commit:()=>new Promise((resolve,reject)=>batches.push({operations,resolve,reject}))};return b}}}`:
    a.path.endsWith('useFinancialLedger')?`import {useEffect} from 'react';export const LEDGER_PAGE_SIZE=50;const records=Array.from({length:5000},(_,i)=>({id:String(i).padStart(5,'0'),companyId:'bombon',storeId:'metro',date:'2026-10-01T12:00:00-05:00',amount:10,accountType:'cash',description:'Venta '+i,type:'income_manual',registeredBy:'Carlos'}));export function useFinancialLedger({setRows}){useEffect(()=>setRows(records),[setRows]);return {indexed:false,globals:{},reading:false,hasMore:false,error:''}}`:
    a.path.endsWith('useCompanyCollection')?'export function useCompanyCollection(){}':
    a.path==='../firebase'?'export const db={}':
    `export const collection=(_,name)=>({name});export const doc=(...args)=>args.length===1?{id:crypto.randomUUID(),path:args[0].name+'/random'}:{id:args[2],path:args[1]+'/'+args[2]};export const query=()=>{},where=()=>{},onSnapshot=()=>()=>{};`
   }));
  }}]});
  const path=join(dir,'screen.mjs');await writeFile(path,bundle.outputFiles[0].text);const {Screen,batches}=await import(pathToFileURL(path).href);
  const props={companyId:'bombon',isAdmin:true,stores:[{id:'metro',companyId:'bombon',name:'Metro'},{id:'divino',companyId:'bombon',name:'Divino'}],activeStoreId:'metro',sales:[],layaways:[],expenses:[],incidents:[],currentUser:{id:'carlos',name:'Carlos',storeId:'metro'},onAddExpense:()=>{}};
  await act(async()=>{renderer=create(React.createElement(Screen,props))});
  const rows=()=>renderer.root.findAllByType('tr').filter(r=>(r.props.className || '').includes('cursor-pointer'));
  assert.equal(rows().length,50);
  assert.match(JSON.stringify(renderer.toJSON()),/50[. ,]?000/,'balance includes every historical row, not just the 50 rendered');
  const button=label=>renderer.root.findAllByType('button').find(b=>b.children.some(c=>typeof c==='string'&&c.includes(label)));
  await act(async()=>{renderer.root.findByProps({'aria-label':'Agregar movimiento'}).props.onClick()});
  const input=placeholder=>renderer.root.findAllByType('input').find(i=>i.props.placeholder===placeholder);
  await act(async()=>{input('Monto $').props.onChange({target:{value:'200'}});input('Concepto...').props.onChange({target:{value:'Prueba'}})});
  let first;
  await act(async()=>{first=button('PROCESAR LOTE').props.onClick();button('PROCESAR LOTE').props.onClick();await Promise.resolve()});
  assert.equal(batches.length,1);assert.match(JSON.stringify(renderer.toJSON()),/GUARDANDO/);assert.match(JSON.stringify(renderer.toJSON()),/Ingresar Lote/);
  await act(async()=>{batches[0].reject(Object.assign(new Error('Sin conexión'), { code: 'permission-denied' }));await first});
  const feedback = renderer.root.findByProps({'data-testid':'manual-entry-save-feedback'});
  assert.equal(feedback.props.role, 'alert');
  assert.match(feedback.children.join(''), /Sin conexión/);
  assert.match(feedback.children.join(''), /permission-denied/);
  assert.match(JSON.stringify(renderer.toJSON()),/Sin conexión/);assert.equal(input('Concepto...').props.value,'Prueba');
  let retry;await act(async()=>{retry=button('PROCESAR LOTE').props.onClick();await Promise.resolve()});
  assert.equal(batches.length,2);assert.equal(batches[0].operations[0].ref.path,batches[1].operations[0].ref.path,'retry retains the same financial document ID');
  await act(async()=>{batches[1].resolve();await retry});assert.doesNotMatch(JSON.stringify(renderer.toJSON()),/Ingresar Lote/);assert.match(JSON.stringify(renderer.toJSON()),/Movimientos confirmados/);
  await act(async()=>renderer.unmount());renderer=null;
 } finally {if(renderer)await act(async()=>renderer.unmount());Object.assign(globalThis,old);await rm(dir,{recursive:true,force:true})}
});
