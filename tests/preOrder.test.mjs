import test from 'node:test';
import assert from 'node:assert/strict';
import { build, transform } from 'esbuild';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import React from 'react';
import { create, act } from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const bundled = await build({ stdin: { contents: "export { assertCartAvailability } from './services/cartAvailability';", resolveDir: process.cwd() }, bundle: true, format: 'esm', platform: 'node', write: false });
const { assertCartAvailability } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const product = { id: 'p', name: 'Blusa', sku: 'BLUSA-1', stock: 0, price: 30000, companyId: 'company', storeId: 'store', categoryId: 'zero-category' };
const cart = [{ ...product, quantity: 2 }];
test('zero-stock catalog garments allow an encargo, never a sale or reservation', () => {
  assert.doesNotThrow(() => assertCartAvailability(cart, [product], 'company', 'store', false));
  assert.throws(() => assertCartAvailability(cart, [product], 'company', 'store', true), /Stock insuficiente/);
  assert.throws(() => assertCartAvailability([...cart, ...cart], [{...product, stock: 3}], 'company', 'store', true), /Stock insuficiente/);
  for (const bad of [{...product, isDisabled:true}, {...product, storeId:'other'}, {...product, companyId:'other'}]) {
    assert.throws(() => assertCartAvailability(cart, [bad], 'company', 'store', false), /catálogo/);
  }
  assert.throws(() => assertCartAvailability([{...cart[0], quantity:0}], [product], 'company', 'store', false), /cantidad/);
});

const source = await readFile('components/App.tsx', 'utf8');
async function handler(start, end, scope, name) {
  const { code } = await transform(source.slice(source.indexOf(start), source.indexOf(end)), { loader:'ts' });
  return new Function(...Object.keys(scope), 'console', code + `;return ${name};`)(...Object.values(scope), {error:()=>{}});
}
function databaseScope() {
  let nextId=0;
  const rows=new Map([['inventory/p', structuredClone(product)], ['stores/store', {nextInvoiceNumber:1}]]);
  const pending=[];
  const apply=(ref,data)=>{
    const current=rows.get(ref.path)||{};
    for(const [key,val] of Object.entries(data)) current[key]=val?.inc!==undefined?(current[key]||0)+val.inc:val?.union!==undefined?[...(current[key]||[]),val.union]:val;
    rows.set(ref.path,current);
  };
  const scope={db:{},currentStoreId:'store',operationalCompanyId:'company',currentUser:{name:'Vendedor'},activeCart:cart,operationContextRef:{current:'scope'},
    doc:(...args)=>args.length===1?{path:`${args[0]}/${++nextId}`,id:String(nextId)}:{path:`${args[1]}/${args[2]}`,id:args[2]},
    collection:(_,name)=>name, increment:inc=>({inc}),arrayUnion:union=>({union}),cleanObject:x=>x,handleClearCart:()=>{},
    alert:message=>{throw Error(message)},ProductChangeType:{LAYAWAY_RESERVED:'reserve',PRE_ORDER_FULFILLED:'received'},
    setSaleForReceipt:()=>{},setShowReceiptModal:()=>{},
    updateDoc:async(ref,data)=>apply(ref,data),
    runTransaction:async(_,callback)=>{pending.length=0;await callback({get:async ref=>({id:ref.id,exists:()=>rows.has(ref.path),data:()=>structuredClone(rows.get(ref.path))}),set:(ref,data)=>pending.push([ref,data]),update:(ref,data)=>pending.push([ref,data])});for(const [ref,data]of pending)apply(ref,data);},
    validateTransactionCart:async(_,items,storeId,requireStock)=>assertCartAvailability(items,[rows.get('inventory/p')],'company',storeId,requireStock)};
  return {scope,rows};
}
test('actual creation and full payment leave zero stock unchanged; physical receipt reserves once', async () => {
  const {scope,rows}=databaseScope();
  const createOrder=await handler('  const handleCreateLayaway =','  const handleAddPaymentToLayaway =',scope,'handleCreateLayaway');
  await createOrder('Cliente','3001234567','1','Vendedor',{amount:10000,method:'Efectivo'},new Date(),true);
  let order=rows.get('layaways/1');assert.equal(order.status,'pre-order');assert.equal(rows.get('inventory/p').stock,0);
  await assert.rejects(()=>createOrder('Cliente','3001234567','2','Vendedor',{amount:10000,method:'Efectivo'},new Date(),false),/Stock insuficiente/);
  const pay=await handler('  const handleAddPaymentToLayaway =','  const handleFulfillPreOrder =',{...scope,layaways:[order]},'handleAddPaymentToLayaway');
  await pay(order.id,50000,'Efectivo','Vendedor');
  order=rows.get('layaways/1');assert.equal(order.paidAmount,60000);assert.equal(order.status,'pre-order');assert.equal(rows.get('inventory/p').stock,0);
  const receive=await handler('  const handleFulfillPreOrder =','  const handleInventoryTransfer =',scope,'handleFulfillPreOrder');
  await assert.rejects(()=>receive(order.id),/Stock insuficiente/);
  rows.get('inventory/p').stock=2;
  await receive(order.id);assert.equal(rows.get('inventory/p').stock,0);assert.equal(rows.get('layaways/1').status,'completed');
  await receive(order.id);assert.equal(rows.get('inventory/p').stock,0);
});

test('empty cart starts encargo selection; zero-stock card can only be selected in that mode', async () => {
  const dir=await mkdtemp(process.cwd()+'/tests/.preorder-');let renderer;
  try {
    const result=await build({stdin:{contents:"export {default as Card} from './components/ProductCard';export {default as Cart} from './components/CartPanel';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',external:['react'],plugins:[{name:'payment-stub',setup(b){b.onResolve({filter:/^\.\/PaymentModal$/},args=>({path:args.path,namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export default function Stub(){return null}'}));}}]});
    const path=dir+'/ui.mjs';await writeFile(path,result.outputFiles[0].text);const {Card,Cart}=await import(pathToFileURL(path).href);
    let starts=0,adds=0;
    await act(async()=>{renderer=create(React.createElement(Cart,{cartItems:[],sellers:[],customers:[],nextInvoiceNumber:1,onStartPreOrder:()=>starts++}));});
    const start=renderer.root.findAllByType('button').find(n=>n.children.join('').includes('seleccionar prendas'));
    await act(async()=>start.props.onClick());assert.equal(starts,1);
    const props={product,onAddToCart:()=>adds++,onToggleVerification:()=>{},isVerified:false};
    await act(async()=>renderer.update(React.createElement(Card,props)));
    const click=()=>renderer.root.findByProps({role:'button'}).props.onClick({target:{closest:()=>null}});
    await act(async()=>click());assert.equal(adds,0);
    await act(async()=>renderer.update(React.createElement(Card,{...props,preOrderSelection:true})));
    assert.equal(renderer.root.findByProps({role:'button'}).props.tabIndex,0);
    await act(async()=>click());assert.equal(adds,1);
    let rejectSave;
    const savePending=new Promise((_,reject)=>{rejectSave=reject});
    await act(async()=>renderer.update(React.createElement(Cart,{cartItems:cart,sellers:[{id:'s',name:'Vendedor'}],customers:[],preOrderSelection:true,hasStockShortage:true,nextInvoiceNumber:1,onCreateLayaway:()=>savePending})));
    const sale=renderer.root.findAllByType('button').find(n=>n.children.join('')==='Procesar Venta');assert.equal(sale.props.disabled,true);
    const createButton=renderer.root.findAllByType('button').find(n=>n.findAllByType('span').some(span=>span.children.join('')==='Crear encargo por traer'));
    await act(async()=>createButton.props.onClick());
    for(const [id,value] of [['customerPhone','3001234567'],['customerName','Cliente'],['invoiceNumber','1'],['layawaySeller','Vendedor'],['initialAmount','10000']]) {
      await act(async()=>renderer.root.findByProps({id}).props.onChange({target:{value}}));
    }
    const paymentSelect=renderer.root.findAllByType('select').find(n=>n.props.id==='paymentMethod');
    await act(async()=>paymentSelect.props.onChange({target:{value:paymentSelect.findAllByType('option')[1].props.value}}));
    let saving;
    await act(async()=>{saving=renderer.root.findAllByType('button').find(n=>n.children.join('')==='Confirmar').props.onClick();});
    assert.equal(renderer.root.findAllByType('button').find(n=>n.children.join('')==='Guardando...').props.disabled,true);
    await act(async()=>{rejectSave(new Error('Sin conexión'));await saving;});
    assert.ok(renderer.root.findByProps({id:'customerName'}));
    assert.match(JSON.stringify(renderer.root.findByProps({role:'alert'}).children.map(n=>n.children)),/Sin conexión/);

  } finally {if(renderer)await act(async()=>renderer.unmount());await rm(dir,{recursive:true,force:true});}
});
