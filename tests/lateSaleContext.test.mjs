import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { build } from 'esbuild';

test('the actual sale handler keeps late receipts and cart changes out of a new company/store/user or a returned context', async () => {
  const dir = await mkdtemp(fileURLToPath(new URL('./.late-sale-', import.meta.url)));
  try {
    const source = await readFile('components/App.tsx', 'utf8');
    const handler = source.slice(source.indexOf('  const validateTransactionCart = async'), source.indexOf('  const handleHoldSale = async'));
    const fixture = `import {PaymentMethod,ProductChangeType} from './types';
      import {assertCartAvailability} from './services/cartAvailability';
      import {operationContextKey} from './services/operationContext';
      export function makeFixture() {
        const db={}; const currentStore={id:'mayla-1'}; const currentStoreId='mayla-1'; const currentUser={id:'carlos'}; const operationalCompanyId='mayla';
        const activeCart=[{id:'own',name:'Blusa',price:20,quantity:1}];
        const operationContextRef={current:{key:operationContextKey('carlos','mayla','mayla-1'),version:0}};
        let uiCart=[...activeCart],receipt=null,visible=false; let release,ready;
        const pending=new Promise(resolve=>release=resolve),committed=new Promise(resolve=>ready=resolve);
        const writes=[];let sequence=0;
        const collection=(_,name)=>({name});const doc=(...args)=>({id:args[2]||'generated-'+(++sequence),path:args.length===1?args[0].name+'/generated-'+sequence:args[1]+'/'+args[2]});
        const increment=value=>value,formatCOP=value=>String(value),cleanObject=value=>value;
        const runTransaction=async(_,callback)=>{await callback({get:async(ref)=>({exists:()=>true,data:()=>ref.path.startsWith('inventory/')?{name:'Blusa',stock:1,companyId:'mayla',storeId:'mayla-1'}:{nextInvoiceNumber:1}}),set(ref,data){writes.push({ref,data})},update(){}});ready();await pending;};
        const setSaleForReceipt=value=>{receipt=value},setShowReceiptModal=value=>{visible=value},handleClearCart=()=>{uiCart=[]},alert=message=>{throw Error(message)};
        ${handler}
        return { ready:committed, release:()=>release(), start:()=>handleProcessSale({payments:[{method:PaymentMethod.Efectivo,amount:20}],customerName:'Prueba',customerPhone:'',seller:'Carlos'},new Date()),
          change(user,company,store){operationContextRef.current={key:operationContextKey(user,company,store),version:operationContextRef.current.version+1};uiCart=[{id:'new-cart-item'}];receipt=null;visible=false;},
          result:()=>({receipt,visible,uiCart,writes}) };
      }`;
    const bundle = await build({ stdin:{contents:fixture,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node' });
    const path=join(dir,'fixture.mjs');await writeFile(path,bundle.outputFiles[0].text);
    const {makeFixture}=await import(pathToFileURL(path).href);
    for (const changes of [[],[['carlos','bombon','metro']],[['carlos','mayla','mayla-2']],[['other','mayla','mayla-1']],[['carlos','bombon','metro'],['carlos','mayla','mayla-1']]]) {
      const f=makeFixture(),operation=f.start();await f.ready;
      changes.forEach(args=>f.change(...args));f.release();await operation;
      const result=f.result();
      assert.equal(result.writes.find(write=>write.ref.path.startsWith('sales/')).data.companyId,'mayla');
      if(changes.length){assert.equal(result.receipt,null);assert.equal(result.visible,false);assert.equal(result.uiCart[0].id,'new-cart-item');}
      else{assert.equal(result.receipt.companyId,'mayla');assert.equal(result.visible,true);assert.equal(result.uiCart.length,0);}
    }
  } finally { await rm(dir,{recursive:true,force:true}); }
});
