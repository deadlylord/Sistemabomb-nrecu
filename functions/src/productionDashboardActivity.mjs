import {getApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {projectDashboardActivity} from './dashboardActivity.mjs';
const trigger=kind=>onDocumentWritten({document:`${kind}/{sourceId}`,region:'us-central1',retry:true,maxInstances:5,concurrency:4,labels:{vestika_activity_build:'__ACTIVITY_BUILD__'}},async event=>{
 if((getApp().options.projectId||process.env.GCLOUD_PROJECT)!=='factura2-6e811')throw Error('Activity production target rejected');
 try{await projectDashboardActivity(getFirestore(),kind,event.params.sourceId);}catch(error){
  // A malformed source cannot leave a verified but stale read model active.
  if(/^(Invalid dashboard|Missing dashboard|Missing verified|Dashboard activity bucket)/.test(error.message)){
   const db=getFirestore(),source=await db.doc(kind+'/'+event.params.sourceId).get(),state=await db.doc('businessSummaryState/dashboardActivity_'+kind+'_'+event.params.sourceId).get();
   const old=state.exists?state.data().value:null;const scopes=[];if(old)scopes.push([old.companyId,old.storeId]);
   if(source.exists&&typeof source.data().storeId==='string'&&!source.data().storeId.includes('/')){const s=await db.doc('stores/'+source.data().storeId).get();if(s.exists)scopes.push([s.data().companyId||'default_company',s.id]);}
   for(const [company,store]of scopes){const ref=db.doc(`businessSummaryCompanies/${company}/stores/${store}`);if((await ref.get()).exists)await ref.update({dashboardActivityVersion:0});}
   return;
  }
  throw error;
 }
});
export const productionDashboardLayawaysChanged=trigger('layaways');
export const productionDashboardIncidentsChanged=trigger('incidents');
