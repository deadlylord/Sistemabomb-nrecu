import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, writeFile, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import React, {Suspense, lazy, useEffect} from 'react';
import {create, act} from 'react-test-renderer';
import vm from 'node:vm';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

test('navigation removes the previous module immediately, including while the next lazy module loads', async()=>{
 const source=await readFile('components/App.tsx','utf8');
 const key=source.match(/<main key=\{(`[^`]+`)\}/)[1];
 const makeKey=new Function('dataScope','currentStoreId','currentView',`return ${key}`);
 let removed=0, resolve, renderer;
 function Previous(){useEffect(()=>()=>{removed++},[]);return React.createElement('div',null,'previous');}
 const Next=lazy(()=>new Promise(r=>resolve=r));
 const render=(view, child)=>React.createElement('main',{key:makeKey('carlos:company','store',view)},React.createElement(Suspense,{fallback:React.createElement('p',null,'loading')},child));
 await act(async()=>{renderer=create(render('dashboard',React.createElement(Previous)));});
 await act(async()=>renderer.update(render('developer_center',React.createElement(Next))));
 assert.equal(removed,1);assert.equal(JSON.stringify(renderer.toJSON()).includes('previous'),false);
 await act(async()=>resolve({default:()=>React.createElement('div',null,'developer')}));
 assert.equal(JSON.stringify(renderer.toJSON()).includes('developer'),true);
 await act(async()=>renderer.unmount());
});

test('render failures show recovery; a new module can still open',async()=>{
 const dir=await mkdtemp(join(process.cwd(),'tests/.recovery-'));let renderer;
 const log=console.error;console.error=()=>{};
 try{
 const result=await build({entryPoints:['components/AppErrorBoundary.tsx'],bundle:true,write:false,format:'esm',platform:'node',external:['react']});
 const path=join(dir,'boundary.mjs');await writeFile(path,result.outputFiles[0].text);
 const {default:Boundary}=await import(pathToFileURL(path).href);
 function Broken(){throw Error('chunk failed');}
 await act(async()=>{renderer=create(React.createElement(Boundary,{key:'a'},React.createElement(Broken)));});
 assert.equal(renderer.root.findByProps({role:'alert'}).findByType('button').children[0],'Volver a abrir');
 await act(async()=>renderer.update(React.createElement(Boundary,{key:'b'},React.createElement('div',null,'working'))));
 assert.equal(JSON.stringify(renderer.toJSON()).includes('working'),true);
 }finally{if(renderer)await act(async()=>renderer.unmount());console.error=log;await rm(dir,{recursive:true,force:true});}
});

test('startup bundle failure has a recovery button independently of React',async()=>{
 const listeners={};const panel={children:[],append(...items){this.children.push(...items)},remove(){this.removed=true}};
 const ctx={window:{addEventListener:(name,fn)=>listeners[name]=fn,location:{reload(){}}},document:{getElementById:()=>panel,createElement:tag=>({tag})},setTimeout:()=>1,clearTimeout(){}};
 vm.runInNewContext(await readFile('public/startup.js','utf8'),ctx);
 listeners.error({target:{tagName:'SCRIPT',type:'module'}});
 assert.equal(panel.children[1].textContent,'Intentar de nuevo');
 listeners['vestika:mounted']();assert.equal(panel.removed,true);
});

test('service worker serves an older cached chunk when deployment returns HTML or network fails; keeps one prior cache',async()=>{
 const handlers={},deleted=[],cached=new Response('old module',{headers:{'Content-Type':'application/javascript'}});
 const ctx={self:{addEventListener:(name,fn)=>handlers[name]=fn,location:{origin:'https://pos.test'},skipWaiting(){},clients:{claim(){}}},caches:{keys:async()=>['bombon-pos-cache-v1','bombon-pos-cache-v2','bombon-pos-cache-v1.1.137-local-styles'],delete:async name=>deleted.push(name),open:async()=>({match:async()=>undefined,put:async()=>{}}),match:async()=>cached.clone()},URL,Response,console,fetch:async()=>new Response('<html>',{headers:{'Content-Type':'text/html'}})};
 vm.runInNewContext(await readFile('public/sw.js','utf8'),ctx);
 let pending;handlers.activate({waitUntil:p=>pending=p});await pending;
 assert.deepEqual(deleted,['bombon-pos-cache-v1']);
 const request={url:'https://pos.test/assets/old-hash.js',method:'GET',headers:new Headers(),cache:'default',mode:'cors'};
 handlers.fetch({request,respondWith:p=>pending=p,waitUntil(){}});
 assert.equal(await (await pending).text(),'old module');
 ctx.fetch=async()=>{throw Error('offline')};
 handlers.fetch({request,respondWith:p=>pending=p,waitUntil(){}});
 assert.equal(await (await pending).text(),'old module');
 let intercepted=false;handlers.fetch({request:{...request,url:'https://pos.test/api/sales'},respondWith(){intercepted=true}});
 assert.equal(intercepted,false);
});
