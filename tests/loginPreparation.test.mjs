import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('login inputs prepare code without submitting or changing the visible form, then submit only once with entered values',async()=>{
 const dir=await mkdtemp(join(process.cwd(),'tests/.login-preparation-'));let r;
 try{
  const b=await build({bundle:true,write:false,format:'esm',platform:'node',external:['react'],entryPoints:['components/LoginView.tsx']});
  const path=join(dir,'login.mjs');await writeFile(path,b.outputFiles[0].text);const {default:Login}=await import(pathToFileURL(path).href);
  const calls=[];let prepared=0;
  await act(async()=>{r=create(React.createElement(Login,{isAppReady:true,onLogin:(...args)=>calls.push(args),onPrepareLogin:()=>prepared++}))});
  const visible=JSON.stringify(r.toJSON());
  await act(async()=>{r.root.findByProps({id:'username'}).props.onFocus();r.root.findByProps({id:'password'}).props.onFocus()});
  assert.equal(prepared,2);assert.equal(calls.length,0);assert.equal(JSON.stringify(r.toJSON()),visible);
  await act(async()=>{r.root.findByProps({id:'username'}).props.onChange({target:{value:'test-user'}});r.root.findByProps({id:'password'}).props.onChange({target:{value:'test-password'}})});
  await act(async()=>r.root.findByType('form').props.onSubmit({preventDefault(){}}));
  assert.deepEqual(calls,[['test-user','test-password']]);
 }finally{if(r)await act(async()=>r.unmount());await rm(dir,{recursive:true,force:true})}
});
