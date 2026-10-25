// Server-owned monthly read model. Never used as an authoritative edit document.
export const activityKinds=['layaways','incidents'];
const financial=new Set(['Recaudo','Ajuste de Caja','Ingreso Adicional','Cambio de Producto']);
const pending=new Set(['Dañado Reportado','Cambio Solicitado','Traslado Solicitado','Garantía Activa']);
export const activityRoot=(companyId,storeId)=>`businessSummaryCompanies/${companyId}/stores/${storeId}`;
export const activityVersion=s=>s.exists?`${s.updateTime.seconds}:${String(s.updateTime.nanoseconds).padStart(9,'0')}`:null;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const fields={layaways:['createdAt','seller','customerName','customerPhone','totalAmount','status','invoiceNumber','storeId','companyId','payments','items','discountAmount','discountType','discountValue','paymentMethod'],incidents:['createdAt','sellerName','storeId','companyId','type','status','description','adjustmentAmount','adjustmentType','paymentMethod','invoiceNumber','originalSaleInvoiceNumber','productName','customerName','customerPhone','productId']};
const list=v=>Array.isArray(v)?v:Object.values(v||{});
export function activityMonth(value){
 const input=typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?$/.test(value)?value+'-05:00':value;
 const d=new Date(input);if(!value||!Number.isFinite(d.getTime()))throw Error('Invalid dashboard activity date');
 const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit'}).formatToParts(d),get=t=>p.find(x=>x.type===t).value;
 return get('year')+'-'+get('month');
}
export function activityProjection(kind,data){
 if(!activityKinds.includes(kind))throw Error('Invalid dashboard activity kind');
 const months=new Set();
 if(kind==='layaways'){
  months.add(activityMonth(data.createdAt));for(const p of list(data.payments))if(p)months.add(activityMonth(p.date));
 }else if(financial.has(data.type))months.add(activityMonth(data.createdAt));
 if(kind==='layaways'?data.status==='pre-order':pending.has(data.status))months.add('pending');
 const record=Object.fromEntries(fields[kind].filter(k=>own(data,k)).map(k=>[k,data[k]]));
 // JSON representation is intentionally restricted to the fields the dashboard reads.
 return{months:[...months].sort(),record:JSON.parse(JSON.stringify(record))};
}
const valid=v=>typeof v==='string'&&v.length>0&&v.length<=128&&!v.includes('/');
export function activityBucket(kind,id,month){let h=2166136261;for(const c of id)h=Math.imul(h^c.charCodeAt(0),16777619);return`${month}__${kind}__${(h>>>0)%8}`;}
const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const paths=v=>v?v.months.map(month=>({month,path:activityRoot(v.companyId,v.storeId)+'/dashboardActivity/'+activityBucket(v.kind,v.id,month)})):[];
export const projectDashboardActivity=(db,kind,id)=>projectDashboardActivityBatch(db,[{kind,id}]);
export async function projectDashboardActivityBatch(db,sources){
 if(!sources.length||sources.length>25||sources.some(s=>!activityKinds.includes(s.kind)||!valid(s.id))||new Set(sources.map(s=>s.kind+'_'+s.id)).size!==sources.length)throw Error('Invalid dashboard activity source');
 return db.runTransaction(async tx=>{
  const snapshots=await tx.getAll(...sources.flatMap(s=>[db.doc(s.kind+'/'+s.id),db.doc('businessSummaryState/dashboardActivity_'+s.kind+'_'+s.id)]));
  const changes=sources.map((s,i)=>({...s,source:snapshots[i*2],state:snapshots[i*2+1]})).filter(s=>!s.state.exists||s.state.data().sourceVersion!==activityVersion(s.source)||s.state.data().schemaVersion!==1);
  if(!changes.length)return{changed:false};
  const ids=[...new Set(changes.filter(s=>s.source.exists).map(s=>s.source.data().storeId))];if(ids.some(id=>!valid(id)))throw Error('Invalid dashboard activity store');
  const stores=ids.length?await tx.getAll(...ids.map(id=>db.doc('stores/'+id))):[],storeMap=new Map(ids.map((id,i)=>[id,stores[i]]));
  for(const c of changes){c.before=c.state.exists?c.state.data().value:null;c.after=null;
   if(c.source.exists){const data=c.source.data(),store=storeMap.get(data.storeId);if(!store?.exists)throw Error('Missing dashboard activity store');const companyId=store.data().companyId||'default_company';
    if(!valid(companyId)||data.companyId&&data.companyId!==companyId)throw Error('Invalid dashboard activity company');
    c.after={kind:c.kind,id:c.id,companyId,storeId:data.storeId,...activityProjection(c.kind,data)};
   }
  }
  const values=changes.flatMap(c=>[c.before,c.after]).filter(Boolean),groups=new Map();
  for(const v of values)for(const p of paths(v))groups.set(p.path,{...p,scope:v});
  const groupDocs=groups.size?await tx.getAll(...[...groups.keys()].map(p=>db.doc(p))):[];
  const roots=[...new Set(values.map(v=>activityRoot(v.companyId,v.storeId)))],metadata=roots.length?await tx.getAll(...roots.map(p=>db.doc(p))):[];
  let index=0;for(const [path,group]of groups){const snap=groupDocs[index++];group.rows=snap.exists?JSON.parse(snap.data().payload):{};}
  for(const c of changes){for(const p of paths(c.before))delete groups.get(p.path).rows[c.id];for(const p of paths(c.after))groups.get(p.path).rows[c.id]={version:activityVersion(c.source),data:c.after.record};}
  const writes=[];for(const [path,g]of groups){const payload=JSON.stringify(g.rows);if(Buffer.byteLength(payload)>650000)throw Error('Dashboard activity bucket exceeds safe size');
   writes.push(Object.keys(g.rows).length?['set',path,{companyId:g.scope.companyId,storeId:g.scope.storeId,kind:g.scope.kind,month:g.month,schemaVersion:1,payload}]:['delete',path]);
  }
  if(writes.length+changes.length+roots.length>450)throw Error('Dashboard activity batch exceeds safe size');
  for(let i=0;i<roots.length;i++){if(!metadata[i].exists)throw Error('Missing verified business root');const months={...(metadata[i].data().dashboardActivityMonths||{})};for(const c of changes)for(const [v,sign]of [[c.before,-1],[c.after,1]])if(v&&v.kind==='layaways'&&activityRoot(v.companyId,v.storeId)===roots[i]){const m=activityMonth(v.record.createdAt);months[m]=(months[m]||0)+sign;if(months[m]===0)delete months[m];}tx.update(db.doc(roots[i]),{dashboardActivityRevision:(metadata[i].data().dashboardActivityRevision||0)+1,dashboardActivityMonths:months});}
  for(const [op,path,data]of writes)op==='set'?tx.set(db.doc(path),data):tx.delete(db.doc(path));
  for(const c of changes)tx.set(db.doc('businessSummaryState/dashboardActivity_'+c.kind+'_'+c.id),{schemaVersion:1,sourceVersion:activityVersion(c.source),value:c.after});
  return{changed:true,processed:changes.length};
 });
}
export async function buildDashboardActivity(db,{storeId,onProgress=()=>{}}){
 const store=await db.doc('stores/'+storeId).get();if(!store.exists)throw Error('Unknown store');const companyId=store.data().companyId||'default_company',root=db.doc(activityRoot(companyId,storeId));
 await root.update({dashboardActivityVersion:0});let count=0;
 for(const kind of activityKinds){const rows=await db.collection(kind).where('storeId','==',storeId).get();for(let offset=0;offset<rows.size;offset+=25){const batch=rows.docs.slice(offset,offset+25).map(row=>({kind,id:row.id}));await projectDashboardActivityBatch(db,batch);count+=batch.length;onProgress({storeId,processed:count});}}
 return{companyId,storeId,sources:count};
}
export async function verifyDashboardActivity(db,{companyId,storeId,activate=false,assertReady=async()=>false}){
 const result=await db.runTransaction(async tx=>{
  const root=db.doc(activityRoot(companyId,storeId)),meta=await tx.get(root),store=await tx.get(db.doc('stores/'+storeId));
  if(!meta.exists||!meta.data().ready||!store.exists||(store.data().companyId||'default_company')!==companyId)throw Error('Activity scope/root not verified');
  const expected=new Map(),months={};let count=0;
  for(const kind of activityKinds){const rows=await tx.get(db.collection(kind).where('storeId','==',storeId));
   for(const s of rows.docs){const value={kind,id:s.id,companyId,storeId,...activityProjection(kind,s.data())};if(kind==='layaways'){const m=activityMonth(s.data().createdAt);months[m]=(months[m]||0)+1;}const state=await tx.get(db.doc('businessSummaryState/dashboardActivity_'+kind+'_'+s.id));
    if(!state.exists||state.data().sourceVersion!==activityVersion(s)||canonical(state.data().value)!==canonical(value))throw Error('Activity state verification failed');
    for(const {path} of paths(value)){if(!expected.has(path))expected.set(path,{});expected.get(path)[s.id]={version:activityVersion(s),data:value.record};}count++;
   }
  }
  if(canonical(meta.data().dashboardActivityMonths||{})!==canonical(months))throw Error('Activity history months mismatch');
  const groups=await tx.get(db.collection(root.path+'/dashboardActivity'));if(groups.size!==expected.size)throw Error('Activity group count mismatch');
  for(const d of groups.docs)if(d.data().companyId!==companyId||d.data().storeId!==storeId||!expected.has(d.ref.path)||canonical(JSON.parse(d.data().payload))!==canonical(expected.get(d.ref.path)))throw Error('Activity payload mismatch');
  return{root,updateTime:meta.updateTime,sources:count,groups:groups.size};
 },{readOnly:true});
 if(activate){if(!await assertReady())throw Error('Exact activity deployment required');await result.root.update({dashboardActivityVersion:1},{lastUpdateTime:result.updateTime});}
 return{companyId,storeId,sources:result.sources,groups:result.groups,activated:activate};
}
