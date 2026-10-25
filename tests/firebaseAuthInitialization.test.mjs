import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const staging = { VITE_APP_ENV: 'staging', VITE_VERIFIED_IDENTITY: 'true', VITE_FIREBASE_API_KEY: 'fixture', VITE_FIREBASE_AUTH_DOMAIN: 'vestika-staging.firebaseapp.com', VITE_FIREBASE_PROJECT_ID: 'vestika-staging', VITE_FIREBASE_STORAGE_BUCKET: 'fixture', VITE_FIREBASE_MESSAGING_SENDER_ID: 'fixture', VITE_FIREBASE_APP_ID: 'fixture' };
async function initialize(env) {
  const dir = await mkdtemp(join(process.cwd(), 'tests/.auth-init-'));
  const modules = {
    'fixture': `export const calls=[];export const auth={};`,
    'firebase/app': `export const initializeApp=options=>({options});`,
    'firebase/auth': `import {calls,auth} from 'fixture';
      export const indexedDBLocalPersistence={kind:'indexedDB'},browserLocalPersistence={kind:'local'},browserSessionPersistence={kind:'session'};
      export const getAuth=app=>{calls.push({method:'getAuth',app});return auth};
      export const initializeAuth=(app,options)=>{calls.push({method:'initializeAuth',app,options});return auth};
      export const connectAuthEmulator=(instance,url)=>calls.push({method:'emulator',same:instance===auth,url});`,
    'firebase/firestore': `export const initializeFirestore=()=>({}),getFirestore=()=>({}),memoryLocalCache=()=>({}),persistentLocalCache=()=>({}),persistentMultipleTabManager=()=>({}),clearIndexedDbPersistence=async()=>{},connectFirestoreEmulator=()=>{};`,
    'firebase/storage': `export const getStorage=()=>({}),connectStorageEmulator=()=>{};`
  };
  try {
    const bundle = await build({ bundle:true, write:false, format:'esm', platform:'node', define:{'import.meta.env':JSON.stringify(env)}, stdin:{contents:"export * from './firebase';export {calls,auth as expectedAuth} from 'fixture';",resolveDir:process.cwd()}, plugins:[{name:'sdk',setup(b){
      b.onResolve({filter:/^(fixture|firebase\/(app|auth|firestore|storage))$/},a=>({path:a.path,namespace:'fake'}));
      b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:modules[a.path]}));
    }}] });
    const path=join(dir,'init.mjs');await writeFile(path,bundle.outputFiles[0].text);
    return await import(pathToFileURL(path).href);
  } finally { await rm(dir,{recursive:true,force:true}); }
}

test('verified staging skips popup preparation while retaining all default persistence fallbacks in order',async()=>{
  const {calls,auth,expectedAuth}=await initialize(staging);
  assert.equal(auth,expectedAuth);assert.equal(calls.length,1);assert.equal(calls[0].method,'initializeAuth');
  assert.deepEqual(calls[0].options.persistence.map(p=>p.kind),['indexedDB','local','session']);
  assert.equal('popupRedirectResolver' in calls[0].options,false);
  assert.deepEqual(Object.keys(calls[0].options),['persistence']);
});
test('legacy staging and other preview projects keep the existing Auth initialization',async()=>{
  for(const env of [{...staging,VITE_VERIFIED_IDENTITY:'false'}, {...staging,VITE_FIREBASE_PROJECT_ID:'another-preview'}, {...staging,VITE_APP_ENV:'preview'}]){
    const {calls}=await initialize(env);assert.equal(calls.length,1);assert.equal(calls[0].method,'getAuth');
  }
});
test('verified staging still connects its Auth instance to the configured emulator',async()=>{
  const {calls}=await initialize({...staging,VITE_USE_FIREBASE_EMULATORS:'true',VITE_FIREBASE_EMULATOR_HOST:'127.0.0.1',VITE_AUTH_EMULATOR_PORT:'9099'});
  assert.deepEqual(calls.map(c=>c.method),['initializeAuth','emulator']);
  assert.equal(calls[1].same,true);assert.equal(calls[1].url,'http://127.0.0.1:9099');
});

test('production POS keeps anonymous-auth persistence without an external popup resolver',async()=>{
 const {calls,auth,expectedAuth}=await initialize({VITE_APP_ENV:'production',VITE_VERIFIED_IDENTITY:'false'});
 assert.equal(auth,expectedAuth);assert.equal(calls.length,1);assert.equal(calls[0].method,'initializeAuth');
 assert.equal(calls[0].app.options.projectId,'factura2-6e811');
 assert.deepEqual(calls[0].options.persistence.map(p=>p.kind),['indexedDB','local','session']);
 assert.equal('popupRedirectResolver' in calls[0].options,false);
});
