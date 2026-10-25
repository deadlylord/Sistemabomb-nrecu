import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';import {resolve,join} from 'node:path';import {createHash} from 'node:crypto';
import {productionAccess,PRODUCTION_PROJECT} from './productionAccess.mjs';
import {prepareCompatibleIdentityRules} from '../src/compatibleIdentityRules.mjs';
import {buildDashboardActivity} from '../src/dashboardActivity.mjs';
import {verifyActivity as verifyDashboardActivity} from './verifyDashboardActivity.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
export async function packActivity(){const files=['dashboardActivity.mjs','productionDashboardActivity.mjs'],contents=await Promise.all(files.map(f=>readFile(new URL('../src/'+f,import.meta.url),'utf8'))),hash=createHash('sha256').update(contents.join('\n')).digest('hex').slice(0,40),source='functions/.dashboard-activity.local';
 await mkdir(join(root,source,'src'),{recursive:true});for(let i=0;i<files.length;i++)await writeFile(join(root,source,'src',files[i]),contents[i].replaceAll('__ACTIVITY_BUILD__',hash));
 await writeFile(join(root,source,'src/index.mjs'),"import {initializeApp} from 'firebase-admin/app';initializeApp();export * from './productionDashboardActivity.mjs';\n");
 for(const f of ['package.json','package-lock.json'])await writeFile(join(root,source,f),await readFile(new URL('../'+f,import.meta.url)));
 const config='firebase.dashboard-activity.local';await writeFile(join(root,config),JSON.stringify({functions:[{source,codebase:'vestika-dashboard-activity-production',ignore:['node_modules','*.log','.env*']}]}));return{hash,config,source};
}
export async function activityOperator(mode){if(!['pack','check','build','verify','activate'].includes(mode))throw Error('Invalid activity mode');const bundle=await packActivity();if(mode==='pack')return bundle;
 const {db,request}=await productionAccess();try{
  const database=await request(`https://firestore.googleapis.com/v1/projects/${PRODUCTION_PROJECT}/databases/(default)`);if(database.databaseEdition!=='STANDARD'||database.locationId!=='nam5')throw Error('Wrong production database');
  const release=await request(`https://firebaserules.googleapis.com/v1/projects/${PRODUCTION_PROJECT}/releases/cloud.firestore`),ruleset=await request('https://firebaserules.googleapis.com/v1/'+release.rulesetName);if(ruleset.source.files.length!==1)throw Error('Rules review required');
  const rules=prepareCompatibleIdentityRules(ruleset.source.files[0].content);if(rules.hash!==rules.previousHash)throw Error('Private credential and summary rules required');
  const ready=async()=>{const current=await request(`https://cloudfunctions.googleapis.com/v2/projects/${PRODUCTION_PROJECT}/locations/us-central1/functions?pageSize=1000`);return['productionDashboardLayawaysChanged','productionDashboardIncidentsChanged'].every(name=>current.functions?.some(f=>f.name.endsWith('/'+name)&&f.state==='ACTIVE'&&f.labels?.vestika_activity_build===bundle.hash&&f.eventTrigger?.retryPolicy==='RETRY_POLICY_RETRY'));};
  const serverReady=await ready();if(mode==='check')return{...bundle,projectId:PRODUCTION_PROJECT,serverReady,rulesUnchanged:true};if(!serverReady)throw Error('Deploy exact activity processors first');
  const stores=await db.collection('stores').get(),results=[];for(const store of stores.docs){const scope={companyId:store.data().companyId||'default_company',storeId:store.id,onProgress:v=>console.log(JSON.stringify(v)),activate:mode==='activate',assertReady:ready};
   const value=mode==='build'?await buildDashboardActivity(db,scope):await verifyDashboardActivity(db,scope);console.log(JSON.stringify(value));results.push(value);
  }return{projectId:PRODUCTION_PROJECT,results,sourceWrites:0};
 }finally{await db.terminate();}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)console.log(JSON.stringify(await activityOperator(process.argv[2])));
