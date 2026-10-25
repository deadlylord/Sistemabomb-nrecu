import {readFile,writeFile} from 'node:fs/promises';import {fileURLToPath,pathToFileURL} from 'node:url';import {resolve} from 'node:path';
import {productionAccess,PRODUCTION_PROJECT} from './productionAccess.mjs';
export async function configureProductionSigner(){const {db,request}=await productionAccess();try{
 const f=await request(`https://cloudfunctions.googleapis.com/v2/projects/${PRODUCTION_PROJECT}/locations/us-central1/functions/productionPosLogin`);
 if(f.state!=='ACTIVE'||!f.labels?.vestika_identity_build)throw Error('Production identity service must be active');
 const email=f.serviceConfig.serviceAccountEmail;if(email!=='1038601908493-compute@developer.gserviceaccount.com')throw Error('Unexpected production runtime identity');
 const api=await request('https://serviceusage.googleapis.com/v1/projects/1038601908493/services/iamcredentials.googleapis.com');
 if(api.state!=='ENABLED')throw Error('IAM Credentials API must already be enabled; API changes are outside this grant');
 const resource=`https://iam.googleapis.com/v1/projects/${PRODUCTION_PROJECT}/serviceAccounts/${encodeURIComponent(email)}`;
 const policy=await request(resource+':getIamPolicy',{method:'POST',body:'{}'}),member='serviceAccount:'+email;
 let changed=false;
 if(!policy.bindings?.some(b=>!b.condition&&b.role==='roles/iam.serviceAccountTokenCreator'&&b.members?.includes(member))){
  const path=fileURLToPath(new URL('../../security/.production-rollout.local/identity-signer-before.json',import.meta.url));
  try{await writeFile(path,JSON.stringify({email,policy}),{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}
  const next=structuredClone(policy);next.bindings||=[];let binding=next.bindings.find(b=>!b.condition&&b.role==='roles/iam.serviceAccountTokenCreator');if(!binding){binding={role:'roles/iam.serviceAccountTokenCreator',members:[]};next.bindings.push(binding);}binding.members.push(member);
  await request(resource+':setIamPolicy',{method:'POST',body:JSON.stringify({policy:next})});changed=true;
 }
 return{projectId:PRODUCTION_PROJECT,signerReady:true,selfSigningOnly:true,policyChanged:changed};
}finally{await db.terminate()}}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)console.log(JSON.stringify(await configureProductionSigner()));
