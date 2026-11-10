import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {pathToFileURL} from 'node:url';import {build} from 'esbuild';import React from 'react';import {create,act} from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('label settings only confirm success after commit and show rejected saves',async()=>{
 const dir=await mkdtemp(process.cwd()+'/tests/.label-save-');let r;
 try{const b=await build({entryPoints:['components/LabelConfigPanel.tsx'],bundle:true,write:false,format:'esm',platform:'node',packages:'external'});await writeFile(dir+'/view.mjs',b.outputFiles[0].text);const {LabelConfigPanel}=await import(pathToFileURL(dir+'/view.mjs').href);
 let reject,resolve,calls=0;await act(async()=>r=create(React.createElement(LabelConfigPanel,{store:{id:'a',companyId:'co'},onSave:()=>{calls++;return new Promise((ok,no)=>{resolve=ok;reject=no;});}})));
 // Avoid serializing renderer nodes: identify the span label directly.
 const save=()=>r.root.findAllByType('button').find(b=>b.findAllByType('span').some(s=>s.children.join('')==='Guardar Configuración'));
 let p;await act(async()=>{p=save().props.onClick();});assert.equal(save().props.disabled,true);assert.ok(!JSON.stringify(r.toJSON()).includes('Configuración Guardada'));
 await act(async()=>{reject(Error('Sin permiso'));await p;});assert.match(r.root.findByProps({role:'alert'}).children.join(''),/Sin permiso/);
 await act(async()=>{p=save().props.onClick();});await act(async()=>{resolve();await p;});assert.equal(calls,2);assert.ok(JSON.stringify(r.toJSON()).includes('Configuración Guardada'));
 }finally{if(r)await act(async()=>r.unmount());await rm(dir,{recursive:true,force:true});}
});
