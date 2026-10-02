import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import React from 'react';
import {create,act} from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

test('consultation is available to valid roles without adding operation permissions; old layaways remain visible read-only',async()=>{
 const dir=await mkdtemp(join(process.cwd(),'tests/.record-access-'));let renderer;
 try{
 const result=await build({stdin:{contents:"export * from './services/tenantIdentity';export {View} from './types';export {LayawayView} from './components/LayawayView';export {InventoryTransferView} from './components/InventoryTransferView';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',external:['react']});
 const path=join(dir,'view.mjs');await writeFile(path,result.outputFiles[0].text);
 const {tenantPermissions,tenantOperationPermissions,View,LayawayView,InventoryTransferView}=await import(pathToFileURL(path).href);
 const stores=[{id:'m1',companyId:'mayla',name:'Mayla'}];
 const roles=[{id:'viewer',companyId:'mayla',name:'Vista',permissions:[]},{id:'seller',companyId:'mayla',name:'Vendedor',permissions:[View.LAYAWAY]}];
 for(const role of roles){
 const user={id:'user',companyId:'mayla',storeId:'m1',roleId:role.id};
 for(const view of [View.LAYAWAY,View.INCIDENTS,View.INVENTORY_TRANSFER])assert.ok(tenantPermissions(user,roles,stores).includes(view));
 assert.deepEqual(tenantOperationPermissions(user,roles,stores),role.permissions);
 for(const change of [{isDisabled:true},{companyId:'other'},{storeId:'unknown'},{roleId:'foreign'}])assert.deepEqual(tenantPermissions({...user,...change},roles,stores),[]);
 }
 let writes=0;const write=()=>writes++;
 const user={id:'u',storeId:'m1',roleId:'viewer',companyId:'mayla'};
 const props={readOnly:true,layaways:[{id:'old',createdAt:'2024-01-01',customerName:'Old customer',customerPhone:'123',invoiceNumber:'old-invoice',status:'active',totalAmount:100,paidAmount:10,items:[],payments:[]}],sellers:[],inventory:[],currentUser:user,roles,onAddPayment:write,onFulfillPreOrder:write,onDeleteLayaway:write,onUpdateLayaway:write};
 await act(async()=>{renderer=create(React.createElement(LayawayView,props));});
 assert.ok(JSON.stringify(renderer.toJSON()).includes('Old customer'));
 await act(async()=>renderer.root.findAllByType('div').find(n=>n.props.className?.includes('cursor-pointer')).props.onClick());
 const labels=renderer.root.findAllByType('button').map(n=>JSON.stringify(n.children));
 assert.ok(!labels.some(s=>s.includes('Registrar Abono')||s.includes('Marcar Recibido')));
 assert.equal(renderer.root.findAllByProps({title:'Editar Abono'}).length,0);
 await act(async()=>renderer.update(React.createElement(InventoryTransferView,{readOnly:true,inventory:[],stores,currentUser:user,transfers:[],onTransfer:write,onDeleteTransfer:write,onResetBalances:write})));
 const form=renderer.root.findByType('form');assert.equal(form.props.hidden,true);
 await act(async()=>form.props.onSubmit({preventDefault(){}}));
 assert.equal(writes,0);
 }finally{if(renderer)await act(async()=>renderer.unmount());await rm(dir,{recursive:true,force:true});}
});
