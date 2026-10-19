import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { create, act } from 'react-test-renderer';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.document = { body: {} };
const dir = await mkdtemp(join(process.cwd(), 'tests/.layaway-edit-'));
const bundled = await build({entryPoints:['components/EditLayawayModal.tsx'],bundle:true,write:false,format:'esm',platform:'node',external:['react'],plugins:[{name:'portal-for-component-test',setup(b){b.onResolve({filter:/^react-dom$/},()=>({path:'react-dom',namespace:'portal'}));b.onLoad({filter:/.*/,namespace:'portal'},()=>({contents:'export const createPortal = children => children;'}));}}]});
const path=join(dir,'modal.mjs');await writeFile(path,bundled.outputFiles[0].text);
const {default:EditLayawayModal}=await import(pathToFileURL(path).href);
const layaway={id:'layaway',invoiceNumber:'A-1',storeId:'store',companyId:'company',customerName:'Cliente',customerPhone:'3001234567',seller:'Ana',createdAt:'2026-10-18T14:00:00.000Z',status:'active',items:[{id:'p',name:'Blusa',price:100000,quantity:1,cost:30000}],payments:[{amount:40000,method:'Efectivo',date:'2026-10-18T14:00:00.000Z',seller:'Ana'}],totalAmount:100000,paidAmount:40000};

test('mobile layaway editor stays above navigation and preserves the edited payment data',async()=>{
  let saved,closed=0,r;
  await act(async()=>{r=create(React.createElement(EditLayawayModal,{isOpen:true,layaway,sellers:[{id:'u',name:'Ana'}],inventory:[],onUpdateLayaway:value=>{saved=value},onClose:()=>closed++}));});
  try {
    const dialog=r.root.findByProps({role:'dialog'});
    assert.match(dialog.props.className,/z-\[9999\]/);
    assert.ok(dialog.findAll(node=>typeof node.props?.className==='string').some(node=>node.props.className.includes('h-[100dvh]')));
    const actions=r.root.findByProps({'data-testid':'edit-layaway-mobile-actions'});
    assert.match(actions.props.className,/grid-cols-2/);
    assert.equal(actions.findAllByType('button').length,2);
    await act(async()=>{r.root.findByType('form').props.onSubmit({preventDefault(){}})});
    assert.equal(saved.paidAmount,40000);
    assert.equal(saved.payments[0].method,'Efectivo');
    assert.equal(closed,1);
  } finally { await act(async()=>r.unmount()); }
});

test.after(async()=>{await rm(dir,{recursive:true,force:true})});
