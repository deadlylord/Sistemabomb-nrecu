import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import React from 'react';
import {create,act} from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('approval button blocks immediate double clicks and recovers after failed save without changing filters',async()=>{
 const dir=await mkdtemp(join(process.cwd(),'tests/.exchange-ui-'));let r;
 const oldAlert=globalThis.alert,alerts=[];globalThis.alert=m=>alerts.push(m);
 try{
  const tenantSource=await readFile('services/tenantWrites.ts','utf8');
  const validator=tenantSource.slice(tenantSource.indexOf('export function assertTenantData'),tenantSource.indexOf('type Operation ='));
  const b=await build({stdin:{contents:"export {default as Screen} from './components/IncidentsView';export {IncidentType,IncidentStatus} from './types';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',external:['react','react-dom'],plugins:[{name:'modal-stubs',setup(builder){builder.onResolve({filter:/tenantWrites$/},a=>({path:a.path,namespace:'tenant'}));builder.onLoad({filter:/.*/,namespace:'tenant'},()=>({contents:`import {DEFAULT_COMPANY_ID,IncidentType} from './types';${validator}`,loader:'ts',resolveDir:process.cwd()}));builder.onResolve({filter:/(ReceiveDamagedModal|CreateIncidentModal|EditIncidentModal|EditExchangeIncidentModal)$/},a=>({path:a.path,namespace:'stub'}));builder.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export default function Modal(){return null}'}));}}]});
  const path=join(dir,'screen.mjs');await writeFile(path,b.outputFiles[0].text);const {Screen,IncidentType:T,IncidentStatus:S}=await import(pathToFileURL(path).href);
  let calls=0,reject,resolve;
  const props={companyId:'a',activeStoreId:'a1',stores:[{id:'a1',companyId:'a',name:'Test'}],currentUser:{id:'admin',companyId:'a',storeId:'a1',roleId:'admin'},roles:[{id:'admin',companyId:'a',name:'Administrador',userType:'admin'}],incidents:[{id:'one',storeId:'a1',companyId:'a',type:T.PRODUCT_EXCHANGE,status:S.CAMBIO_SOLICITADO,createdAt:'2026-10-01',description:'Cambio'}],inventory:[],sales:[],customers:[],onApproveIncident:()=>{calls++;return new Promise((yes,no)=>{resolve=yes;reject=no})}};
  await act(async()=>{r=create(React.createElement(Screen,props))});
  const search=()=>r.root.findByProps({placeholder:'Buscar por producto, cliente, factura...'});
  await act(async()=>search().props.onChange({target:{value:'Cambio'}}));
  const button=()=>r.root.findAllByType('button').find(b=>b.props.title==='Aprobar y Procesar'||b.props.title==='Guardando cambio…');
  let pending;await act(async()=>{pending=button().props.onClick();button().props.onClick();});
  assert.equal(calls,1);assert.equal(button().props.disabled,true);assert.equal(button().props['aria-busy'],true);
  await act(async()=>{reject(Error('Sin conexión'));await pending});
  assert.equal(button().props.disabled,false);assert.deepEqual(alerts,['Sin conexión']);assert.equal(search().props.value,'Cambio');
  await act(async()=>{pending=button().props.onClick()});await act(async()=>{resolve();await pending});assert.equal(calls,2);assert.equal(button().props.disabled,false);
 }finally{if(r)await act(async()=>r.unmount());globalThis.alert=oldAlert;await rm(dir,{recursive:true,force:true})}
});
