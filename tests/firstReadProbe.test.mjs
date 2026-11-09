import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
async function fixture(run,env='staging'){
 const dir=await mkdtemp(join(process.cwd(),'tests/.first-read-'));
 const target={companyId:'a',storeId:'a1',incidentId:'private-id'};
 const c={calls:[],current:true,claims:{identityVersion:1,companyId:'a'},project:'vestika-staging',data:{companyId:'a',storeId:'a1',description:'PRIVATE_PAYLOAD'},afterRead:null,hold:null};
 const user={getIdTokenResult:async force=>{c.calls.push(['token',force]);return{claims:c.claims,token:'SECRET_TOKEN'}}};
 c.db={app:{options:{projectId:c.project}}};
 c.auth={app:{options:{projectId:c.project}},currentUser:user,authStateReady:async()=>{c.calls.push(['auth-ready'])}};
 globalThis.__probe=c;
 try{
 const b=await build({stdin:{contents:"export * from './services/firstReadProbe';export * as meter from './services/readDiagnostics';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.env.VITE_APP_ENV':JSON.stringify(env)},plugins:[{name:'staging-read-only',setup(b){b.onResolve({filter:/\/firebase$/},()=>({path:'firebase',namespace:'probe'}));b.onResolve({filter:/\/measuredFirestore$/},()=>({path:'firestore',namespace:'probe'}));b.onLoad({filter:/.*/,namespace:'probe'},a=>({contents:a.path==='firebase'?`export const auth=globalThis.__probe.auth;export const db=globalThis.__probe.db;`:`const c=globalThis.__probe;export const doc=(_,name,id)=>({path:name+'/'+id});
 const snap=()=>({exists:()=>true,data:()=>c.data});
 async function read(kind){c.calls.push([kind]);if(c.hold)await c.hold;c.afterRead?.();return snap();}
 export const getDocFromServer=()=>read('direct');
 export const runTransaction=async(_,callback,options)=>{c.calls.push(['transaction',options]);return callback({get:()=>read('transaction-get')});};`}));}}]});
 const path=join(dir,'probe.mjs');await writeFile(path,b.outputFiles[0].text);const m=await import(pathToFileURL(path).href);m.meter.setReadContext({view:'incidents',companyId:'a',storeId:'a1'});m.meter.startReadMeasurement('test');
 await run({c,target,user,...m});m.meter.stopReadMeasurement();
 }finally{delete globalThis.__probe;await rm(dir,{recursive:true,force:true});}
}
test('explicit probe uses four read-only document reads, reversed order, no forced token refresh or exported payload',()=>fixture(async({c,target,probeFirstRead,meter})=>{
 assert.equal(c.calls.length,0,'no automatic auth calls or reads');await probeFirstRead(target,()=>c.current);
 assert.deepEqual(c.calls.map(c=>c[0]),['auth-ready','token','direct','transaction','transaction-get','transaction','transaction-get','direct']);assert.equal(c.calls[1][1],false);
 assert.ok(c.calls.filter(c=>c[0]==='transaction').every(c=>c[1].maxAttempts===1));
 const report=JSON.stringify(meter.getReadDiagnostics());for(const value of ['PRIVATE_PAYLOAD','SECRET_TOKEN','private-id'])assert.ok(!report.includes(value));assert.equal(meter.getReadDiagnostics().timings.filter(t=>t.phase.startsWith('Primera lectura:')).length,6);
}));
test('production environment cannot start the probe',()=>fixture(async({c,target,probeFirstRead})=>{await assert.rejects(probeFirstRead(target,()=>true),/staging/);assert.equal(c.calls.length,0);},'production'));
test('production Firebase project cannot be queried even with staging UI',()=>fixture(async({c,target,probeFirstRead})=>{for(const instance of [c.auth,c.db]){instance.app.options.projectId='factura2-6e811';await assert.rejects(probeFirstRead(target,()=>true),/staging/);assert.equal(c.calls.length,0);instance.app.options.projectId='vestika-staging';}}));
test('mismatched company or store stops after first response with no follow-up reads',()=>fixture(async({c,target,probeFirstRead})=>{
 for(const data of [{companyId:'b',storeId:'a1'},{companyId:'a',storeId:'other'}]){c.calls=[];c.data=data;await assert.rejects(probeFirstRead(target,()=>true),/empresa y sede/);assert.equal(c.calls.filter(c=>c[0]==='direct').length,1);assert.equal(c.calls.filter(c=>c[0]==='transaction').length,0);}
}));
test('context or identity replacement interrupts the probe before another read',()=>fixture(async({c,target,probeFirstRead})=>{
 c.afterRead=()=>c.current=false;await assert.rejects(probeFirstRead(target,()=>c.current),/cambió/);assert.equal(c.calls.filter(c=>c[0]==='transaction').length,0);
 c.current=true;c.calls=[];c.afterRead=()=>c.auth.currentUser={};await assert.rejects(probeFirstRead(target,()=>true),/sesión cambió/);assert.equal(c.calls.filter(c=>c[0]==='transaction').length,0);
}));
test('unknown user, wrong tenant identity or inactive measurement cannot query documents',()=>fixture(async({c,target,user,probeFirstRead,meter})=>{
 c.auth.currentUser=null;await assert.rejects(probeFirstRead(target,()=>true),/sesión/);c.auth.currentUser=user;c.claims.companyId='foreign';await assert.rejects(probeFirstRead(target,()=>true),/identidad/);assert.equal(c.calls.filter(c=>c[0]==='direct').length,0);
 c.claims.companyId='a';meter.stopReadMeasurement();await assert.rejects(probeFirstRead(target,()=>true),/medición cambió/);
}));
test('pending business approval prevents the probe and remains independently guarded',()=>fixture(async({c,target,probeFirstRead,meter})=>{
 const end=meter.beginIncidentApproval();await assert.rejects(probeFirstRead(target,()=>true),/aprobación/);assert.equal(c.calls.length,0);end();end();assert.equal(meter.incidentApprovalInFlight(),false);await probeFirstRead(target,()=>true);
}));
test('two probe clicks never run parallel experiments',()=>fixture(async({c,target,probeFirstRead})=>{
 let release;c.hold=new Promise(resolve=>release=resolve);const first=probeFirstRead(target,()=>true);await new Promise(resolve=>setImmediate(resolve));await assert.rejects(probeFirstRead(target,()=>true),/curso/);c.hold=null;release();await first;
 assert.equal(c.calls.filter(c=>c[0]==='direct').length,2);
}));
test('replacing the measurement aborts the old probe and leaves the new capture active',()=>fixture(async({c,target,probeFirstRead,meter})=>{
 c.afterRead=()=>meter.startReadMeasurement('new capture');await assert.rejects(probeFirstRead(target,()=>true),/medición cambió/);
 assert.equal(c.calls.filter(c=>c[0]==='transaction').length,0);assert.equal(meter.getReadDiagnostics().session.label,'new capture');assert.equal(meter.readMeasurementActive(),true);
}));
