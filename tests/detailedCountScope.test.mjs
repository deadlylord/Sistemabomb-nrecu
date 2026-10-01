import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { build } from 'esbuild';
import React from 'react';
import { create, act } from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('detail counts reject late draft responses after switching store and reject mismatched company drafts', async () => {
 const dir=await mkdtemp(fileURLToPath(new URL('./.detail-',import.meta.url)));
 let renderer;
 try {
  const bundle=await build({bundle:true,write:false,format:'esm',platform:'node',external:['react'],stdin:{contents:`export { default as Detail } from './components/DetailedInventoryVerificationModal'; export { requests } from 'firebase/firestore';`,resolveDir:process.cwd()},plugins:[{name:'fake',setup(b){
   b.onResolve({filter:/\/firebase$/},()=>({path:'config',namespace:'fake'}));
   b.onResolve({filter:/^firebase\/firestore$/},()=>({path:'firestore',namespace:'fake'}));
   b.onLoad({filter:/.*/,namespace:'fake'},args=>({contents:args.path==='config'?'export const db={};':`
    export const requests=[];
    export const doc=(_,collection,id)=>({path:collection+'/'+id});
    export const getDoc=ref=>new Promise(resolve=>requests.push({path:ref.path,resolve:data=>resolve({exists:()=>!!data,data:()=>data})}));
    export const getDocs=async()=>({docs:[]});
    export const collection=()=>({}); export const query=()=>({}); export const where=()=>({});
    export const setDoc=()=>{};export const updateDoc=()=>{};export const deleteDoc=()=>{};export const writeBatch=()=>{};export const runTransaction=()=>{};
   `}));
  }}]});
  const path=join(dir,'detail.mjs');await writeFile(path,bundle.outputFiles[0].text);
  const {Detail,requests}=await import(pathToFileURL(path).href);
  const props={isOpen:true,category:{id:'c',name:'Blusas',companyId:'mayla'},companyId:'mayla',storeId:'s1',products:[{id:'p',name:'Blusa',storeId:'s1',categoryId:'c',stock:5}],initialCounts:{},isAdmin:false,onClose:()=>{}};
  await act(async()=>{renderer=create(React.createElement(Detail,props));});
  await act(async()=>{renderer.update(React.createElement(Detail,{...props,storeId:'s2',products:[{...props.products[0],storeId:'s2'}]}));});
  await act(async()=>{requests[1].resolve({companyId:'mayla',storeId:'s2',categoryId:'c',counts:{p:7}});});
  const numbers=()=>renderer.root.findAllByType('input').filter(input=>input.props.type==='number').map(input=>input.props.value);
  assert.ok(numbers().includes('7'));
  await act(async()=>{requests[0].resolve({companyId:'mayla',storeId:'s1',categoryId:'c',counts:{p:99}});});
  assert.ok(numbers().includes('7'));assert.ok(!numbers().includes('99'));
  await act(async()=>{renderer.update(React.createElement(Detail,{...props,storeId:'s3'}));});
  await act(async()=>{requests[2].resolve({companyId:'bombon',storeId:'s3',categoryId:'c',counts:{p:88}});});
  assert.ok(!numbers().includes('88'));assert.ok(!numbers().includes('7'));
 } finally {if(renderer)await act(async()=>renderer.unmount());await rm(dir,{recursive:true,force:true});}
});
