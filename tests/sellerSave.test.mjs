import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {create,act} from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

test('user form waits, prevents double submits, preserves fields on conflicts and allows retry with a different identifier',async()=>{
 const dir=await mkdtemp(join(process.cwd(),'tests/.seller-save-'));let renderer;
 try{
 const bundle=await build({entryPoints:['components/SellerModal.tsx'],bundle:true,write:false,platform:'node',format:'esm',external:['react'],define:{'import.meta.env':JSON.stringify({VITE_VERIFIED_IDENTITY:'false'})}});
 const file=join(dir,'modal.mjs');await writeFile(file,bundle.outputFiles[0].text);const{default:Modal}=await import(pathToFileURL(file).href);
 let calls=0,rejectSave;const received=[];
 const props={isOpen:true,onClose(){},onSave:(...values)=>{calls++;received.push(values);return calls===1?new Promise((_,reject)=>rejectSave=reject):Promise.resolve();},seller:{id:'a',name:'Name',username:'reserved',password:'test-password',roleId:'r',storeId:'s'},roles:[{id:'r',name:'Vendedor',permissions:[]}],stores:[{id:'s',name:'Sede'}]};
 await act(async()=>{renderer=create(React.createElement(Modal,props));});
 const form=()=>renderer.root.findByType('form');let pending;
 await act(async()=>{pending=form().props.onSubmit({preventDefault(){}});});
 assert.equal(renderer.root.findByProps({type:'submit'}).props.disabled,true);
 assert.equal(renderer.root.findByType('fieldset').props.disabled,true);
 await act(async()=>form().props.onSubmit({preventDefault(){}}));assert.equal(calls,1);
 await act(async()=>{rejectSave(Error('Ese nombre o usuario de inicio de sesión ya está en uso. Elige uno diferente.'));await pending;});
 assert.match(renderer.root.findByProps({role:'alert'}).children.join(''),/ya está en uso/);
 assert.equal(renderer.root.findByProps({id:'sellerName'}).props.value,'Name');
 assert.equal(renderer.root.findByProps({id:'sellerUsername'}).props.value,'reserved');
 assert.equal(renderer.root.findByProps({id:'password'}).props.value,'test-password');
 assert.equal(renderer.root.findByProps({type:'submit'}).props.disabled,false);
 await act(async()=>renderer.root.findByProps({id:'sellerUsername'}).props.onChange({target:{value:''}}));
 await act(async()=>form().props.onSubmit({preventDefault(){}}));
 assert.equal(calls,2);assert.equal(received[1][4],'','clearing username is explicit, not undefined');
 assert.equal(renderer.root.findAllByProps({role:'alert'}).length,0);
 }finally{if(renderer)await act(async()=>renderer.unmount());await rm(dir,{recursive:true,force:true});}
});
