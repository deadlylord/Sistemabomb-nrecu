import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
test('operator can start, observe and stop a local measurement across panel closes', async () => {
 const dir=await mkdtemp(fileURLToPath(new URL('./.read-ui-',import.meta.url)));let renderer;
 try {
  const result=await build({bundle:true,write:false,format:'esm',platform:'node',external:['react'],stdin:{contents:`export {default as Panel} from './components/ReadDiagnosticsPanel';export * as meter from './services/readDiagnostics';`,resolveDir:process.cwd()}});
  const path=join(dir,'panel.mjs');await writeFile(path,result.outputFiles[0].text);const {Panel,meter}=await import(pathToFileURL(path).href);
  await act(async()=>{renderer=create(React.createElement(Panel,{available:false}))});assert.equal(renderer.toJSON(),null);
  await act(async()=>renderer.update(React.createElement(Panel,{available:true})));
  const button=label=>renderer.root.findAllByType('button').find(b=>b.children.join('')===label);
  await act(async()=>button('Medir consultas').props.onClick());
  assert.ok(button('Iniciar medición'));await act(async()=>button('Iniciar medición').props.onClick());
  assert.equal(meter.getReadDiagnostics().session.active,true);assert.equal(renderer.root.findAllByProps({role:'dialog'}).length,0);
  meter.observeListenerSnapshot('sales',{size:50,metadata:{fromCache:false},docChanges:()=>Array.from({length:50},()=>({type:'added'}))});
  await act(async()=>button('● Midiendo · Ver / detener').props.onClick());
  assert.match(JSON.stringify(renderer.toJSON()),/Cambios desde servidor/);assert.match(JSON.stringify(renderer.toJSON()),/50/);
  await act(async()=>button('Detener').props.onClick());assert.equal(meter.getReadDiagnostics().session.active,false);
  assert.equal(button('Descargar resultado').props.disabled,false);
 }finally{if(renderer)await act(async()=>renderer.unmount());await rm(dir,{recursive:true,force:true})}
});
