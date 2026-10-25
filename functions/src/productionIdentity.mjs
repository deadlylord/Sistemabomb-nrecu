import {getApp} from 'firebase-admin/app';import {getAuth} from 'firebase-admin/auth';import {getFirestore,Timestamp} from 'firebase-admin/firestore';
import {onCall,HttpsError} from 'firebase-functions/v2/https';import {createHash} from 'node:crypto';
import {IdentityError,nextAttempt} from './identity.mjs';import {authenticateStagingLogin as authenticateMeasuredLogin} from './stagingLoginDiagnostics.mjs';
import {manageStagingUser} from './stagingUsers.mjs';import {manageStagingRole} from './stagingRoles.mjs';import {manageProductionPlatform} from './productionPlatform.mjs';
const options={region:'us-central1',enforceAppCheck:false,maxInstances:5,concurrency:10,memory:'256MiB',timeoutSeconds:30,labels:{vestika_identity_build:'__VESTIKA_IDENTITY_BUILD__'}};
const protect=callback=>async request=>{
 if((getApp().options.projectId||process.env.GCLOUD_PROJECT)!=='factura2-6e811')throw new HttpsError('failed-precondition','Entorno de identidad incorrecto.');
 try{return await callback(request);}catch(error){if(error instanceof IdentityError)throw new HttpsError(error.code,error.message);console.error('production-identity-failed',{code:String(error?.code||'internal')});throw new HttpsError('internal','No se pudo verificar o guardar el acceso. Intenta nuevamente.');}
};
export const productionPosLogin=onCall(options,protect(async request=>{
 const db=getFirestore();return authenticateMeasuredLogin(request.data,{enabled:true,includeContext:true,
  read:async(collection,id)=>{const s=await db.doc(collection+'/'+id).get();return s.exists?s.data():null;},
  createCustomToken:(uid,claims)=>getAuth().createCustomToken(uid,claims),
  consumeAttempt:async identifier=>{
   const ip=request.rawRequest.ip||request.rawRequest.socket?.remoteAddress||'unknown';
   const buckets=[{key:'production:account:'+identifier,limit:15},{key:'production:ip:'+ip,limit:60}];
   await db.runTransaction(async tx=>{const refs=buckets.map(b=>db.doc('authLoginAttempts/'+createHash('sha256').update(b.key).digest('hex')));const states=await tx.getAll(...refs),now=Date.now();const next=states.map((s,i)=>nextAttempt(s.exists?s.data():null,now,buckets[i].limit));refs.forEach((ref,i)=>tx.set(ref,{...next[i],expiresAt:Timestamp.fromMillis(next[i].windowStart+600000)}));});
  }
 },request.data?.diagnostics===true);
}));
const management={allowOwnerUpdate:true,excludePlatformUsers:true,preserveProfile:true};
export const productionPosUsers=onCall(options,protect(request=>manageStagingUser(getFirestore(),request.auth,request.data,management)));
export const productionPosRoles=onCall(options,protect(request=>manageStagingRole(getFirestore(),request.auth,request.data,management)));
export const productionPosPlatform=onCall(options,protect(request=>manageProductionPlatform(getFirestore(),request.auth,request.data)));
