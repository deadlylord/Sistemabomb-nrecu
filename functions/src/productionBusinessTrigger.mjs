import {getApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {projectBusinessBatch} from './onlineBusinessSummary.mjs';
import {invalidateBusinessSummary} from './businessSummary.mjs';
const trigger=kind=>onDocumentWritten({document:`${kind}/{sourceId}`,region:'us-central1',maxInstances:5,concurrency:4,retry:true,labels:{vestika_business_build:'__VESTIKA_BUSINESS_BUILD__'}},async event=>{
 if((getApp().options.projectId||process.env.GCLOUD_PROJECT)!=='factura2-6e811')throw Error('Production business target rejected');
 try{await projectBusinessBatch(getFirestore(),[{kind,id:event.params.sourceId}]);}
 catch(error){if(/^(Invalid business|Missing business|Business company|Invalid financial date|Business source exceeds)/.test(error.message)){await invalidateBusinessSummary(getFirestore(),kind,event.params.sourceId);return;}throw error;}
});
export const productionBusinessSalesChanged=trigger('sales');
export const productionBusinessLayawaysChanged=trigger('layaways');
export const productionBusinessIncidentsChanged=trigger('incidents');
export const productionBusinessExpensesChanged=trigger('expenses');
export const productionBusinessInventoryChanged=trigger('inventory');
