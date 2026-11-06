import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import React from 'react';
import {create,act} from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const storage = new Map();globalThis.sessionStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const dir=await mkdtemp(process.cwd()+'/tests/.warehouse-ui-');
const b=await build({entryPoints:['components/WarehousePanel.tsx'],bundle:true,write:false,format:'esm',platform:'node',external:['react'],plugins:[{name:'api-stub',setup(b){b.onResolve({filter:/services\/warehouse$/},()=>({path:'api',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const callWarehouse = async () => {throw Error("Unexpected default API")};'}))}}]});
await writeFile(dir+'/ui.mjs',b.outputFiles[0].text);const {default:Panel}=await import(pathToFileURL(dir+'/ui.mjs').href);
const props={userId:'u',companyId:'co',store:{id:'st',companyId:'co',name:'Tienda'},inventory:[{id:'p',companyId:'co',storeId:'st',name:'Blusa',stock:6}],categories:[{id:'cat',name:'Blusas'}],isAdmin:false,onClose(){}};
const button=(r,label)=>r.root.findAllByType('button').find(b=>b.children.join('')===label);
test('warehouse opens summary only; eyes load category on demand; save keeps store scope and revision',async()=>{
 storage.clear();const calls=[];const api=async(co,st,data)=>{calls.push([co,st,data]);return data.action==='summary'?{rows:[{id:'cat',stock:4,revision:1}]}:data.action==='products'?{rows:[{id:'p',name:'Blusa',supplier:'Marca',stock:4}],cursor:null}:data.action==='draft'?{draft:null}:{id:'saved'}};let r;
 await act(async()=>{r=create(React.createElement(Panel,{...props,api}));});
 try {assert.deepEqual(calls.map(c=>c[2].action),['summary']);
 await act(async()=>r.root.findByProps({'aria-label':'Verificar marcas Blusas'}).props.onClick());
 assert.deepEqual(calls.map(c=>c[2].action),['summary','products','draft']);
 await act(async()=>r.root.findByProps({'aria-label':'Conteo Blusas'}).props.onChange({target:{value:'3'}}));
 await act(async()=>button(r,'Guardar conteo de bodega').props.onClick());
 const saved=calls.find(c=>c[2].action==='count');assert.deepEqual(saved.slice(0,2),['co','st']);assert.deepEqual(saved[2].entries,[{categoryId:'cat',revision:1,physicalCount:3}]);assert.ok(saved[2].operationId);
 assert.equal(button(r,'Aplicar ajuste por productos'),undefined);
 }finally{await act(async()=>r.unmount())}
});
test('movement keeps the same operation after lost acknowledgement and blocks duplicate submissions',async()=>{
 storage.clear();let attempts=[],fail=true,release;const api=async(co,st,data)=>{if(data.action==='summary')return {rows:[]};attempts.push(data);if(fail)throw Error('Sin conexión');return new Promise(resolve=>{release=resolve})};let r;
 await act(async()=>{r=create(React.createElement(Panel,{...props,api}));});
 try{await act(async()=>button(r,'Mover mercancía').props.onClick());
 const selects=r.root.findAllByType('select');await act(async()=>selects[1].props.onChange({target:{value:'p'}}));
 const units=r.root.findAllByType('input').find(n=>n.props.type==='number');await act(async()=>units.props.onChange({target:{value:'2'}}));
 await act(async()=>r.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.match(JSON.stringify(r.toJSON()),/Sin conexión/);
 fail=false;await act(async()=>{r.root.findByType('form').props.onSubmit({preventDefault(){}})});
 await act(async()=>{r.root.findByType('form').props.onSubmit({preventDefault(){}})});
 assert.equal(attempts.length,2);assert.equal(attempts[0].operationId,attempts[1].operationId);assert.equal(button(r,'Cerrar').props.disabled,true);
 await act(async()=>release({id:'ok'}));assert.equal(button(r,'Cerrar').props.disabled,false);
 }finally{await act(async()=>r.unmount())}
});
test('reopening panel recovers an unacknowledged operation without creating another ID',async()=>{
 storage.clear();let failed=true,requests=[];const api=async(c,s,data)=>{if(data.action==='summary')return {rows:[]};requests.push(data);if(failed)throw Error('Sin conexión');return {id:'saved'}};let r;
 await act(async()=>{r=create(React.createElement(Panel,{...props,api}));});
 await act(async()=>button(r,'Mover mercancía').props.onClick());
 await act(async()=>r.root.findAllByType('select')[1].props.onChange({target:{value:'p'}}));
 await act(async()=>r.root.findAllByType('input').find(n=>n.props.type==='number').props.onChange({target:{value:'2'}}));
 await act(async()=>r.root.findByType('form').props.onSubmit({preventDefault(){}}));
 await act(async()=>r.unmount());failed=false;
 await act(async()=>{r=create(React.createElement(Panel,{...props,api}));});
 try{await act(async()=>button(r,'Resolver operación pendiente').props.onClick());assert.equal(requests.length,2);assert.equal(requests[0].operationId,requests[1].operationId);assert.equal(storage.size,0);}finally{await act(async()=>r.unmount())}
});
test.after(async()=>rm(dir,{recursive:true,force:true}));
