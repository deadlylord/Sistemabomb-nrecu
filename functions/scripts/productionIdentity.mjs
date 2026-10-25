import {readFile,writeFile,mkdir} from 'node:fs/promises';import {fileURLToPath,pathToFileURL} from 'node:url';import {join,resolve} from 'node:path';import {createHash} from 'node:crypto';import {parseArgs} from 'node:util';
import {productionAccess,PRODUCTION_PROJECT} from './productionAccess.mjs';import {prepareCompatibleIdentityRules} from '../src/compatibleIdentityRules.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
export const productionIdentityNames=['productionPosLogin','productionPosUsers','productionPosRoles','productionPosPlatform'];
export async function packProductionIdentity(){
 const files=['identity.mjs','stagingUsers.mjs','stagingRoles.mjs','stagingLoginDiagnostics.mjs','businessSummary.mjs','financialProjection.mjs','productionPlatform.mjs','productionIdentity.mjs'];
 const contents=await Promise.all(files.map(f=>readFile(new URL('../src/'+f,import.meta.url),'utf8'))),buildHash=createHash('sha256').update(contents.join('\n')).digest('hex').slice(0,40);
 const source='functions/.production-identity.local';await mkdir(join(root,source,'src'),{recursive:true});
 for(let i=0;i<files.length;i++)await writeFile(join(root,source,'src',files[i]),contents[i].replaceAll('__VESTIKA_IDENTITY_BUILD__',buildHash));
 await writeFile(join(root,source,'src/index.mjs'),"import {initializeApp} from 'firebase-admin/app';\ninitializeApp();\nexport * from './productionIdentity.mjs';\n");
 for(const f of ['package.json','package-lock.json'])await writeFile(join(root,source,f),await readFile(new URL('../'+f,import.meta.url)));
 const config='firebase.production-identity.local';await writeFile(join(root,config),JSON.stringify({functions:[{source,codebase:'vestika-pos-identity-production',ignore:['node_modules','*.log','.env*']}],firestore:{rules:'security/production-identity.rules.local'}},null,2));
 return{source,config,buildHash,names:productionIdentityNames};
}
export async function checkProductionIdentity(){
 const bundle=await packProductionIdentity(),{db,request}=await productionAccess();try{
 const metadata=await request(`https://firestore.googleapis.com/v1/projects/${PRODUCTION_PROJECT}/databases/(default)`);if(metadata.databaseEdition!=='STANDARD'||metadata.locationId!=='nam5')throw Error('Production database mismatch');
 const release=await request(`https://firebaserules.googleapis.com/v1/projects/${PRODUCTION_PROJECT}/releases/cloud.firestore`),ruleset=await request('https://firebaserules.googleapis.com/v1/'+release.rulesetName);
 if(ruleset.source.files.length!==1)throw Error('Multiple rules files require review');const current=ruleset.source.files[0].content,patch=prepareCompatibleIdentityRules(current);
 await writeFile(join(root,'security/production-identity.rules.local'),patch.source);const directory=join(root,'security/.production-rollout.local');await mkdir(directory,{recursive:true,mode:0o700});
 try{await writeFile(join(directory,'identity-rules-rollback.json'),JSON.stringify({ruleset:release.rulesetName,source:current}),{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}
 const functions=await request(`https://cloudfunctions.googleapis.com/v2/projects/${PRODUCTION_PROJECT}/locations/us-central1/functions?pageSize=1000`);
 const serverReady=productionIdentityNames.every(name=>functions.functions?.some(f=>f.name.endsWith('/'+name)&&f.state==='ACTIVE'&&f.labels?.vestika_identity_build===bundle.buildHash));
 return{projectId:PRODUCTION_PROJECT,...bundle,serverReady,rulesReady:patch.hash===patch.previousHash,rulesHash:patch.hash,previousRuleset:release.rulesetName};
 }finally{await db.terminate();}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const {values}=parseArgs({options:{mode:{type:'string'}},strict:true});if(!['pack','check'].includes(values.mode))throw Error('Use --mode pack|check');console.log(JSON.stringify(values.mode==='pack'?await packProductionIdentity():await checkProductionIdentity()));}
