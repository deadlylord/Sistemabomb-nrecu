import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {create,act} from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('incident editor waits for commit and preserves edits on Firebase rejection',async()=>{
 const dir=await mkdtemp(process.cwd()+'/tests/.incident-edit-');let r;
 try {
 const b=await build({entryPoints:['components/EditIncidentModal.tsx'],bundle:true,write:false,format:'esm',platform:'node',packages:'external'});
 await writeFile(dir+'/edit.mjs',b.outputFiles[0].text);const {default:Modal}=await import(pathToFileURL(dir+'/edit.mjs').href);
 let rejectSave,closed=0,calls=0;const pending=new Promise((_,reject)=>rejectSave=reject);
 await act(async()=>{r=create(React.createElement(Modal,{isOpen:true,isAdmin:true,incident:{id:'i',type:'Otro',description:'Inicial',createdAt:'2026-11-08T12:00:00Z',status:'Pendiente'},onClose:()=>closed++,onUpdateIncident:()=>{calls++;return pending;}}));});
 let saving;await act(async()=>{saving=r.root.findByType('form').props.onSubmit({preventDefault(){}});});
 assert.equal(closed,0);assert.equal(calls,1);assert.equal(r.root.findAllByType('button').find(b=>b.props.type==='submit').props.disabled,true);
 await act(async()=>{rejectSave(Error('Sin permiso de Firebase'));await saving;});
 assert.equal(closed,0);assert.match(r.root.findByProps({role:'alert'}).children.join(''),/Sin permiso/);
 assert.equal(r.root.findByType('textarea').props.value,'Inicial');
 await act(async()=>r.update(React.createElement(Modal,{...r.root.findByType(Modal).props,onUpdateIncident:async()=>{calls++;}})));
 await act(async()=>r.root.findByType('form').props.onSubmit({preventDefault(){}}));
 assert.equal(closed,1);assert.equal(calls,2);
 }finally{if(r)await act(async()=>r.unmount());await rm(dir,{recursive:true,force:true});}
});
