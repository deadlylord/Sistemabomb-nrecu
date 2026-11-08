import {getApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {onCall, HttpsError} from 'firebase-functions/v2/https';
import {IdentityError} from './identity.mjs';
import {approveTransferRequest} from './transferApproval.mjs';
// Deployment/activation requires verifying Firestore location first. Keep the
// browser flag OFF until this staging-only endpoint is deployed and measured.
export const vestikaStagingApproveTransfer = onCall({region:'us-central1',enforceAppCheck:false,maxInstances:3,minInstances:0,timeoutSeconds:30},async request=>{
  if ((getApp().options.projectId || process.env.GCLOUD_PROJECT) !== 'vestika-staging') throw new HttpsError('failed-precondition','Aprobación de prueba disponible solo en staging.');
  try {return await approveTransferRequest(getFirestore(),request.auth,request.data);}
  catch(error){
    if(error instanceof IdentityError)throw new HttpsError(error.code,error.message);
    throw new HttpsError('internal','No se pudo confirmar la aprobación. Revisa el estado de la solicitud antes de reintentar.');
  }
});
