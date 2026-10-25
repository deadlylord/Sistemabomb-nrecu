import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const fake=`export const connections=[];export const doc=(_,name,id)=>({path:name+'/'+id,id});export const collection=(_,path)=>({path}),where=(field,op,value)=>({field,op,value}),query=(base,...filters)=>({...base,filters});export const onSnapshot=(target,next,error)=>{const c={target,next,error,closed:false,emit(rows){next({size:rows.length,docs:rows.map(data=>({id:data.id,data:()=>data})),docChanges:()=>rows.map(doc=>({type:'added',doc})),metadata:{fromCache:false}})}};connections.push(c);return()=>{c.closed=true}};`;
async function fixture(run){
 const dir=await mkdtemp(join(process.cwd(),'tests/.reconciliation-sources-'));let renderer;
 const old={localStorage:globalThis.localStorage,window:globalThis.window};globalThis.localStorage={getItem:()=>null,setItem(){}};globalThis.window={confirm:()=>true};
 try{
 const result=await build({bundle:true,write:false,format:'esm',platform:'node',external:['react','react-dom'],logLevel:'silent',stdin:{contents:`export {default as Screen} from './components/FinancialReconciliationView';export {useReconciliationSources} from './services/useReconciliationSources';export {ViewFiltersProvider} from './services/viewFilters';export * as fake from 'firebase/firestore';`,resolveDir:process.cwd()},plugins:[{name:'sources-fixture',setup(b){b.onResolve({filter:/^(firebase\/firestore|\.\.\/firebase)$|\/(tenantWrites|useFinancialLedger|useCompanyCollection)$/},a=>({path:a.path.split('/').at(-1),namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='firestore'?fake:a.path==='firebase'?'export const db={};':a.path==='tenantWrites'?`export const assertTenantData=()=>{};export const createTenantWriter=()=>({registerNew(){}});`:a.path==='useCompanyCollection'?'export function useCompanyCollection(){}':`export const LEDGER_PAGE_SIZE=50;export function useFinancialLedger(){return {indexed:false,globals:{},reading:false,hasMore:false,error:'',closuresLoading:false}}`}));}}]});
 const path=join(dir,'views.mjs');await writeFile(path,result.outputFiles[0].text);const mod=await import(pathToFileURL(path).href);await run(mod,async element=>{await act(async()=>{if(renderer)renderer.update(element);else renderer=create(element)});return renderer;});
 }finally{if(renderer)await act(async()=>renderer.unmount());Object.assign(globalThis,old);await rm(dir,{recursive:true,force:true})}
}
test('closure source subscriptions are opt-in, store-scoped and reject late/foreign data',()=>fixture(async({useReconciliationSources,fake},render)=>{
 let value;function Probe(props){value=useReconciliationSources('company',props.store,'user:company',props.open);return null}
 await render(React.createElement(Probe,{store:'one',open:false}));assert.equal(fake.connections.length,0);
 await render(React.createElement(Probe,{store:'one',open:true}));assert.equal(fake.connections.length,2);assert.equal(value.loading,true);
 const old=fake.connections.slice();for(const c of old)assert.deepEqual(c.target.filters,[{field:'storeId',op:'==',value:'one'}]);
 await act(async()=>{old[0].emit([{id:'sale',storeId:'one',companyId:'company'},{id:'foreign',storeId:'one',companyId:'other'}]);old[1].emit([{id:'old-layaway',storeId:'one',createdAt:'2020-01-01',payments:[{date:'2026-10-22',amount:100,method:'QR'}]}]);});
 assert.equal(value.sales.length,1);assert.equal(value.layaways.length,1);assert.equal(value.loading,false);
 await render(React.createElement(Probe,{store:'two',open:true}));assert.ok(old.every(c=>c.closed));assert.equal(value.loading,true);assert.equal(value.sales.length,0);
 await act(async()=>old[0].emit([{id:'late',storeId:'one'}]));assert.equal(value.sales.length,0);
 await act(async()=>fake.connections[2].error({code:'permission-denied'}));assert.ok(value.error);
 await render(React.createElement(Probe,{store:'two',open:false}));assert.ok(fake.connections.every(c=>c.closed));assert.equal(value.loading,false);
 await render(React.createElement(Probe,{store:'two',open:true}));assert.equal(value.loading,true);assert.equal(value.error,null);
}));
test('account and closure panel survive store remounts; old layaway payments and commissions remain in closures',()=>fixture(async({Screen,ViewFiltersProvider,fake},render)=>{
 const stores=[{id:'one',companyId:'company',name:'One',paymentCommissions:{QR:.1}},{id:'two',companyId:'company',name:'Two'}];
 const props={companyId:'company',isAdmin:true,stores,currentUser:{id:'user',name:'Test',storeId:'one'},sales:[],layaways:[],expenses:[],incidents:[],onAddExpense(){}};
 const tree=(store,scope='user:company')=>React.createElement(ViewFiltersProvider,{key:scope},React.createElement('main',{key:store},React.createElement(Screen,{...props,activeStoreId:store})));
 let r=await render(tree('one'));assert.equal(fake.connections.length,0);
 await act(async()=>r.root.findByProps({'aria-label':'Cuenta del libro: qr'}).props.onClick());
 await act(async()=>r.root.findByProps({title:'Mostrar Cierres de Caja'}).props.onClick());assert.equal(fake.connections.length,2);
 const emit=(rowsSales=[],rowsLayaways=[])=>{const active=fake.connections.filter(c=>!c.closed);active.find(c=>c.target.path==='sales').emit(rowsSales);active.find(c=>c.target.path==='layaways').emit(rowsLayaways);};
 await act(async()=>emit([], [{id:'old',storeId:'one',companyId:'company',createdAt:'2020-01-01',customerName:'Antiguo',payments:[{date:'2026-10-22T12:00:00-05:00',amount:100,method:'QR'}]}]));
 await act(async()=>r.root.findByProps({'aria-label':'Cuenta de cierres: qr'}).props.onClick());
 const selects=r.root.findAllByType('select');
 await act(async()=>{selects.find(n=>n.children.some(o=>o.props?.value===9)).props.onChange({target:{value:'9'}});selects.find(n=>n.children.some(o=>o.props?.value===2026)).props.onChange({target:{value:'2026'}});});
 const visibleText=node=>node==null?'':typeof node==='string'?node:Array.isArray(node)?node.map(visibleText).join(' '):visibleText(node.children);
 assert.match(visibleText(r.toJSON()),/\$\s*90\b/,'QR net closure applies the store commission to a recent payment on an old layaway');
 await render(tree('two'));assert.equal(r.root.findByProps({'aria-label':'Cuenta del libro: qr'}).props['aria-pressed'],true);assert.match(JSON.stringify(r.toJSON()),/Cargando cierres/);assert.ok(fake.connections.slice(0,2).every(c=>c.closed));
 await act(async()=>emit());assert.equal(r.root.findByProps({'aria-label':'Cuenta de cierres: qr'}).props['aria-pressed'],true);assert.equal(r.root.findAllByProps({title:'Mostrar Cierres de Caja'}).length,0);
 await render(tree('two','other-user:company'));assert.equal(r.root.findByProps({'aria-label':'Cuenta del libro: cash'}).props['aria-pressed'],true);assert.equal(r.root.findAllByProps({title:'Mostrar Cierres de Caja'}).length,1);
}));
