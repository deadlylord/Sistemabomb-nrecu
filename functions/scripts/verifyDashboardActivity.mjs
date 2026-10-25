import {activityKinds,activityRoot,activityProjection,activityBucket,activityMonth,activityVersion} from '../src/dashboardActivity.mjs';
const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
// Operator audit uses bounded batch reads within a single consistent read transaction.
export async function verifyActivity(db,{companyId,storeId,activate=false,assertReady=async()=>false}){
 const result=await db.runTransaction(async tx=>{
  const ref=db.doc(activityRoot(companyId,storeId)),meta=await tx.get(ref),store=await tx.get(db.doc('stores/'+storeId));
  if(!meta.exists||!meta.data().ready||!store.exists||(store.data().companyId||'default_company')!==companyId)throw Error('Activity scope/root not verified');
  const expected=new Map(),months={};let count=0;
  for(const kind of activityKinds){const rows=await tx.get(db.collection(kind).where('storeId','==',storeId));
   for(let offset=0;offset<rows.size;offset+=200){const batch=rows.docs.slice(offset,offset+200),states=await tx.getAll(...batch.map(s=>db.doc('businessSummaryState/dashboardActivity_'+kind+'_'+s.id)));
    for(let i=0;i<batch.length;i++){const s=batch[i],value={kind,id:s.id,companyId,storeId,...activityProjection(kind,s.data())},state=states[i];
     if(s.data().companyId&&s.data().companyId!==companyId||!state.exists||state.data().sourceVersion!==activityVersion(s)||canonical(state.data().value)!==canonical(value))throw Error('Activity state mismatch');
     if(kind==='layaways'){const month=activityMonth(s.data().createdAt);months[month]=(months[month]||0)+1;}
     for(const month of value.months){const id=activityBucket(kind,s.id,month);if(!expected.has(id))expected.set(id,{kind,month,rows:{}});expected.get(id).rows[s.id]={version:activityVersion(s),data:value.record};}count++;
    }
   }
  }
  if(canonical(meta.data().dashboardActivityMonths||{})!==canonical(months))throw Error('Activity available months mismatch');
  const groups=await tx.get(db.collection(ref.path+'/dashboardActivity'));if(groups.size!==expected.size)throw Error('Activity group count mismatch');
  for(const g of groups.docs){const data=g.data(),e=expected.get(g.id);if(!e||data.schemaVersion!==1||data.kind!==e.kind||data.month!==e.month||data.companyId!==companyId||data.storeId!==storeId||canonical(JSON.parse(data.payload))!==canonical(e.rows))throw Error('Activity payload mismatch');}
  return{ref,updateTime:meta.updateTime,sources:count,groups:groups.size};
 },{readOnly:true});
 if(activate){if(!await assertReady())throw Error('Exact activity deployment required');await result.ref.update({dashboardActivityVersion:1},{lastUpdateTime:result.updateTime});}
 return{companyId,storeId,sources:result.sources,groups:result.groups,activated:activate};
}
