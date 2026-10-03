import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import React from 'react';
import {create,act} from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

test('each repeated barcode and Enter adds exactly once, without auto-adding a partial SKU', async () => {
  const dir=await mkdtemp(fileURLToPath(new URL('./.scanner-',import.meta.url)));
  const keys=['window','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','setTimeout','clearTimeout'];
  const previous=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
  let renderer;
  try {
    const handlers=new Set();
    class Element {}
    class Input extends Element {value='';focus(){}}
    Object.assign(globalThis,{HTMLElement:Element,HTMLInputElement:Input,HTMLTextAreaElement:class extends Element{},HTMLSelectElement:class extends Element{},window:{addEventListener:(_,fn)=>handlers.add(fn),removeEventListener:(_,fn)=>handlers.delete(fn)},setTimeout:()=>1,clearTimeout:()=>{}});
    const result=await build({stdin:{contents:"export {default} from './components/PosView';export {ViewFiltersProvider} from './services/viewFilters';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',external:['react'],plugins:[{name:'child-stubs',setup(b){b.onResolve({filter:/^\.\/(ProductGrid|ProductPerformanceModal|CartPanel|DailySalesReportModal|CreateIncidentModal|EditProductImageModal|SellVoucherModal|CheckVoucherModal|EditProductModal)$/},args=>({path:args.path,namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export default function Stub(){return null}'}));}}]});
    const path=join(dir,'pos.mjs');await writeFile(path,result.outputFiles[0].text);
    const {default:Pos,ViewFiltersProvider}=await import(pathToFileURL(path).href);
    const added=[];const input=new Input();
    const product=(id,sku)=>({id,sku,name:id,stock:10,price:20,storeId:'m1',categoryId:'c1',createdAt:new Date().toISOString()});
    const props={inventory:[product('short','SKU-1'),product('long','SKU-12')],categories:[],sellers:[],stores:[],sales:[],purchases:[],layaways:[],allCustomers:[],activeCart:[],heldCarts:[],dailyNotes:[],incidents:[],roles:[],giftVouchers:[],ceoNotes:[],verifiedProducts:new Set(),currentUser:{id:'s',roleId:'seller'},currentStore:{id:'m1'},onAddToCart:p=>added.push(p.id),onClearVerifications:()=>{}};
    const screen=(store,scope='s:mayla')=>React.createElement(ViewFiltersProvider,{key:scope},React.createElement(Pos,{...props,key:store,currentStore:{id:store}}));
    await act(async()=>{renderer=create(screen('m1'),{createNodeMock:node=>node.type==='input'?input:null});});
    const search=()=>renderer.root.findAllByType('input').find(n=>typeof n.props.onKeyDown==='function');
    const enter=()=>{let prevented=false,stopped=false;return {key:'Enter',target:input,currentTarget:input,repeat:false,get defaultPrevented(){return prevented},preventDefault(){prevented=true},stopPropagation(){stopped=true}};};
    for(let scan=0;scan<3;scan++){
      // Completing a shorter valid SKU must wait for Enter, so longer SKUs still work.
      input.value='SKU-1';await act(async()=>search().props.onChange({target:input}));assert.equal(added.length,scan);
      input.value='SKU-12';await act(async()=>search().props.onChange({target:input}));assert.equal(added.length,scan);
      const event=enter();await act(async()=>{search().props.onKeyDown(event);for(const fn of handlers)fn(event);});
      assert.equal(added.length,scan+1);assert.equal(added.at(-1),'long');
      await act(async()=>{search().props.onKeyDown(enter());});assert.equal(added.length,scan+1);
    }
    input.value='SKU-12';await act(async()=>search().props.onKeyDown({...enter(),repeat:true}));assert.equal(added.length,3);
    // Scanning outside a text field also consumes the code once.
    await act(async()=>{for(const key of 'SKU-12')for(const fn of handlers)fn({key,target:new Element(),repeat:false});for(const fn of handlers)fn({key:'Enter',target:new Element(),repeat:false,preventDefault(){}});});
    assert.deepEqual(added,['long','long','long','long']);
    input.value='chaqueta';await act(async()=>search().props.onChange({target:input}));
    await act(async()=>renderer.update(screen('m2')));
    assert.equal(search().props.value,'chaqueta','typed search survives store change');
    await act(async()=>renderer.update(screen('m1')));
    assert.equal(search().props.value,'chaqueta');
    await act(async()=>renderer.update(screen('m1','other:company')));
    assert.equal(search().props.value,'','new user/company starts with an empty search');
  } finally {
    if(renderer)await act(async()=>renderer.unmount());
    for(const key of keys)if(previous[key]===undefined)delete globalThis[key];else globalThis[key]=previous[key];
    await rm(dir,{recursive:true,force:true});
  }
});
