import test from 'node:test';import assert from 'node:assert/strict';import{mkdtemp,readFile,writeFile,rm}from'node:fs/promises';import{join}from'node:path';import{fileURLToPath,pathToFileURL}from'node:url';import{build}from'esbuild';
test('actual incident handler keeps late collection receipts out of another context and rejects stale form callbacks',async()=>{
 const dir=await mkdtemp(fileURLToPath(new URL('./.late-incident-',import.meta.url)));
 try{
 const source=await readFile('components/App.tsx','utf8');const handler=source.slice(source.indexOf('  const handleCreateIncident ='),source.indexOf('  const handleApproveIncident ='));
 const fixture=`import {IncidentType,IncidentStatus} from './types';export const type=IncidentType.RECAUDO;
 export function makeFixture(){const operationContextRef={current:{key:'mayla:1',version:0}};const contextAtRender=operationContextRef.current;const currentUser={name:'Carlos'},currentStoreId='mayla-1',operationalCompanyId='mayla',db={};let release;const committed=new Promise(resolve=>release=resolve),receipts=[],writes=[];const writeBatch=()=>({set:(ref,data)=>writes.push(data),commit:()=>committed});const doc=()=>({id:'receipt'}),collection=()=>({}),cleanObject=value=>value;const setLastRecaudo=value=>receipts.push(value),setShowRecaudoReceipt=()=>{};${handler}return {run:()=>handleCreateIncident({type:IncidentType.RECAUDO}),switchContext:()=>operationContextRef.current={key:'other:1',version:1},release,receipts,writes};}`;
 const bundle=await build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});const path=join(dir,'incident.mjs');await writeFile(path,bundle.outputFiles[0].text);const{makeFixture}=await import(pathToFileURL(path).href);
 const f=makeFixture(),pending=f.run();f.switchContext();f.release();await pending;assert.equal(f.receipts.length,0);assert.equal(f.writes[0].companyId,'mayla');assert.equal(f.writes[0].storeId,'mayla-1');await assert.rejects(f.run());assert.equal(f.writes.length,1);
 const own=makeFixture(),ownPending=own.run();own.release();await ownPending;assert.equal(own.receipts.length,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
