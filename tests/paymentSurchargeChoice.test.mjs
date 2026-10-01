import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import React from 'react';
import {create,act} from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

test('seller can remove and restore surcharge per payment; totals and finalized receipt data stay consistent',async()=>{
 const dir=await mkdtemp(fileURLToPath(new URL('./.payment-',import.meta.url)));let renderer;
 try{
  const result=await build({bundle:true,write:false,format:'esm',platform:'node',external:['react'],stdin:{contents:"export {default as PaymentModal} from './components/PaymentModal';export {PaymentMethod} from './types';",resolveDir:process.cwd()}});
  const path=join(dir,'view.mjs');await writeFile(path,result.outputFiles[0].text);
  const {PaymentModal,PaymentMethod}=await import(pathToFileURL(path).href);
  const sales=[];const store={id:'m1',paymentSurcharges:{[PaymentMethod.QR]:0.03,[PaymentMethod.Nequi]:0.05}};
  const props={isOpen:true,onClose:()=>{},total:100000,sellers:[{id:'seller',name:'Vendedora'}],customers:[],onProcessSale:data=>sales.push(data),saleDate:new Date(),onHoldSale:()=>{},initialCustomerInfo:null,currentStore:store,giftVouchers:[],onUpdateGiftVoucher:async()=>{}};
  await act(async()=>{renderer=create(React.createElement(PaymentModal,props));});
  const clickLabel=async label=>act(async()=>{const button=renderer.root.findAllByType('button').find(n=>n.children.includes(label));assert.ok(button,label);await button.props.onClick();});
  const toggle=async label=>act(async()=>renderer.root.findAllByType('button').find(n=>n.props['aria-label']===label).props.onClick());
  await clickLabel('Vendedora');
  await act(async()=>renderer.root.findByProps({id:'amountInput'}).props.onChange({target:{value:'40000'}}));
  await clickLabel(PaymentMethod.QR);
  await clickLabel(PaymentMethod.Nequi);
  await toggle(`Quitar recargo de ${PaymentMethod.QR}`);
  await toggle(`Aplicar recargo de ${PaymentMethod.QR}`);
  await toggle(`Quitar recargo de ${PaymentMethod.QR}`);
  const finalize=renderer.root.findAllByType('button').find(n=>n.props.onClick?.name==='handleFinalize');
  assert.ok(finalize);assert.ok(!finalize.props.disabled);
  await act(async()=>finalize.props.onClick());
  assert.equal(sales.length,1);
  const sale=sales[0];
  assert.equal(sale.payments[0].baseAmount,40000);assert.equal(sale.payments[0].amount,40000);
  assert.equal(sale.payments[0].surchargeAmount,0);assert.equal(sale.payments[0].surchargePercent,0);
  assert.equal(sale.payments[1].baseAmount,60000);assert.equal(sale.payments[1].amount,63000);
  assert.equal(sale.paymentSurchargeAmount,3000);
  assert.equal(sale.payments.reduce((sum,p)=>sum+p.amount,0),props.total+sale.paymentSurchargeAmount);
  assert.equal(store.paymentSurcharges[PaymentMethod.QR],0.03);
 }finally{if(renderer)await act(async()=>renderer.unmount());await rm(dir,{recursive:true,force:true});}
});
