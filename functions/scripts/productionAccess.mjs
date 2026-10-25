import {createRequire} from 'node:module';
import {readdir} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {operatorFirestoreOptions} from './productionLedger.mjs';
export const PRODUCTION_PROJECT = 'factura2-6e811';
export async function productionAccess() {
 const require=createRequire(import.meta.url);
 let cli,account;
 for(const dir of await readdir(join(homedir(),'.npm/_npx')).catch(()=>[]))try{
  const candidate=require(join(homedir(),'.npm/_npx',dir,'node_modules/firebase-tools/lib/auth.js'));
  const value=candidate.getGlobalDefaultAccount();if(value){cli=candidate;account=value;break;}
 }catch{}
 if(!account)throw Error('Firebase administrative reconnection required');
 const credential={async getAccessToken(){const t=await cli.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);return{access_token:t.access_token,expires_in:Math.max(1,Math.floor(((t.expires_at||Date.now()+3600000)-Date.now())/1000))};}};
 const {Firestore}=require('firebase-admin/firestore');
 const db=new Firestore(operatorFirestoreOptions(credential));
 async function request(url,options={}){
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'||!['firestore.googleapis.com','firebaserules.googleapis.com','cloudfunctions.googleapis.com','secretmanager.googleapis.com','iam.googleapis.com','serviceusage.googleapis.com','identitytoolkit.googleapis.com'].includes(parsed.hostname)||!['/projects/'+PRODUCTION_PROJECT+'/', '/projects/1038601908493/'].some(prefix=>parsed.pathname.includes(prefix)))throw Error('Production administrative target rejected');
  const token=await credential.getAccessToken();
  const r=await fetch(url,{...options,headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(45000)});
  const body=await r.json();if(!r.ok){const e=Error('Production administrative operation failed ('+r.status+')');e.status=r.status;throw e;}return body;
 }
 return{db,credential,request};
}
