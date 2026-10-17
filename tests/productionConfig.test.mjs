import test from 'node:test';import assert from 'node:assert/strict';
import {resolveFirebaseConfig} from '../services/firebaseConfig.ts';
const staging={VITE_APP_ENV:'staging',VITE_FIREBASE_API_KEY:'fixture',VITE_FIREBASE_AUTH_DOMAIN:'vestika-staging.firebaseapp.com',VITE_FIREBASE_PROJECT_ID:'vestika-staging',VITE_FIREBASE_STORAGE_BUCKET:'vestika-staging.firebasestorage.app',VITE_FIREBASE_MESSAGING_SENDER_ID:'fixture',VITE_FIREBASE_APP_ID:'fixture'};
test('production retains its existing web configuration even without new Netlify variables',()=>{
 const result=resolveFirebaseConfig({VITE_APP_ENV:'production'});assert.equal(result.firebaseConfig.projectId,'factura2-6e811');assert.equal(result.firebaseConfig.authDomain,'factura2-6e811.firebaseapp.com');assert.equal(result.useEmulators,false);
});
test('staging must provide its config and can never inherit the production fallback',()=>{
 assert.throws(()=>resolveFirebaseConfig({VITE_APP_ENV:'staging'}),/incomplete/);
 assert.equal(resolveFirebaseConfig(staging).firebaseConfig.projectId,'vestika-staging');
 assert.throws(()=>resolveFirebaseConfig({...staging,VITE_FIREBASE_PROJECT_ID:'factura2-6e811'}),/cannot use production/);
});
test('production refuses staging projects and emulators before initializing Firebase',()=>{
 assert.throws(()=>resolveFirebaseConfig({...staging,VITE_APP_ENV:'production'}),/Safety guard/);
 assert.throws(()=>resolveFirebaseConfig({VITE_APP_ENV:'production',VITE_USE_FIREBASE_EMULATORS:'true'}),/Safety guard/);
});
