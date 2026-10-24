import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
const fake = `
export const calls=[],listeners=[];
export let pendingResolve;
export const snapshot=(n,fromCache=false,hasPendingWrites=false)=>({size:n,metadata:{fromCache,hasPendingWrites},docs:Array.from({length:n},()=>({data:()=>({password:'NEVER_RECORD_ME'})})),docChanges:()=>Array.from({length:n},()=>({type:'added'}))});
export const collection=(_,path)=>({path}),query=(base,...filters)=>({base,filters}),collectionGroup=(_,name)=>({name});
export const getDocs=async (...args)=>{calls.push(args);return snapshot(50)};
export const getDoc=async ref=>{calls.push(ref);if(ref.delay)return new Promise(resolve=>pendingResolve=resolve);return {exists:()=>true,metadata:{fromCache:false},data:()=>({password:'NEVER_RECORD_ME'})}};
export const getDocsFromServer=getDocs,getDocFromServer=getDoc,getAggregateFromServer=async()=>({data:()=>({amount:100})});
export const onSnapshot=(...args)=>{const i=typeof args[1]==='function'||args[1]?.next?1:2;const c={args,callback:args[i],closes:0,emit(s){typeof this.callback==='function'?this.callback(s):this.callback.next(s)}};listeners.push(c);return()=>c.closes++};
export const runTransaction=async(_,callback,options)=>{calls.push(options);let result;for(let i=0;i<2;i++){const tx={reads:0,async get(ref){if(this!==tx)throw Error('lost transaction binding');this.reads++;return {exists:()=>true,metadata:{fromCache:false}}},set(){if(this!==tx)throw Error('lost write binding');return this}};result=await callback(tx)}return result};
`;
async function withMeter(run) {
 const dir=await mkdtemp(fileURLToPath(new URL('./.read-meter-',import.meta.url)));
 try {
  const result=await build({bundle:true,write:false,format:'esm',platform:'node',stdin:{contents:`export * as meter from './services/readDiagnostics';export * as measured from './services/measuredFirestore';export * as fake from 'firebase/firestore';`,resolveDir:process.cwd()},plugins:[{name:'fake-firestore',setup(b){b.onResolve({filter:/^firebase\/firestore$/},()=>({path:'sdk',namespace:'fake'}));b.onLoad({filter:/.*/,namespace:'fake'},()=>({contents:fake}));}}]});
  const path=join(dir,'meter.mjs');await writeFile(path,result.outputFiles[0].text);await run(await import(pathToFileURL(path).href));
 }finally{await rm(dir,{recursive:true,force:true})}
}
test('inactive meter forwards queries without recording and never exports document data',()=>withMeter(async({meter,measured,fake})=>{
 const q=measured.query(measured.collection({},'sales'),{filter:'secret-filter'});
 const result=await measured.getDocs(q);assert.equal(fake.calls.length,1);assert.equal(result.size,50);assert.equal(meter.getReadDiagnostics().rows.length,0);
 meter.startReadMeasurement('Abrir reporte');meter.setReadContext({view:'Reportes',companyId:'company',storeId:'store'});
 const returned=await measured.getDocs(q);assert.equal(returned.size,50);assert.equal(fake.calls.length,2);
 const value=meter.getReadDiagnostics();assert.equal(value.rows[0].requests,1);assert.equal(value.rows[0].serverChanges,50);assert.equal(value.rows[0].resource,'sales');
 assert.doesNotMatch(JSON.stringify(value),/NEVER_RECORD_ME|secret-filter|password/);
}));
test('listener keeps original options and callbacks while separating cache, local and server changes',()=>withMeter(async({meter,measured,fake})=>{
 meter.startReadMeasurement('Inventario');const snapshots=[],options={includeMetadataChanges:true};
 const close=measured.onSnapshot({path:'inventory/private-product-id'},options,s=>snapshots.push(s));
 const listener=fake.listeners[0];assert.equal(listener.args[1],options);
 const cache=fake.snapshot(3,true),local=fake.snapshot(2,false,true),server=fake.snapshot(1,false);
 listener.emit(cache);listener.emit(local);listener.emit(server);
 assert.deepEqual(snapshots,[cache,local,server]);const value=meter.getReadDiagnostics(),row=value.rows[0];
 assert.equal(row.cacheChanges,3);assert.equal(row.pendingChanges,2);assert.equal(row.serverChanges,1);assert.equal(row.largestResult,3);
 assert.doesNotMatch(JSON.stringify(value),/private-product-id/);assert.equal(value.activeListeners,1);
 close();assert.equal(fake.listeners[0].closes,1);assert.equal(meter.getReadDiagnostics().activeListeners,0);
}));
test('existing listeners are counted at start; stopped and previous sessions ignore late query responses',()=>withMeter(async({meter,measured,fake})=>{
 const close=measured.onSnapshot({path:'sales'},()=>{});meter.startReadMeasurement('Primera');assert.equal(meter.getReadDiagnostics().session.initialListeners,1);
 const pending=measured.getDoc({path:'inventory/private',delay:true});meter.stopReadMeasurement();meter.startReadMeasurement('Segunda');
 fake.pendingResolve({exists:()=>true,metadata:{fromCache:false}});await pending;
 assert.equal(meter.getReadDiagnostics().rows.length,0);close();meter.stopReadMeasurement();
 const saved=meter.getReadDiagnostics();await measured.getDocs({path:'sales'});assert.deepEqual(meter.getReadDiagnostics(),saved);
}));
test('transaction instrumentation preserves method bindings, options, results and counts retry reads',()=>withMeter(async({meter,measured})=>{
 meter.startReadMeasurement('Guardar venta');const options={maxAttempts:2};
 const result=await measured.runTransaction({},async tx=>{await tx.get({path:'inventory/product'});tx.set({path:'sales/sale'},{});return 'saved'},options);
 assert.equal(result,'saved');const value=meter.getReadDiagnostics();assert.equal(value.session.transactionAttempts,2);
 assert.equal(value.rows[0].requests,2);assert.equal(value.rows[0].serverChanges,2);
}));
test('timings retain transaction confirmation, retry callbacks and results without retaining payloads',()=>withMeter(async({meter,measured})=>{
 meter.startReadMeasurement('Guardar');
 const saved=await measured.runTransaction({},async tx=>{await tx.get({path:'financialRecords/private-id'});return {secret:'PRIVATE_PAYLOAD'};});
 assert.equal(saved.secret,'PRIVATE_PAYLOAD');
 const timings=meter.getReadDiagnostics().timings;
 assert.equal(timings.filter(t=>t.phase==='Transacción completa').length,1);
 assert.equal(timings.filter(t=>t.phase==='Callback de transacción').length,2);
 assert.ok(timings.every(t=>t.status==='success'&&t.durationMs>=0));
 assert.ok(timings[0].durationMs>=timings.slice(1).reduce((n,t)=>n+t.durationMs,0));
 assert.doesNotMatch(JSON.stringify(meter.getReadDiagnostics()),/PRIVATE_PAYLOAD|private-id/);
}));
test('timings distinguish failure and incomplete work and reject late completion across sessions',()=>withMeter(async({meter})=>{
 assert.equal(meter.beginDiagnosticPhase('Transacción completa'),undefined);
 meter.startReadMeasurement('Guardar');
 const error=Error('PRIVATE_ERROR');
 await assert.rejects(meter.measureDiagnosticPhase('Validar empresa y referencias',async()=>{throw error}),e=>e===error);
 assert.equal(meter.getReadDiagnostics().timings[0].status,'error');
 assert.doesNotMatch(JSON.stringify(meter.getReadDiagnostics()),/PRIVATE_ERROR/);
 const ticket=meter.beginDiagnosticPhase('Transacción completa');meter.stopReadMeasurement();
 assert.equal(meter.getReadDiagnostics().timings[1].status,'incomplete');
 const before=meter.getReadDiagnostics();meter.finishDiagnosticPhase(ticket);assert.deepEqual(meter.getReadDiagnostics(),before);
 meter.startReadMeasurement('Otra');meter.finishDiagnosticPhase(ticket);assert.equal(meter.getReadDiagnostics().timings.length,0);
 for(let i=0;i<205;i++)meter.beginDiagnosticPhase('Transacción completa');
 assert.equal(meter.getReadDiagnostics().timings.length,200);assert.equal(meter.getReadDiagnostics().session.droppedTimings,5);
}));
