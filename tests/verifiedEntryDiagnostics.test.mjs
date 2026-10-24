import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
async function fixture(env,run){
 const dir=await mkdtemp(join(process.cwd(),'tests/.entry-diagnostics-'));let r;
 try{
 const b=await build({bundle:true,write:false,format:'esm',platform:'node',external:['react'],define:{'import.meta.env':JSON.stringify({VITE_APP_ENV:env})},stdin:{contents:`export {default as Entry} from './components/VerifiedEntry';export * as meter from './services/readDiagnostics';export {control} from 'entry-control';`,resolveDir:process.cwd()},plugins:[{name:'entry-fixture',setup(b){
 b.onResolve({filter:/^entry-control$/},()=>({path:'control',namespace:'entry'}));
 b.onResolve({filter:/^\.\/LoginView$|^\.\/App$|verifiedAuth$/},a=>({path:a.path,namespace:'entry'}));
 b.onLoad({filter:/.*/,namespace:'entry'},a=>({resolveDir:process.cwd(),contents:a.path==='control'?`export const control={calls:0,resolve:null,reject:null};`:
 a.path==='./LoginView'?`import React from 'react';export default function Login(props){return React.createElement('test-login',props)}`:
 a.path==='./App'?`import React from 'react';import Panel from './components/ReadDiagnosticsPanel';export default function App(){return React.createElement(Panel,{available:true})}`:
 `import {control} from 'entry-control';export const recordVerifiedLogin=()=>{};export const loginVerified=()=>{control.calls++;return new Promise((resolve,reject)=>{control.resolve=resolve;control.reject=reject})};`}));}}]});
 const path=join(dir,'entry.mjs');await writeFile(path,b.outputFiles[0].text);const m=await import(pathToFileURL(path).href);await act(async()=>{r=create(React.createElement(m.Entry))});await run(m,r);
 }finally{if(r)await act(async()=>r.unmount());await rm(dir,{recursive:true,force:true})}
}
test('verified entry starts meter before authentication and preserves it when App mounts',()=>fixture('staging',async({meter,control},r)=>{
 const button=label=>r.root.findAllByType('button').find(b=>b.children.join('')===label);
 assert.equal(control.calls,0);await act(async()=>button('Medir ingreso').props.onClick());await act(async()=>button('Iniciar medición').props.onClick());
 const id=meter.getReadDiagnostics().session.id;let login;
 await act(async()=>{login=r.root.findByType('test-login').props.onLogin('PRIVATE_USER','PRIVATE_PASSWORD');await Promise.resolve()});assert.equal(control.calls,1);
 assert.ok(meter.getReadDiagnostics().timings.some(t=>t.phase==='Inicio de sesión: verificar acceso'&&t.status==='running'));
 await act(async()=>{control.resolve({user:{id:'user'}});await login});
 assert.equal(r.root.findAllByType('test-login').length,0);assert.equal(meter.getReadDiagnostics().session.id,id);assert.equal(meter.getReadDiagnostics().session.active,true);
 assert.ok(meter.getReadDiagnostics().timings.some(t=>t.phase==='Login: cargar aplicación'&&t.status==='success'));
 assert.ok(meter.getReadDiagnostics().timings.some(t=>t.phase==='Inicio de sesión: verificar acceso'&&t.status==='success'));
 assert.doesNotMatch(JSON.stringify(meter.getReadDiagnostics()),/PRIVATE_USER|PRIVATE_PASSWORD/);
}));
test('production entry does not expose pre-login diagnostics',()=>fixture('production',async({control},r)=>{
 assert.equal(control.calls,0);assert.equal(r.root.findAllByType('button').length,0);
}));
