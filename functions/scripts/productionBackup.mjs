import {randomBytes} from 'node:crypto';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {fileURLToPath,pathToFileURL} from 'node:url';import {resolve,join} from 'node:path';
import {productionAccess,PRODUCTION_PROJECT} from './productionAccess.mjs';
import {captureMigrationSources,saveEncryptedMigrationBackup} from '../src/migrationBackupCapture.mjs';
import {createMigrationBackupReader} from '../src/migrationBackupReader.mjs';
import {openMigrationBackup} from '../src/migrationBackup.mjs';
export async function captureProductionIdentityBackup(){
 const {db,credential,request}=await productionAccess();
 try{
  const release=await request(`https://firebaserules.googleapis.com/v1/projects/${PRODUCTION_PROJECT}/releases/cloud.firestore`);
  const rules=await request('https://firebaserules.googleapis.com/v1/'+release.rulesetName);
  const snapshot=await captureMigrationSources({projectId:PRODUCTION_PROJECT,readTime:new Date(Date.now()-5000).toISOString(),collections:['sellers','roles','stores','companies','categories','authCredentials','authLoginIndex','platformDevelopers'],deployment:{clientCommit:'d1361d47a5337308f2c0ee10b88077c032cc7561',ruleset:release.rulesetName},readPage:createMigrationBackupReader({projectId:PRODUCTION_PROJECT,getAccessToken:()=>credential.getAccessToken()})});
  const secretId='vestika-identity-rollout-'+Date.now(),secret=await request(`https://secretmanager.googleapis.com/v1/projects/${PRODUCTION_PROJECT}/secrets?secretId=${secretId}`,{method:'POST',body:JSON.stringify({replication:{automatic:{}}})});
  const key=randomBytes(32);
  const version=await request('https://secretmanager.googleapis.com/v1/'+secret.name+':addVersion',{method:'POST',body:JSON.stringify({payload:{data:key.toString('base64')}})});
  const readBack=await request('https://secretmanager.googleapis.com/v1/'+version.name+':access');
  const savedKey=Buffer.from(readBack.payload.data,'base64');
  const directory=fileURLToPath(new URL('../../security/.production-rollout.local/',import.meta.url));
  await mkdir(directory,{recursive:true,mode:0o700});
  const saved=await saveEncryptedMigrationBackup({snapshot,key:savedKey,privateDirectory:directory});
  const reopened=openMigrationBackup(JSON.parse(await readFile(saved.path,'utf8')),savedKey,PRODUCTION_PROJECT);
  if(reopened.manifest.documentsHash!==snapshot.manifest.documentsHash)throw Error('Production backup verification failed');
  const manifest={...saved,secretVersion:version.name,verified:true,counts:snapshot.manifest.counts,ruleset:release.rulesetName};
  await writeFile(join(directory,'identity-backup-manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600});
  await writeFile(join(directory,'identity-rules-before.json'),JSON.stringify({ruleset:release.rulesetName,source:rules.source.files[0].content}),{mode:0o600});
  key.fill(0);savedKey.fill(0);
  return manifest;
 }finally{await db.terminate();}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)console.log(JSON.stringify(await captureProductionIdentityBackup()));
