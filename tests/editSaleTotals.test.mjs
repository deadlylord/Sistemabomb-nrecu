import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { saleEditTotals, adjustedSalePayment, validateSaleEdit } from '../services/saleEditTotals.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.document = { body: {} };
const dir = await mkdtemp(join(process.cwd(), 'tests/.sale-edit-'));
const bundled = await build({entryPoints:['components/EditSaleModal.tsx'],bundle:true,write:false,format:'esm',platform:'node',external:['react'],plugins:[{name:'portal-for-component-test',setup(b){b.onResolve({filter:/^react-dom$/},()=>({path:'react-dom',namespace:'portal'}));b.onLoad({filter:/.*/,namespace:'portal'},()=>({contents:'export const createPortal = children => children;'}));}}]});
const path=join(dir,'modal.mjs');await writeFile(path,bundled.outputFiles[0].text);
const {EditSaleModal}=await import(pathToFileURL(path).href);
const baseSale=()=>({id:'sale',invoiceNumber:1,storeId:'store',companyId:'company',customerName:'Cliente',customerPhone:'',seller:'Ana',createdAt:'2026-10-15T14:00:00.000Z',items:[{id:'p',name:'Blusa',price:100000,quantity:1,cost:30000}],payments:[{amount:100000,method:'Efectivo',date:'2026-10-15T14:00:00.000Z',seller:'Ana'}],totalAmount:100000});
async function mount(sale=baseSale(),save=()=>{}) {
  let closed=0,r;
  await act(async()=>{r=create(React.createElement(EditSaleModal,{isOpen:true,sale,sellers:[{id:'u',name:'Ana'},{id:'b',name:'Bea'}],inventory:[],onUpdateSale:save,onClose:()=>closed++}));});
  return {r,get closed(){return closed},field:label=>r.root.find(node=>node.type==='input'&&node.props['aria-label']===label),submit:()=>r.root.findByType('form').props.onSubmit({preventDefault(){}})};
}
async function changePrice(f,price){
  await act(async()=>{f.r.root.findAllByType('p').find(p=>p.props.onClick).props.onClick();});
  await act(async()=>{f.field('Precio unitario de Blusa').props.onChange({target:{value:String(price)}});});
}

test('price preview and submitted sale total/payment update even before price input blur',async()=>{
  let saved;const f=await mount(baseSale(),s=>{saved=s});
  try {await changePrice(f,60000);assert.equal(f.field('Importe del pago 1').props.value,60000);await act(async()=>{await f.submit()});assert.equal(saved.items[0].price,60000);assert.equal(saved.totalAmount,60000);assert.equal(saved.payments[0].amount,60000);assert.equal(f.closed,1);}finally{await act(async()=>f.r.unmount());}
});

test('quantity, percent/fixed discounts and surcharge are editable and balance the single payment',async()=>{
  let saved;const sale=baseSale();sale.discountPercent=10;sale.discountAmount=10000;sale.paymentSurchargeAmount=2000;sale.totalAmount=92000;sale.payments[0].amount=92000;
  const f=await mount(sale,s=>saved=s);
  try {await changePrice(f,50000);assert.equal(f.field('Importe del pago 1').props.value,47000);
    await act(async()=>f.r.root.findByProps({'aria-label':'Sumar una unidad de Blusa'}).props.onClick());assert.equal(f.field('Importe del pago 1').props.value,92000);
    await act(async()=>f.r.root.findByProps({'aria-label':'Tipo de descuento'}).props.onChange({target:{value:'amount'}}));
    await act(async()=>f.field('Descuento de la venta').props.onChange({target:{value:'5000'}}));
    await act(async()=>f.field('Recargo de la venta').props.onChange({target:{value:'1000'}}));
    await act(async()=>{await f.submit()});assert.equal(saved.totalAmount,96000);assert.equal(saved.payments[0].amount,96000);assert.equal(saved.discountPercent,0);assert.equal(saved.discountAmount,5000);assert.equal(saved.paymentSurchargeAmount,1000);
  }finally{await act(async()=>f.r.unmount());}
});

test('mixed payments require an explicit allocation of the difference and preserve the other method',async()=>{
  let saved;const sale=baseSale();sale.payments=[{...sale.payments[0],amount:60000},{...sale.payments[0],amount:40000,method:'QR'}];
  const f=await mount(sale,s=>saved=s);
  try {await changePrice(f,80000);await act(async()=>{await f.submit()});assert.equal(saved,undefined);assert.ok(f.r.root.findByProps({role:'alert'}));
    const buttons=f.r.root.findAllByType('button').filter(b=>b.children.includes('Aplicar diferencia a este pago'));
    await act(async()=>buttons[1].props.onClick());await act(async()=>{await f.submit()});assert.equal(saved.totalAmount,80000);assert.equal(saved.payments[0].amount,60000);assert.equal(saved.payments[1].amount,20000);assert.equal(saved.payments[1].method,'QR');
  }finally{await act(async()=>f.r.unmount());}
});

test('failed save keeps edits visible and blocks duplicate submissions while waiting',async()=>{
  let reject,calls=0;const f=await mount(baseSale(),()=>{calls++;return new Promise((_,r)=>reject=r)});
  try {await changePrice(f,70000);let pending;await act(async()=>{pending=f.submit()});await act(async()=>{await f.submit()});assert.equal(calls,1);assert.equal(f.closed,0);
    await act(async()=>{reject(new Error('Fallo simulado'));await pending});assert.equal(f.closed,0);assert.equal(f.field('Importe del pago 1').props.value,70000);assert.equal(f.r.root.findByProps({role:'alert'}).children[0],'Fallo simulado');
  }finally{await act(async()=>f.r.unmount());}
});

test('legacy sale without a payments array keeps its original method and creates a consistent payment',async()=>{
  let saved;const sale=baseSale();delete sale.payments;sale.paymentMethod='Efectivo';const f=await mount(sale,s=>saved=s);
  try {await changePrice(f,75000);await act(async()=>{await f.submit()});assert.equal(saved.payments[0].amount,75000);assert.equal(saved.paymentMethod,'Efectivo');}finally{await act(async()=>f.r.unmount());}
});

test('sale date and seller corrections follow the original payment without losing other sale fields',async()=>{
  let saved;const sale={...baseSale(),auditTag:'keep'};const f=await mount(sale,s=>saved=s);
  try {await act(async()=>f.r.root.findByProps({id:'createdAt'}).props.onChange({target:{value:'2026-10-16T12:00'}}));
    await act(async()=>f.r.root.findByProps({name:'seller'}).props.onChange({target:{name:'seller',value:'Bea'}}));
    await act(async()=>{await f.submit()});assert.equal(saved.payments[0].date,saved.createdAt);assert.equal(saved.payments[0].seller,'Bea');assert.equal(saved.auditTag,'keep');
  }finally{await act(async()=>f.r.unmount());}
});

test('mobile editor owns the full viewport and keeps both actions in a protected footer',async()=>{
  const f=await mount();
  try {
    const dialog=f.r.root.findByProps({role:'dialog'});
    assert.match(dialog.props.className,/z-\[9999\]/);
    assert.match(dialog.props.className,/p-0/);
    const panel=dialog.findAll(node=>typeof node.props?.className==='string').find(node=>node.props.className.includes('h-[100dvh]'));
    assert.ok(panel);
    const actions=f.r.root.findByProps({'data-testid':'edit-sale-mobile-actions'});
    assert.match(actions.props.className,/grid-cols-2/);
    assert.equal(actions.findAllByType('button').length,2);
  } finally { await act(async()=>f.r.unmount()); }
});

test('pure totals reject invalid amounts and preserve payment metadata when correcting a surcharge payment',()=>{
  assert.deepEqual(saleEditTotals([{price:50000,quantity:2}],'percent',10,3000),{subtotal:100000,discountAmount:10000,discountPercent:10,totalAmount:93000});
  const p=adjustedSalePayment({amount:103000,method:'QR',date:'2026-10-15',seller:'Ana',baseAmount:100000,surchargeAmount:3000},53000,3000);
  assert.equal(p.baseAmount,50000);assert.equal(p.surchargeAmount,3000);assert.equal(p.method,'QR');
  assert.throws(()=>validateSaleEdit([{price:-1,quantity:1}],[],0,0,0));
  assert.throws(()=>validateSaleEdit([{price:10,quantity:1}],[],10,0,0));
  assert.throws(()=>validateSaleEdit([{price:10,quantity:1}],[],0,11,0));
});

test.after(async()=>{await rm(dir,{recursive:true,force:true})});
