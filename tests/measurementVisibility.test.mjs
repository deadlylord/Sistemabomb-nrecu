import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {act,create} from 'react-test-renderer';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
async function fixture(run){
 const previous=globalThis.window,dir=await mkdtemp(join(process.cwd(),'tests/.visibility-'));let count=0;
 const localStorage=storage(),sessionStorage=storage();
 globalThis.window={location:new URL('https://vestikapos.netlify.app/?otro=1#section'),localStorage,sessionStorage,history:{state:null,replaceState(state,title,url){window.location=new URL(url)}}};
 const b=await build({bundle:true,write:false,format:'esm',platform:'node',external:['react'],define:{'import.meta.env':JSON.stringify({VITE_APP_ENV:'production'})},stdin:{contents:`export * from './services/diagnosticsVisibility';export * as meter from './services/readDiagnostics';export {default as Settings} from './components/MeasurementSettings';export {default as Entry} from './components/VerifiedEntry';`,resolveDir:process.cwd()}});
 const load=async()=>{const path=join(dir,`${count++}.mjs`);await writeFile(path,b.outputFiles[0].text);return import(pathToFileURL(path).href)};
 try{await run({load,localStorage,sessionStorage})}finally{globalThis.window=previous;await rm(dir,{recursive:true,force:true})}
}
test('Developer switch persists for this browser, hides entry by default and stops measurement when disabled',()=>fixture(async({load})=>{
 const m=await load();let r;
 try{
  assert.equal(m.getMeasurementVisibility(),false);
  await act(async()=>{r=create(React.createElement(React.Fragment,null,React.createElement(m.Settings),React.createElement(m.Entry)))});
  const button=label=>r.root.findAllByType('button').find(b=>b.children.join('')===label);
  assert.equal(button('Medir ingreso'),undefined);
  await act(async()=>r.root.findByProps({type:'checkbox'}).props.onChange({target:{checked:true}}));
  assert.ok(button('Medir ingreso'));
  const reloaded=await load();assert.equal(reloaded.getMeasurementVisibility(),true);
  m.meter.startReadMeasurement('test');assert.equal(m.meter.getReadDiagnostics().session.active,true);
  await act(async()=>r.root.findByProps({type:'checkbox'}).props.onChange({target:{checked:false}}));
  assert.equal(button('Medir ingreso'),undefined);assert.equal(m.meter.getReadDiagnostics().session,null);
  assert.equal((await load()).getMeasurementVisibility(),false);
 }finally{if(r)await act(async()=>r.unmount())}
}));
test('invitation enables only its tab, survives reload, strips unrelated query data and can be disabled',()=>fixture(async({load,localStorage,sessionStorage})=>{
 window.location=new URL('https://vestikapos.netlify.app/?medir=1&private=sample#details');
 const m=await load();assert.equal(m.getMeasurementVisibility(),true);
 assert.equal(localStorage.getItem('vestika:production:measurement-visible'),null);
 assert.equal(m.measurementInvitationUrl(),'https://vestikapos.netlify.app/?medir=1');
 window.location=new URL('https://vestikapos.netlify.app/');assert.equal((await load()).getMeasurementVisibility(),true);
 sessionStorage.removeItem('vestika:production:measurement-visible:invitation');assert.equal((await load()).getMeasurementVisibility(),false);
 window.location=new URL('https://vestikapos.netlify.app/?medir=1');const invited=await load();invited.setMeasurementVisibility(false);
 assert.equal(window.location.search,'');assert.equal((await load()).getMeasurementVisibility(),false);
}));
