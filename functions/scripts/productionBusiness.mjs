import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {productionAccess,PRODUCTION_PROJECT} from './productionAccess.mjs';
import {prepareCompatibleIdentityRules} from '../src/compatibleIdentityRules.mjs';
import {prepareCompatibleBusinessRules} from '../src/compatibleBusinessRules.mjs';
import {buildBusinessStore,verifyBusinessStore} from '../src/onlineBusinessSummary.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const names=['Sales','Layaways','Incidents','Expenses','Inventory'].map(s=>'productionBusiness'+s+'Changed');
export async function packProductionBusiness(){
 const files=['businessSummary.mjs','onlineBusinessSummary.mjs','financialProjection.mjs','productionBusinessTrigger.mjs'];
 const contents=await Promise.all(files.map(f=>readFile(new URL('../src/'+f,import.meta.url),'utf8')));
 const buildHash=createHash('sha256').update(contents.join('\n')).digest('hex').slice(0,40),source='functions/.production-business.local';
 await mkdir(join(root,source,'src'),{recursive:true});
 for(let i=0;i<files.length;i++)await writeFile(join(root,source,'src',files[i]),contents[i].replaceAll('__VESTIKA_BUSINESS_BUILD__',buildHash));
 await writeFile(join(root,source,'src/index.mjs'),"import {initializeApp} from 'firebase-admin/app';\ninitializeApp();\nexport * from './productionBusinessTrigger.mjs';\n");
 for(const f of ['package.json','package-lock.json'])await writeFile(join(root,source,f),await readFile(new URL('../'+f,import.meta.url)));
 await writeFile(join(root,'firebase.production-business.local'),JSON.stringify({functions:[{source,codebase:'vestika-business-production',ignore:['node_modules','*.log','.env*']}],firestore:{rules:'security/production-business.rules.local'}},null,2));
 return{source,buildHash,config:'firebase.production-business.local',names};
}
export async function runProductionBusiness(args){
 const {values}=parseArgs({args,options:{mode:{type:'string'},store:{type:'string'}},strict:true});
 if(!['pack','check','build','verify','activate'].includes(values.mode))throw Error('Use --mode pack|check|build|verify|activate');
 const bundle=await packProductionBusiness();if(values.mode==='pack')return{projectId:PRODUCTION_PROJECT,...bundle,deployed:false};
 const {db,request}=await productionAccess();
 try{
  const metadata=await request(`https://firestore.googleapis.com/v1/projects/${PRODUCTION_PROJECT}/databases/(default)`);
  if(metadata.databaseEdition!=='STANDARD'||metadata.locationId!=='nam5')throw Error('Production database mismatch');
  const releaseUrl=`https://firebaserules.googleapis.com/v1/projects/${PRODUCTION_PROJECT}/releases/cloud.firestore`;
  const release=await request(releaseUrl),ruleset=await request('https://firebaserules.googleapis.com/v1/'+release.rulesetName);
  if(ruleset.source.files.length!==1)throw Error('Multiple rules files require review');
  const current=ruleset.source.files[0].content;let patch;
  try{patch=prepareCompatibleBusinessRules(current);}catch(error){const identity=prepareCompatibleIdentityRules(current);if(identity.hash!==identity.previousHash)throw error;patch={source:current,hash:identity.hash,previousHash:identity.previousHash};}
  await writeFile(join(root,'security/production-business.rules.local'),patch.source);
  await mkdir(join(root,'security/.production-rollout.local'),{recursive:true,mode:0o700});
  const backup=join(root,'security/.production-rollout.local/business-rules-before.json');
  try{await writeFile(backup,JSON.stringify({ruleset:release.rulesetName,source:current}),{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}
  const functionsUrl=`https://cloudfunctions.googleapis.com/v2/projects/${PRODUCTION_PROJECT}/locations/us-central1/functions`;
  const functions=await request(functionsUrl+'?pageSize=1000');
  const serverReady=names.every(n=>functions.functions?.some(f=>f.name.endsWith('/'+n)&&f.state==='ACTIVE'&&f.labels?.vestika_business_build===bundle.buildHash&&f.eventTrigger?.retryPolicy==='RETRY_POLICY_RETRY'));
  const rulesReady=patch.hash===patch.previousHash;
  if(values.mode==='check')return{projectId:PRODUCTION_PROJECT,...bundle,serverReady,rulesReady,previousRuleset:release.rulesetName,sourceWrites:0};
  if(!serverReady||!rulesReady)throw Error('Deploy the exact isolated business processors and reviewed rules first');
  const stores=await db.collection('stores').get();if(values.store&&!stores.docs.some(s=>s.id===values.store))throw Error('Unknown production store');
  const {FieldPath}=await import('firebase-admin/firestore');
  const results=[];for(const store of stores.docs.filter(s=>!values.store||s.id===values.store)){
   const options={companyId:store.data().companyId||'default_company',storeId:store.id,documentId:FieldPath.documentId(),onProgress:v=>console.log(JSON.stringify(v)),activate:values.mode==='activate',assertDeploymentReady:async()=>{
    const r=await request(releaseUrl),f=await request(functionsUrl+'?pageSize=1000');return r.rulesetName===release.rulesetName&&names.every(n=>f.functions?.some(x=>x.name.endsWith('/'+n)&&x.state==='ACTIVE'&&x.labels?.vestika_business_build===bundle.buildHash));
   }};
   const result=values.mode==='build'?await buildBusinessStore(db,options):await verifyBusinessStore(db,options);results.push(result);console.log(JSON.stringify(result));
  }
  return{projectId:PRODUCTION_PROJECT,results,sourceWrites:0};
 }finally{await db.terminate();}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)console.log(JSON.stringify(await runProductionBusiness(process.argv.slice(2))));
