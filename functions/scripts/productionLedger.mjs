// Explicit production-only operator tool. --mode pack is offline. All other
// modes require the authorized Firebase CLI account. No business source writes.
import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { prepareCompatibleLedgerRules } from '../src/compatibleLedgerRules.mjs';
import { backfillOnlineLedger, verifyOnlineLedger } from '../src/onlineFinancialLedger.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url)),projectId='factura2-6e811';
const legacy="rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if request.auth != null; } } }";
export async function packProductionLedger() {
  const projection=await readFile(new URL('../src/financialProjection.mjs',import.meta.url),'utf8');
  const trigger=await readFile(new URL('../src/productionFinancialTrigger.mjs',import.meta.url),'utf8');
  const buildHash=createHash('sha256').update(projection).update(trigger).digest('hex').slice(0,40);
  const source='functions/.production-ledger.local';
  await mkdir(join(root,source,'src'),{recursive:true});
  await writeFile(join(root,source,'src/financialProjection.mjs'),projection);
  await writeFile(join(root,source,'src/productionFinancialTrigger.mjs'),trigger.replaceAll('__VESTIKA_LEDGER_BUILD__',buildHash));
  await writeFile(join(root,source,'src/index.mjs'),"import { initializeApp } from 'firebase-admin/app';\ninitializeApp();\nexport { productionFinancialLedgerChanged } from './productionFinancialTrigger.mjs';\n");
  for(const file of ['package.json','package-lock.json'])await writeFile(join(root,source,file),await readFile(new URL('../'+file,import.meta.url)));
  const rules=prepareCompatibleLedgerRules(legacy);
  await writeFile(join(root,'security/production-ledger.rules.local'),rules.source);
  const config={functions:[{source,codebase:'vestika-ledger-production',ignore:['node_modules','*.log','.env*']}],firestore:{rules:'security/production-ledger.rules.local'}};
  await writeFile(join(root,'firebase.production-ledger.local'),JSON.stringify(config,null,2)+'\n');
  return {buildHash,rulesHash:rules.hash,source,config:'firebase.production-ledger.local',functionName:'productionFinancialLedgerChanged'};
}
async function cliCredential() {
  const require=createRequire(import.meta.url),cache=join(homedir(),'.npm/_npx');let cli;
  try{for(const dir of await readdir(cache)){const path=join(cache,dir,'node_modules/firebase-tools/lib/auth.js');try{await access(path);cli=require(path);break;}catch{}}}catch{}
  const account=cli?.getGlobalDefaultAccount();
  if(!account)throw Error('Firebase administrative reconnection required; store login is unaffected');
  return {async getAccessToken(){const token=await cli.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);return{access_token:token.access_token,expires_in:Math.max(1,Math.floor(((token.expires_at||Date.now()+3600000)-Date.now())/1000))};}};
}
export async function runProductionLedger(args) {
  const {values}=parseArgs({args,options:{mode:{type:'string'},store:{type:'string'},after:{type:'string'}},strict:true,allowPositionals:false});
  const mode=values.mode;
  if(values.after&&(!values.store||mode!=='build'))throw Error('--after requires --mode build and --store');
  if(!['pack','check','build','verify','activate'].includes(mode))throw Error('Choose --mode pack|check|build|verify|activate');
  const bundle=await packProductionLedger();
  if(mode==='pack')return{mode,projectId,...bundle,deployed:false,sourceWrites:0};
  const credential=await cliCredential();
  async function get(url){const token=await credential.getAccessToken();const response=await fetch(url,{headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(30000)});if(!response.ok){const error=Error('Administrative request failed ('+response.status+')');error.status=response.status;throw error;}return response.json();}
  const metadata=await get('https://firestore.googleapis.com/v1/projects/'+projectId+'/databases/(default)');
  if(metadata.databaseEdition!=='STANDARD'||metadata.locationId!=='nam5'||metadata.type!=='FIRESTORE_NATIVE')throw Error('Production database identity/edition/location mismatch');
  const release=await get('https://firebaserules.googleapis.com/v1/projects/'+projectId+'/releases/cloud.firestore');
  const ruleSet=await get('https://firebaserules.googleapis.com/v1/'+release.rulesetName);
  if(ruleSet.source.files.length!==1)throw Error('Multiple production rule files require review');
  const liveRules=ruleSet.source.files[0].content;
  const rulesPatched=createHash('sha256').update(liveRules).digest('hex')===bundle.rulesHash;
  // An unknown ruleset is never silently replaced. The captured exact previous
  // source is an operator rollback artifact, separate from client deployment.
  if(!rulesPatched){const patch=prepareCompatibleLedgerRules(liveRules);await writeFile(join(root,'security/production-ledger.previous.rules.local'),liveRules,{mode:0o600});await writeFile(join(root,'security/production-ledger.previous.manifest.local'),JSON.stringify({projectId,previousRuleset:release.rulesetName,previousHash:patch.previousHash,desiredHash:patch.hash})+'\n',{mode:0o600});}
  const functionUrl='https://cloudfunctions.googleapis.com/v2/projects/'+projectId+'/locations/us-central1/functions/'+bundle.functionName;
  let server;try{server=await get(functionUrl);}catch(error){if(error.status!==404)throw error;}
  const serverReady=server?.state==='ACTIVE'&&server.labels?.vestika_ledger_build===bundle.buildHash&&server.eventTrigger?.retryPolicy==='RETRY_POLICY_RETRY'&&server.serviceConfig?.maxInstanceCount===5;
  if(mode==='check')return{mode,projectId,database:metadata.databaseEdition,location:metadata.locationId,rulesPatched,serverReady:!!serverReady,...bundle,sourceWrites:0};
  if(!rulesPatched||!serverReady)throw Error('Deploy the reviewed rules and exact isolated processor before building or activating');
  const {initializeApp}=await import('firebase-admin/app');const{getFirestore,FieldPath}=await import('firebase-admin/firestore');
  const app=initializeApp({credential,projectId},'production-ledger-operator');const db=getFirestore(app);db.settings({preferRest:true});
  try{
    const stores=await db.collection('stores').get();const selected=values.store||null;
    if(selected&&!stores.docs.some(store=>store.id===selected))throw Error('Unknown production store');
    const results=[];
    for(const store of stores.docs.filter(store=>!selected||store.id===selected)){
      const options={projectId,companyId:store.data().companyId||'default_company',storeId:store.id,documentId:FieldPath.documentId()};
      if(mode==='build')results.push(await backfillOnlineLedger(db,{...options,afterId:values.after,onProgress:value=>console.log(JSON.stringify(value))}));
      else results.push(await verifyOnlineLedger(db,{...options,activate:mode==='activate',assertDeploymentReady:async()=>{
        const current=await get(functionUrl);const currentRelease=await get('https://firebaserules.googleapis.com/v1/projects/'+projectId+'/releases/cloud.firestore');
        return current.state==='ACTIVE'&&current.labels?.vestika_ledger_build===bundle.buildHash&&currentRelease.rulesetName===release.rulesetName;
      }}));
      console.log(JSON.stringify(results.at(-1)));
    }
    return{mode,projectId,stores:results.length,sourceWrites:0,activated:mode==='activate'};
  }finally{await db.terminate();await app.delete();}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 runProductionLedger(process.argv.slice(2)).then(value=>console.log(JSON.stringify(value))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
