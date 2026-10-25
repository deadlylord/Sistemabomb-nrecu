import {ledgerDay} from './financialProjection.mjs';
import { BUSINESS_COLLECTIONS, businessRoot, emptyBusinessRoot, emptyBusinessDay, businessContribution, mergeBusinessDay } from './businessSummary.mjs';
const validId = v => typeof v === 'string' && v.length > 0 && v.length <= 128 && !v.includes('/');
const add = (object,key,value) => { object[key]=Math.round(((object[key]||0)+value)*1e8)/1e8;if(Math.abs(object[key])<1e-8)delete object[key]; };
const version = snapshot => snapshot.exists ? `${snapshot.updateTime.seconds}:${snapshot.updateTime.nanoseconds}` : null;
const equivalent = (a,b) => {
 if(typeof a==='number'&&typeof b==='number')return Math.abs(a-b)<0.0001;
 if(a===b)return true;
 if(a===0&&b&&typeof b==='object')return Object.values(b).every(v=>equivalent(v,0));
 if(b===0&&a&&typeof a==='object')return Object.values(a).every(v=>equivalent(v,0));
 if(a&&b&&typeof a==='object'&&typeof b==='object')return [...new Set([...Object.keys(a),...Object.keys(b)])].every(k=>equivalent(a[k]??0,b[k]??0));
 return false;
};
export function productionBusinessValue(kind,data){
 // Recurring expense templates are configuration, not dated expenses.
 if(kind==='expenses'&&data.date==='TEMPLATE')return{days:{},inventoryValue:0,inventoryUnits:0,invoiceDays:[],paymentMonths:[]};
 const localDate=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\d$/.test(v)&&Number.isFinite(new Date(v).getTime())?new Date(v).toISOString():v;
 const adjusted={...data,createdAt:localDate(data.createdAt),date:localDate(data.date),payments:(Array.isArray(data.payments)?data.payments:Object.values(data.payments||{})).map(p=>p?{...p,date:localDate(p.date)}:p)};
 const contribution=businessContribution(kind,adjusted);
 const payments=adjusted.payments;
 const candidates=kind==='sales'&&!data.layawayId?payments.filter(Boolean).map(p=>ledgerDay(p.date).slice(0,7)):[];
 if(kind==='sales'&&typeof adjusted.createdAt==='string'&&Number.isFinite(new Date(adjusted.createdAt).getTime()))candidates.push(ledgerDay(adjusted.createdAt).slice(0,7));
 const paymentMonths=[...new Set(candidates)].filter(month=>{const [year,m]=month.split('-').map(Number),start=new Date(month+'-01T00:00:00-05:00').toISOString(),end=new Date(Date.UTC(year,m,1,5)).toISOString();return !(typeof data.createdAt==='string'&&data.createdAt>=start&&data.createdAt<end);}).sort();
 return {...contribution,paymentMonths};
}
export async function projectBusinessBatch(db, sources) {
 if(!sources.length||sources.length>50||sources.some(s=>!BUSINESS_COLLECTIONS.includes(s.kind)||!validId(s.id))||new Set(sources.map(s=>s.kind+'_'+s.id)).size!==sources.length)throw Error('Invalid business batch');
 return db.runTransaction(async tx=>{
  const refs=sources.flatMap(s=>[db.doc(`${s.kind}/${s.id}`),db.doc(`businessSummaryState/${s.kind}_${s.id}`)]);
  const snapshots=await tx.getAll(...refs);
  const changes=sources.map((s,i)=>({ ...s,key:s.kind+'_'+s.id,source:snapshots[i*2],state:snapshots[i*2+1]})).filter(s=>!s.state.exists||s.state.data().sourceVersion!==version(s.source)||s.state.data().projectionVersion!==2);
  if(!changes.length)return {processed:0};
  const storeIds=[...new Set(changes.filter(s=>s.source.exists).map(s=>s.source.data().storeId))];
  if(storeIds.some(id=>!validId(id)))throw Error('Invalid business store');
  const stores=storeIds.length?await tx.getAll(...storeIds.map(id=>db.doc('stores/'+id))):[];
  const storeMap=new Map(storeIds.map((id,i)=>[id,stores[i]]));
  const values=[];
  for(const s of changes){
   s.before=s.state.exists?s.state.data().value:null;s.after=null;
   if(s.source.exists){const data=s.source.data(),store=storeMap.get(data.storeId);if(!store?.exists)throw Error('Missing business store');
    const companyId=store.data().companyId||'default_company';if(!validId(companyId)||data.companyId&&data.companyId!==companyId)throw Error('Business company mismatch');
    s.after={companyId,storeId:data.storeId,...productionBusinessValue(s.kind,data)};
   }
   for(const v of [s.before,s.after])if(v)values.push(v);
  }
  const paths=new Map();
  for(const v of values){const root=businessRoot(v.companyId,v.storeId);paths.set(root,emptyBusinessRoot(v.companyId,v.storeId));
   for(const date of Object.keys(v.days)){paths.set(root+'/days/'+date,{companyId:v.companyId,storeId:v.storeId,date,...emptyBusinessDay()});paths.set(root+'/months/'+date.slice(0,7),{companyId:v.companyId,storeId:v.storeId,month:date.slice(0,7),days:{}});}
  }
  const existing=paths.size?await tx.getAll(...[...paths.keys()].map(p=>db.doc(p))):[];
  let index=0;for(const [path,empty] of paths){const s=existing[index++];paths.set(path,s.exists?s.data():empty);}
  const writes=[];
  for(const s of changes){
   for(const [v,sign] of [[s.before,-1],[s.after,1]])if(v){const root=businessRoot(v.companyId,v.storeId),summary=paths.get(root);
    add(summary.sourceCounts,s.kind,sign);summary.inventoryValue=Math.round((summary.inventoryValue+v.inventoryValue*sign)*1e8)/1e8;summary.inventoryUnits=Math.round((summary.inventoryUnits+v.inventoryUnits*sign)*1e8)/1e8;
    for(const [date,day] of Object.entries(v.days)){mergeBusinessDay(paths.get(root+'/days/'+date),day,sign);const month=paths.get(root+'/months/'+date.slice(0,7));const entry=month.days[date]||={income:0,sales:0};for(const f of ['income','sales'])entry[f]=Math.round((entry[f]+day[f]*sign)*1e8)/1e8;}
   }
   const repeat=v=>businessRoot(v.companyId,v.storeId)+'/repeats/'+s.key;
   if(s.before&&(!s.after||repeat(s.before)!==repeat(s.after)||s.after.invoiceDays.length<2))writes.push(['delete',repeat(s.before)]);
   if(s.after&&s.after.invoiceDays.length>1)writes.push(['set',repeat(s.after),{companyId:s.after.companyId,storeId:s.after.storeId,days:s.after.invoiceDays,firstDay:s.after.invoiceDays[0],lastDay:s.after.invoiceDays.at(-1)}]);
   if(s.kind==='sales'){
    const paymentPath=(v,month)=>businessRoot(v.companyId,v.storeId)+'/paymentSalesByMonth/'+month+'__'+s.id;
    for(const m of s.before?.paymentMonths||[])if(!s.after||paymentPath(s.before,m)!==paymentPath(s.after,m)||!s.after.paymentMonths.includes(m))writes.push(['delete',paymentPath(s.before,m)]);
    for(const m of s.after?.paymentMonths||[])writes.push(['set',paymentPath(s.after,m),{companyId:s.after.companyId,storeId:s.after.storeId,month:m,saleId:s.id}]);
   }
   writes.push(['set','businessSummaryState/'+s.key,{sourceVersion:version(s.source),projectionVersion:2,value:s.after}],['delete','businessSummaryErrors/'+s.key]);
  }
  for(const [path,value] of paths){if(Buffer.byteLength(JSON.stringify(value))>700000)throw Error('Business source exceeds summary size');writes.push(['set',path,{...value,revision:(value.revision||0)+1,updatedAt:new Date().toISOString()}]);}
  if(writes.length>450)throw Error('Business source exceeds batch write limit');
  for(const [kind,path,data] of writes)kind==='set'?tx.set(db.doc(path),data):tx.delete(db.doc(path));
  return {processed:changes.length,writes:writes.length};
 });
}
export async function retryBusinessNetwork(run){
 for(let attempt=0;;attempt++)try{return await run();}catch(error){if(attempt>=4||!([4,10,14,'ECONNRESET','ETIMEDOUT','UNAVAILABLE'].includes(error.code)||/proxy tunnel timed out|fetch failed|socket hang up|network/i.test(error.message)))throw error;await new Promise(resolve=>setTimeout(resolve,250*2**attempt));}
}
async function buildBatch(db,values){
 try{return await retryBusinessNetwork(()=>projectBusinessBatch(db,values));}catch(error){if(values.length<2||error.message!=='Business source exceeds batch write limit')throw error;const split=Math.ceil(values.length/2);await buildBatch(db,values.slice(0,split));await buildBatch(db,values.slice(split));}
}
export async function buildBusinessStore(db,{storeId,documentId,onProgress=()=>{}}){
 if(!validId(storeId))throw Error('Invalid business store');
 const store=await retryBusinessNetwork(()=>db.doc('stores/'+storeId).get());if(!store.exists)throw Error('Missing business store');
 const companyId=store.data().companyId||'default_company',root=db.doc(businessRoot(companyId,storeId));
 await retryBusinessNetwork(()=>db.runTransaction(async tx=>{const current=await tx.get(root);tx.set(root,{...(current.exists?current.data():emptyBusinessRoot(companyId,storeId)),ready:false});}));
 let count=0;
 for(const kind of BUSINESS_COLLECTIONS){let cursor;
  while(true){let q=db.collection(kind).where('storeId','==',storeId).orderBy(documentId).limit(50);if(cursor)q=q.startAfter(cursor);
   const page=await retryBusinessNetwork(()=>q.get());if(page.empty)break;
   await buildBatch(db,page.docs.map(d=>({kind,id:d.id})));count+=page.size;cursor=page.docs.at(-1).id;onProgress({storeId,kind,processed:count});
  }
 }
 return {storeId,sources:count};
}
export async function verifyBusinessStore(db,{companyId,storeId,activate=false,assertDeploymentReady=async()=>false}){
 if(!validId(companyId)||!validId(storeId))throw Error('Invalid business scope');
 const result=await db.runTransaction(async tx=>{
  const store=await tx.get(db.doc('stores/'+storeId));if(!store.exists||(store.data().companyId||'default_company')!==companyId)throw Error('Business store/company mismatch');
  const root=businessRoot(companyId,storeId),expected=emptyBusinessRoot(companyId,storeId),days=new Map(),months=new Map(),repeats=new Map(),paymentLinks=new Map();let count=0;
  for(const kind of BUSINESS_COLLECTIONS){
   const sourceRows=await tx.get(db.collection(kind).where('storeId','==',storeId));
   for(let offset=0;offset<sourceRows.size;offset+=200){const rows=sourceRows.docs.slice(offset,offset+200);const states=await tx.getAll(...rows.map(s=>db.doc('businessSummaryState/'+kind+'_'+s.id)));
    for(let i=0;i<rows.length;i++){const s=rows[i],data=s.data();if(data.companyId&&data.companyId!==companyId)throw Error('Business company mismatch');const value={companyId,storeId,...productionBusinessValue(kind,data)};
     if(!states[i].exists||states[i].data().sourceVersion!==version(s)||states[i].data().projectionVersion!==2||!equivalent(states[i].data().value,value))throw Error('Business state/version mismatch');
     count++;add(expected.sourceCounts,kind,1);expected.inventoryValue+=value.inventoryValue;expected.inventoryUnits+=value.inventoryUnits;
     for(const [date,v] of Object.entries(value.days)){if(!days.has(date))days.set(date,emptyBusinessDay());mergeBusinessDay(days.get(date),v);if(!months.has(date.slice(0,7)))months.set(date.slice(0,7),{});const m=months.get(date.slice(0,7));const e=m[date]||={income:0,sales:0};for(const f of ['income','sales'])e[f]+=v[f];}
     for(const month of value.paymentMonths)paymentLinks.set(month+'__'+s.id,{month,saleId:s.id});
     if(value.invoiceDays.length>1)repeats.set(kind+'_'+s.id,value.invoiceDays);
    }
   }
  }
  const metadata=await tx.get(db.doc(root));if(!metadata.exists)throw Error('Business root missing');const actual=metadata.data();
  for(const f of ['inventoryValue','inventoryUnits','sourceCounts'])if(!equivalent(actual[f],expected[f]))throw Error('Business root mismatch: '+f);
  if(actual.companyId!==companyId||actual.storeId!==storeId||actual.schemaVersion!==1)throw Error('Business root scope mismatch');
  for(const [name,expectedRows] of [['days',days],['months',months],['repeats',repeats],['paymentSalesByMonth',paymentLinks]]){
   const entries=await tx.get(db.collection(root+'/'+name)),seen=new Set();
   for(const d of entries.docs){const data=d.data();if(data.companyId!==companyId||data.storeId!==storeId)throw Error('Business detail scope mismatch');seen.add(d.id);
    if(name==='days'){const e=expectedRows.get(d.id)||emptyBusinessDay();if(!Object.keys(e).every(k=>equivalent(data[k],e[k])))throw Error('Business day mismatch');}
    if(name==='months'&&!equivalent(data.days,expectedRows.get(d.id)||{}))throw Error('Business month mismatch');
    if(name==='paymentSalesByMonth'){const e=expectedRows.get(d.id);if(!e||data.month!==e.month||data.saleId!==e.saleId)throw Error('Business payment link mismatch');}
    if(name==='repeats'){const e=expectedRows.get(d.id);if(!e||!equivalent(data.days,e)||data.firstDay!==e[0]||data.lastDay!==e.at(-1))throw Error('Business repeat mismatch');}
   }
   if([...expectedRows.keys()].some(id=>!seen.has(id))||['repeats','paymentSalesByMonth'].includes(name)&&seen.size!==expectedRows.size)throw Error('Business detail missing');
  }
  return {ref:db.doc(root),updateTime:metadata.updateTime,metadata:actual,sources:count,days:days.size,months:months.size};
 },{readOnly:true});
 if(activate){if(!await assertDeploymentReady())throw Error('Business deployment not verified');await result.ref.update({ready:true,paymentIndexVersion:1,verifiedAt:new Date().toISOString()},{lastUpdateTime:result.updateTime});}
 return {companyId,storeId,sources:result.sources,days:result.days,months:result.months,activated:activate};
}
