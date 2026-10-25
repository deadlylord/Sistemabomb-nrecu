import {readFile,writeFile} from 'node:fs/promises';import {fileURLToPath,pathToFileURL} from 'node:url';import {resolve,join} from 'node:path';import {createCipheriv,createDecipheriv,randomBytes,createHash} from 'node:crypto';import {parseArgs} from 'node:util';
import {productionAccess,PRODUCTION_PROJECT} from './productionAccess.mjs';import {checkProductionIdentity} from './productionIdentity.mjs';
import {openMigrationBackup} from '../src/migrationBackup.mjs';import {planProductionIdentity} from '../src/productionIdentityPlan.mjs';
const directory=fileURLToPath(new URL('../../security/.production-rollout.local/',import.meta.url));
const seal=(value,key)=>{const nonce=randomBytes(12),c=createCipheriv('aes-256-gcm',key,nonce);return{format:'vestika-identity-journal-v1',nonce:nonce.toString('base64'),body:Buffer.concat([c.update(JSON.stringify(value),'utf8'),c.final()]).toString('base64'),tag:c.getAuthTag().toString('base64')};};
const open=(e,key)=>{if(e.format!=='vestika-identity-journal-v1')throw Error('Invalid identity journal');const d=createDecipheriv('aes-256-gcm',key,Buffer.from(e.nonce,'base64'));d.setAuthTag(Buffer.from(e.tag,'base64'));return JSON.parse(Buffer.concat([d.update(Buffer.from(e.body,'base64')),d.final()]).toString('utf8'));};
const digest=v=>{const canonical=o=>!o||typeof o!=='object'?JSON.stringify(o):Array.isArray(o)?'['+o.map(canonical).join(',')+']':'{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+canonical(o[k])).join(',')+'}';return createHash('sha256').update(canonical(v)).digest('hex');};
export async function productionIdentityMigration(mode){
 if(!['plan','apply','verify','rollback'].includes(mode))throw Error('Use plan|apply|verify|rollback');
 const {db,request}=await productionAccess();let key;
 try{
  const manifest=JSON.parse(await readFile(join(directory,'identity-backup-manifest.json'),'utf8'));if(!manifest.verified||manifest.projectId!==PRODUCTION_PROJECT)throw Error('Verified production backup required');
  const secret=await request('https://secretmanager.googleapis.com/v1/'+manifest.secretVersion+':access');key=Buffer.from(secret.payload.data,'base64');
  const snapshot=openMigrationBackup(JSON.parse(await readFile(manifest.path,'utf8')),key,PRODUCTION_PROJECT);
  const base=`https://firestore.googleapis.com/v1/projects/${PRODUCTION_PROJECT}/databases/(default)/documents`;
  const journalPath=join(directory,'identity-journal.encrypted.json');
  if(mode==='rollback'){
   const journal=open(JSON.parse(await readFile(journalPath,'utf8')),key);if(!journal.committed)throw Error('Committed migration journal required');
   const before=new Map(snapshot.items.map(i=>[i.path,i.document])),writes=[];
   for(const change of journal.after){const s=await request(base+'/'+change.path);if(s.updateTime!==change.updateTime||digest(s.fields)!==digest(change.fields))throw Error('Identity changed after migration; rollback refuses to overwrite it');
    const old=before.get(change.path);writes.push(old?{update:{name:s.name,fields:old.fields},currentDocument:{updateTime:s.updateTime}}:{delete:s.name,currentDocument:{updateTime:s.updateTime}});
   }
   await request(base+':commit',{method:'POST',body:JSON.stringify({writes})});return{projectId:PRODUCTION_PROJECT,restored:writes.length,sourceWrites:0,rulesRollbackRequired:true};
  }
  if(mode==='verify'){
   const journal=open(JSON.parse(await readFile(journalPath,'utf8')),key);if(!journal.committed)throw Error('Migration journal not committed');
   for(const change of journal.after){const value=await request(base+'/'+change.path);if(value.updateTime!==change.updateTime||digest(value.fields)!==digest(change.fields))throw Error('Identity migration verification mismatch');}
   const sellers=await db.collection('sellers').get();if(sellers.size!==journal.users||sellers.docs.some(d=>'password'in d.data()))throw Error('Identity sanitization incomplete');return{projectId:PRODUCTION_PROJECT,users:sellers.size,verified:true,sourceWrites:0};
  }
  const plan=await planProductionIdentity(snapshot);
  if(mode==='plan')return{projectId:PRODUCTION_PROJECT,users:plan.users,aliases:plan.aliases,writes:plan.writes.length,sourceWrites:0};
  if(!manifest.libraryFileId)throw Error('Persist the encrypted backup before migrating');
  const deployment=await checkProductionIdentity();if(!deployment.serverReady||!deployment.rulesReady)throw Error('Deploy and verify identity services and private credential rules first');
  for(const collection of snapshot.manifest.collections){const current=await db.collection(collection).get();const expected=snapshot.items.filter(i=>i.path.startsWith(collection+'/')).map(i=>i.path.slice(collection.length+1)).sort();if(JSON.stringify(current.docs.map(d=>d.id).sort())!==JSON.stringify(expected))throw Error('Identity collection membership changed since backup');}
  const changes=new Set(plan.writes.map(w=>w.path));
  const verify=snapshot.items.filter(i=>!changes.has(i.path)).map(i=>({verify:i.document.name,currentDocument:{updateTime:i.document.updateTime}}));
  await writeFile(journalPath,JSON.stringify(seal({...plan,committed:false},key)),{mode:0o600});
  const result=await request(base+':commit',{method:'POST',body:JSON.stringify({writes:[...plan.writes.map(({path,...w})=>w),...verify]})});
  const after=plan.writes.map((w,i)=>({path:w.path,fields:w.update.fields,updateTime:result.writeResults[i].updateTime}));
  await writeFile(journalPath,JSON.stringify(seal({projectId:PRODUCTION_PROJECT,users:plan.users,aliases:plan.aliases,backupHash:plan.backupHash,committed:true,after},key)),{mode:0o600});
  return{projectId:PRODUCTION_PROJECT,users:plan.users,aliases:plan.aliases,writes:after.length,sourceWrites:0,journalPath};
 }finally{key?.fill(0);await db.terminate();}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const {values}=parseArgs({options:{mode:{type:'string'}},strict:true});console.log(JSON.stringify(await productionIdentityMigration(values.mode)));}
