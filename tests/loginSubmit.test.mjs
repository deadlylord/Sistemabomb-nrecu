import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

test('real login form provides immediate feedback and blocks simultaneous submissions',async()=>{
 const dir=await mkdtemp(join(process.cwd(),'tests/.login-'));let renderer;
 try{
 const result=await build({bundle:true,write:false,platform:'node',format:'esm',external:['react'],entryPoints:['components/LoginView.tsx']});
 const path=join(dir,'login.mjs');await writeFile(path,result.outputFiles[0].text);
 const {default:Login}=await import(pathToFileURL(path).href);
 let calls=0,finish;const pending=new Promise(resolve=>{finish=resolve});
 await act(async()=>{renderer=create(React.createElement(Login,{isAppReady:true,onLogin:async()=>{calls++;await pending}}))});
 await act(async()=>renderer.root.findByProps({id:'username'}).props.onChange({target:{value:'stagingadmin'}}));
 await act(async()=>renderer.root.findByProps({id:'password'}).props.onChange({target:{value:'test-only'}}));
 let first;
 await act(async()=>{const submit=renderer.root.findByType('form').props.onSubmit;first=submit({preventDefault(){}});await submit({preventDefault(){}})});
 assert.equal(calls,1);assert.ok(renderer.root.findByProps({type:'submit'}).props.disabled);
 assert.ok(renderer.root.findByProps({type:'submit'}).children.join('').includes('Verificando'));
 await act(async()=>{finish();await first});
 assert.equal(renderer.root.findByProps({type:'submit'}).props.disabled,false);
 }finally{if(renderer)await act(async()=>renderer.unmount());await rm(dir,{recursive:true,force:true})}
});
