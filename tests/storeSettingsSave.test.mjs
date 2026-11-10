import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
test('actual store handler rejects stale/foreign contexts and synchronizes labels only when changed',async()=>{
 const dir=await mkdtemp(process.cwd()+'/tests/.store-save-');
 try {
 const app=await readFile('components/App.tsx','utf8');const handler=app.slice(app.indexOf('  const handleUpdateStore ='),app.indexOf('  const handleDeleteStore ='));
 const code=`import {storeSettingsPatch} from './services/storeSettingsPatch';
 export function fixture(){const operationalCompanyId='a',db={},visibleStores=[{id:'one',companyId:'a',paymentCommissions:{Addi:.02},labelConfig:{width:57}},{id:'two',companyId:'a'}];const contextAtRender={},operationContextRef={current:contextAtRender};const writes=[];let commits=0;const cleanObject=x=>x,doc=(_,c,id)=>({id}),writeBatch=()=>({update:(ref,data)=>writes.push({id:ref.id,data}),commit:async()=>commits++});${handler}return {save:handleUpdateStore,writes,get commits(){return commits},switchContext:()=>operationContextRef.current={},store:visibleStores[0]};}`;
 const b=await build({stdin:{contents:code,loader:'ts',resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',packages:'external'});
 await writeFile(dir+'/handler.mjs',b.outputFiles[0].text);const {fixture}=await import(pathToFileURL(dir+'/handler.mjs').href);
 const f=fixture();await f.save({...f.store,paymentCommissions:{Addi:.05}});assert.deepEqual(f.writes,[{id:'one',data:{'paymentCommissions.Addi':.05}}]);assert.equal(f.commits,1);
 await f.save({...f.store,labelConfig:{width:60}});assert.equal(f.writes.length,3);assert.equal(f.writes[2].id,'two');
 await assert.rejects(f.save({...f.store,companyId:'foreign'}));await assert.rejects(f.save({...f.store,id:'foreign'}));
 f.switchContext();await assert.rejects(f.save(f.store));assert.equal(f.commits,2);
 }finally{await rm(dir,{recursive:true,force:true});}
});
