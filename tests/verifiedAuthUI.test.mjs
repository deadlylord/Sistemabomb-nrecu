import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { build } from 'esbuild';
import React from 'react';
import { create, act } from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('verified user editing never reveals the previous password and permits retaining it; new users require one',async()=>{
  const dir=await mkdtemp(fileURLToPath(new URL('./.verified-user-ui-',import.meta.url)));let renderer;
  try{
    const path=join(dir,'modal.mjs');await build({entryPoints:['components/SellerModal.tsx'],outfile:path,bundle:true,format:'esm',platform:'node',external:['react'],define:{'import.meta.env':JSON.stringify({VITE_VERIFIED_IDENTITY:'true'})}});
    const{default:Modal}=await import(pathToFileURL(path).href);
    const saves=[];const props={isOpen:true,onClose:()=>{},onSave:(...args)=>saves.push(args),roles:[{id:'r',name:'Vendedor',userType:'seller',permissions:['pos']}],stores:[{id:'a1',companyId:'a',name:'A1'}],seller:{id:'u',name:'User',username:'user',storeId:'a1',roleId:'r',companyId:'a',password:'legacy-secret-must-not-appear'}};
    await act(async()=>{renderer=create(React.createElement(Modal,props))});
    assert.equal(renderer.root.findByProps({id:'password'}).props.value,'');
    assert.equal(renderer.root.findByProps({id:'password'}).props.required,false);
    assert.ok(!JSON.stringify(renderer.toJSON()).includes('legacy-secret-must-not-appear'));
    await act(async()=>renderer.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.equal(saves.length,1);assert.equal(saves[0][1],'');
    await act(async()=>renderer.update(React.createElement(Modal,{...props,seller:null})));assert.equal(renderer.root.findByProps({id:'password'}).props.required,true);
  }finally{if(renderer)await act(async()=>renderer.unmount());await rm(dir,{recursive:true,force:true});}
});
