import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('entry modal portals to body, follows keyboard viewport and locks background until closed',async()=>{
 const dir=await mkdtemp(join(process.cwd(),'tests/.manual-modal-'));
 const old={document:globalThis.document,window:globalThis.window};let renderer,closed=0,restored=0;
 const keys=new Map(),events=new Map();const body={style:{overflow:'auto'}};
 const visual={height:700,offsetTop:0,addEventListener:(k,v)=>events.set(k,v),removeEventListener:k=>events.delete(k)};
 globalThis.document={body,activeElement:{isConnected:true,focus:()=>restored++},addEventListener:(k,v)=>keys.set(k,v),removeEventListener:k=>keys.delete(k)};
 globalThis.window={visualViewport:visual};
 try{
 const bundle=await build({bundle:true,write:false,format:'esm',platform:'node',external:['react'],entryPoints:['components/ManualEntryModalShell.tsx'],plugins:[{name:'portal-spy',setup(b){b.onResolve({filter:/^react-dom$/},()=>({path:'portal',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const createPortal=(child,target)=>{globalThis.__portalTarget=target;return child}'}));}}]});
 const path=join(dir,'shell.mjs');await writeFile(path,bundle.outputFiles[0].text);const {default:Shell}=await import(pathToFileURL(path).href);
 const element=saving=>React.createElement(Shell,{saving,onClose:()=>closed++},React.createElement('button',null,'Guardar'));
 await act(async()=>{renderer=create(element(false))});assert.equal(globalThis.__portalTarget,body);assert.equal(body.style.overflow,'hidden');
 const dialog=()=>renderer.root.findByProps({'data-manual-entry-dialog':'true'});
 assert.equal(dialog().props.style.height,700);
 await act(async()=>{visual.height=320;visual.offsetTop=20;events.get('resize')()});
 assert.deepEqual(dialog().props.style,{top:20,height:320});
 await act(async()=>renderer.update(element(true)));keys.get('keydown')({key:'Escape',preventDefault(){}});assert.equal(closed,0);
 await act(async()=>renderer.update(element(false)));keys.get('keydown')({key:'Escape',preventDefault(){}});assert.equal(closed,1);
 await act(async()=>renderer.unmount());renderer=null;
 assert.equal(body.style.overflow,'auto');assert.equal(restored,1);assert.equal(keys.size,0);assert.equal(events.size,0);
 }finally{if(renderer)await act(async()=>renderer.unmount());Object.assign(globalThis,old);delete globalThis.__portalTarget;await rm(dir,{recursive:true,force:true})}
});
