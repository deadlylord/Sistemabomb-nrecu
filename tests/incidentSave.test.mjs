import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import React from 'react';
import {create,act} from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

test('incident form waits for confirmation, prevents duplicate submissions and preserves input after a failed save',async()=>{
 const dir=await mkdtemp(join(process.cwd(),'tests/.incident-save-'));let renderer;
 try{
 const bundle=await build({entryPoints:['components/CreateIncidentModal.tsx'],bundle:true,write:false,format:'esm',platform:'node',external:['react'],plugins:[{name:'firebase-stub',setup(b){b.onResolve({filter:/^(firebase\/firestore|\.\.\/firebase)$/},a=>({path:a.path,namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:a.path==='../firebase'?'export const db={};':'export const doc=()=>{},collection=()=>{},writeBatch=()=>{};'}));}}]});
 const path=join(dir,'modal.mjs');await writeFile(path,bundle.outputFiles[0].text);const {default:Modal}=await import(pathToFileURL(path).href);
 let closed=0,calls=0,rejectSave;let succeed=false;
 const props={isOpen:true,onClose:()=>closed++,inventory:[{id:'p',name:'Prenda',stock:5,storeId:'source'}],sales:[],stores:[{id:'source'},{id:'dest'}],currentUser:{id:'u',storeId:'source',roleId:'seller'},roles:[],customers:[],onCreateIncident:()=>{calls++;return succeed?Promise.resolve():new Promise((_,reject)=>rejectSave=reject)}};
 await act(async()=>{renderer=create(React.createElement(Modal,props));});
 await act(async()=>renderer.root.findByProps({placeholder:'Buscar producto dañado...'}).props.onChange({target:{value:'Prenda'}}));
 await act(async()=>renderer.root.findByProps({placeholder:'Buscar producto dañado...'}).props.onFocus());
 await act(async()=>renderer.root.findAllByType('li')[0].props.onMouseDown());
 await act(async()=>renderer.root.findByType('textarea').props.onChange({target:{value:'Descripción que debe conservarse'}}));
 let pending;await act(async()=>{pending=renderer.root.findByType('form').props.onSubmit({preventDefault(){}});});
 assert.equal(closed,0);assert.equal(renderer.root.findByProps({type:'submit'}).props.disabled,true);
 await act(async()=>renderer.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.equal(calls,1);
 const log=console.error;console.error=()=>{};
 try{await act(async()=>{rejectSave(Error('offline'));await pending;});}finally{console.error=log;}
 assert.equal(closed,0);assert.ok(renderer.root.findByProps({role:'alert'}));
 assert.equal(renderer.root.findByType('textarea').props.value,'Descripción que debe conservarse');
 succeed=true;await act(async()=>renderer.root.findByType('form').props.onSubmit({preventDefault(){}}));
 assert.equal(closed,1);assert.equal(calls,2);
 }finally{if(renderer)await act(async()=>renderer.unmount());await rm(dir,{recursive:true,force:true});}
});

test('exchange form persists the actual 180000 price and 55000 Sistecredito surplus instead of catalogue 170000',async()=>{
 const dir=await mkdtemp(join(process.cwd(),'tests/.exchange-price-'));let renderer;
 try{
 const bundle=await build({entryPoints:['components/CreateIncidentModal.tsx'],bundle:true,write:false,format:'esm',platform:'node',external:['react'],plugins:[{name:'firebase-stub',setup(b){b.onResolve({filter:/^(firebase\/firestore|\.\.\/firebase)$/},a=>({path:a.path,namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:a.path==='../firebase'?'export const db={};':'export const doc=()=>{},collection=()=>{},writeBatch=()=>{};'}));}}]});
 const path=join(dir,'modal.mjs');await writeFile(path,bundle.outputFiles[0].text);const {default:Modal}=await import(pathToFileURL(path).href);
 let payload;const inventory=[{id:'new',name:'Nueva',price:170000,cost:80000,stock:5,storeId:'source'}];
 await act(async()=>{renderer=create(React.createElement(Modal,{isOpen:true,onClose(){},inventory,sales:[{id:'sale',invoiceNumber:123,customerName:'Test',items:[{id:'old',name:'Anterior',price:125000,quantity:1,cost:50000}]}],stores:[],currentUser:{id:'u',storeId:'source'},roles:[],customers:[],onCreateIncident:data=>{payload=data}}));});
 await act(async()=>renderer.root.findAllByType('select')[0].props.onChange({target:{value:'Cambio de Producto'}}));
 await act(async()=>renderer.root.findByProps({placeholder:'Número de Factura Original'}).props.onChange({target:{value:'123'}}));
 await act(async()=>renderer.root.findAllByType('select').find(s=>s.props.children?.some?.(c=>Array.isArray(c))).props.onChange({target:{value:'old'}}));
 await act(async()=>renderer.root.findByProps({placeholder:'Buscar en inventario...'}).props.onChange({target:{value:'Nueva'}}));
 await act(async()=>renderer.root.findByProps({placeholder:'Buscar en inventario...'}).props.onFocus());
 await act(async()=>renderer.root.findAllByType('li')[0].props.onMouseDown());
 await act(async()=>renderer.root.findByProps({'aria-label':'Precio cobrado Nueva'}).props.onChange({target:{value:'180000'}}));
 assert.equal(renderer.root.findByProps({id:'manualSurplus'}).props.value,'55000');
 await act(async()=>renderer.root.findAllByType('select').at(-1).props.onChange({target:{value:'Sistecredito'}}));
 await act(async()=>renderer.root.findByType('form').props.onSubmit({preventDefault(){}}));
 assert.equal(payload.takenItems[0].price,180000);assert.equal(payload.returnedItems[0].price,125000);assert.equal(payload.surplusPaid,55000);assert.equal(payload.surplusPaymentMethod,'Sistecredito');assert.equal(inventory[0].price,170000);
 }finally{if(renderer)await act(async()=>renderer.unmount());await rm(dir,{recursive:true,force:true});}
});
