import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { build } from 'esbuild';
async function fixture(run) {
  const dir=await mkdtemp(fileURLToPath(new URL('./.verified-auth-',import.meta.url)));
  const modules={
    'fixture-control': `export const control={calls:[],listeners:new Set(),snapshots:[],serverError:null,nextClaims:null,signedIn:0,signouts:0};
      control.claims={identityVersion:1,authVersion:1,sellerId:'u',companyId:'a',storeId:'a1',roleId:'r'};
      control.user={id:'u',companyId:'a',storeId:'a1',roleId:'r',authVersion:1,name:'User'};
      control.auth={app:{options:{projectId:'vestika-staging'}},currentUser:null};
      control.emit=()=>control.listeners.forEach(f=>f(control.auth.currentUser));
      control.makeSigned=claims=>({getIdTokenResult:async()=>({claims:{...claims}})});`,
    '../firebase': `import {control} from 'fixture-control';export const db={};export const auth=control.auth;`,
    'firebase/auth': `import {control} from 'fixture-control';
      export async function signOut(auth){control.signouts++;auth.currentUser=null;control.emit()}
      export async function signInWithCustomToken(auth,token){control.signedIn++;auth.currentUser=control.makeSigned(control.nextClaims||control.claims);control.emit();return {user:auth.currentUser}}
      export function onIdTokenChanged(auth,apply){control.listeners.add(apply);queueMicrotask(()=>apply(auth.currentUser));return()=>control.listeners.delete(apply)}`,
    'firebase/functions': `import {control} from 'fixture-control';
      export const getFunctions=(app,region)=>({app,region});
      export const httpsCallable=(_,name)=>async data=>{control.calls.push({name,data});if(control.serverError)throw control.serverError;return {data:{customToken:'fixture-token',user:control.user,store:{id:'a1',companyId:'a'},role:{id:'r',companyId:'a'},company:{id:'a'}}}};`,
    'firebase/firestore': `import {control} from 'fixture-control';export const addDoc=async()=>{};export const collection=(_,name)=>({name});export const doc=(_,name,id)=>({name,id});
      export const onSnapshot=(ref,apply,error)=>{const item={ref,apply,error,closed:false};control.snapshots.push(item);queueMicrotask(()=>{if(!item.closed)apply({exists:()=>true,data:()=>ref.name==='sellers'?control.user:{companyId:'a'}})});return()=>{item.closed=true}};`
  };
  try {
    const result=await build({bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.env':JSON.stringify({VITE_VERIFIED_IDENTITY:'true'})},stdin:{contents:"export * from './services/verifiedAuth';export * as meter from './services/readDiagnostics';export {control} from 'fixture-control';",resolveDir:process.cwd()},plugins:[{name:'verified-fixtures',setup(b){b.onResolve({filter:/^(fixture-control|firebase\/(auth|functions|firestore)|\.\.\/firebase)$/},a=>({path:a.path,namespace:'fake'}));b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:modules[a.path]}));}}]});
    const path=join(dir,'auth.mjs');await writeFile(path,result.outputFiles[0].text);await run(await import(pathToFileURL(path).href));
  }finally{await rm(dir,{recursive:true,force:true});}
}
test('verified login uses server credentials, validates signed claims and performs no client seller query',()=>fixture(async({loginVerified,control,meter})=>{
  meter.startReadMeasurement('Ingreso al POS');
  assert.equal(control.calls.length,0);assert.equal(control.snapshots.length,0);
  const result=await loginVerified(' MiXeD.Legacy ','test-only-password');
  assert.equal(result.user.id,'u');assert.equal(control.calls.length,1);assert.equal(control.calls[0].name,'vestikaStagingLogin');
  assert.equal(control.snapshots.length,0);assert.equal(control.signedIn,1);assert.equal('password' in result.user,false);
  assert.deepEqual(meter.getReadDiagnostics().timings.map(t=>t.phase),['Login: servicio de identidad','Login: autenticar en Firebase','Login: validar identidad']);
  assert.ok(meter.getReadDiagnostics().timings.every(t=>t.status==='success'));
  assert.doesNotMatch(JSON.stringify(meter.getReadDiagnostics()),/test-only-password|fixture-token|MiXeD/);
}));
test('failed login never falls back to a client identity scan; wrong server project is rejected',()=>fixture(async({loginVerified,control})=>{
  control.serverError=new Error('unauthenticated');await assert.rejects(loginVerified('user','wrong'));
  assert.equal(control.snapshots.length,0);assert.equal(control.signedIn,0);
  control.auth.app.options.projectId='factura2-6e811';await assert.rejects(loginVerified('user','secret'),/staging/);assert.equal(control.calls.length,1);
}));
test('inconsistent token identity is rejected and the Firebase session is cleared',()=>fixture(async({loginVerified,control})=>{
  control.nextClaims={...control.claims,companyId:'other'};await assert.rejects(loginVerified('user','secret'),/identidad/);assert.equal(control.auth.currentUser,null);
}));
test('revocation and cross-tab account changes invalidate once; old tab cannot sign out the new user',()=>fixture(async({loginVerified,watchVerifiedIdentity,logoutVerified,control})=>{
  const{user}=await loginVerified('user','secret');let invalidated=0;
  const stop=watchVerifiedIdentity(user,()=>invalidated++);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(invalidated,0);
  control.auth.currentUser=control.makeSigned({...control.claims,sellerId:'other'});control.emit();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(invalidated,1);
  const count=control.signouts;await logoutVerified('u');assert.equal(control.signouts,count,'do not terminate the newer shared Firebase identity');
  control.snapshots[0].apply({exists:()=>true,data:()=>({...user,authVersion:2})});assert.equal(invalidated,1);
  stop();assert.equal(control.listeners.size,0);assert.ok(control.snapshots.every(s=>s.closed));
}));
