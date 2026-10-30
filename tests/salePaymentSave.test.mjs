import test from 'node:test';import assert from 'node:assert/strict';import{mkdtemp,writeFile,rm}from'node:fs/promises';import{join}from'node:path';import{pathToFileURL}from'node:url';import{build}from'esbuild';import React from'react';import{create,act}from'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('payment waits for confirmation, blocks double click and closing, retains values after failure and reuses checkout ID',async()=>{
 const dir=await mkdtemp(join(process.cwd(),'tests/.sale-payment-'));let r;
 try{const b=await build({stdin:{contents:"export {default as PaymentModal} from './components/PaymentModal';export {PaymentMethod} from './types';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',external:['react']});const path=join(dir,'view.mjs');await writeFile(path,b.outputFiles[0].text);const{PaymentModal,PaymentMethod}=await import(pathToFileURL(path).href);
  const calls=[];let resolve,reject,closed=0;
  const props={isOpen:true,total:100,sellers:[{id:'u',name:'Seller'}],customers:[],onProcessSale:input=>{calls.push(input);return new Promise((yes,no)=>{resolve=yes;reject=no})},onClose:()=>closed++,onHoldSale:()=>{},saleDate:new Date('2026-10-30T12:00:00Z'),initialCustomerInfo:null,currentStore:{id:'a1'},giftVouchers:[]};
  await act(async()=>{r=create(React.createElement(PaymentModal,props))});const button=label=>r.root.findAllByType('button').find(b=>b.children.includes(label));
  await act(async()=>button('Seller').props.onClick());await act(async()=>button(PaymentMethod.Efectivo).props.onClick());
  const finalize=()=>r.root.findAllByType('button').find(b=>b.props.onClick?.name==='handleFinalize');let pending;
  await act(async()=>{pending=finalize().props.onClick();finalize().props.onClick();});assert.equal(calls.length,1);assert.equal(closed,0);assert.equal(finalize().props.disabled,true);assert.equal(r.root.findByType('fieldset').props.disabled,true);
  await act(async()=>button('Cancelar').props.onClick());assert.equal(closed,0);
  await act(async()=>{reject(Error('Sin conexión'));await pending});assert.equal(closed,0);assert.equal(finalize().props.disabled,false);assert.ok(JSON.stringify(r.toJSON()).includes('Sin conexión'));
  await act(async()=>{pending=finalize().props.onClick()});assert.equal(calls[1].checkoutId,calls[0].checkoutId);assert.deepEqual(calls[1].payments,calls[0].payments);
  await act(async()=>{resolve();await pending});assert.equal(closed,1);
 }finally{if(r)await act(async()=>r.unmount());await rm(dir,{recursive:true,force:true})}
});

test('selling a gift voucher also blocks duplicate clicks and retains the same code and operation on retry',async()=>{
 const dir=await mkdtemp(join(process.cwd(),'tests/.voucher-sale-'));let r;
 try{const b=await build({stdin:{contents:"export {default as Modal} from './components/SellVoucherModal';export {PaymentMethod} from './types';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',external:['react']});const path=join(dir,'view.mjs');await writeFile(path,b.outputFiles[0].text);const{Modal,PaymentMethod}=await import(pathToFileURL(path).href);
 const calls=[];let reject;let closed=0;const props={isOpen:true,onClose:()=>closed++,sellers:[{id:'u',name:'Seller'}],customers:[],currentStore:{id:'a1'},onCreateGiftVoucher:async()=>{throw Error('unexpected separate voucher write')},onProcessSale:input=>{calls.push(input);return new Promise((_,no)=>reject=no)}};
 await act(async()=>{r=create(React.createElement(Modal,props))});const button=label=>r.root.findAllByType('button').find(b=>b.children.includes(label));await act(async()=>r.root.findByProps({placeholder:'0'}).props.onChange({target:{value:'100'}}));await act(async()=>button('Seller').props.onClick());await act(async()=>button(PaymentMethod.Efectivo).props.onClick());let pending;
 await act(async()=>{pending=button('Confirmar Venta').props.onClick();button('Confirmar Venta').props.onClick()});assert.equal(calls.length,1);await act(async()=>button('Cancelar').props.onClick());assert.equal(closed,0);
 await act(async()=>{reject(Error('Simulated failure'));await pending});await act(async()=>{pending=button('Confirmar Venta').props.onClick()});assert.equal(calls[1].checkoutId,calls[0].checkoutId);assert.equal(calls[1].items[0].id,calls[0].items[0].id);await act(async()=>{reject(Error('Simulated retry failure'));await pending});assert.equal(closed,0);
 }finally{if(r)await act(async()=>r.unmount());await rm(dir,{recursive:true,force:true})}
});
