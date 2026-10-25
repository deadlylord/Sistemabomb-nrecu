import {businessRoot} from './businessSummary.mjs';
const list=v=>Array.isArray(v)?v:Object.values(v||{});
export function browserChartDay(value){
 const input=typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?$/.test(value)?value+'-05:00':value;
 const date=new Date(input);if(!Number.isFinite(date.getTime()))return'';
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date),get=t=>parts.find(p=>p.type===t).value;
 return `${get('year')}-${get('month')}-${get('day')}`;
}
// Independently reproduce DashboardView's dated payment ledger and sales chart.
// This deliberately does not use businessContribution or projection state.
export function originalDashboardFigures({sales,layaways,incidents,inventory}){
 const months=new Map();
 const add=(date,field,amount)=>{const day=browserChartDay(date);if(!day)return;const month=day.slice(0,7);if(!months.has(month))months.set(month,{income:0,sales:0});months.get(month)[field]+=Number(amount)||0;};
 const payment=p=>{if(p&&p.method!=='Bono de Regalo')add(p.date,'income',p.amount);};
 for(const sale of sales)if(!sale.layawayId){list(sale.payments).forEach(payment);add(sale.createdAt,'sales',sale.totalAmount);}
 for(const l of layaways){list(l.payments).forEach(payment);if(['active','completed'].includes(l.status))add(l.createdAt,'sales',l.totalAmount);}
 for(const i of incidents){if(i.status==='Pendiente de Aprobación')continue;
  let method=i.paymentMethod;const amount=Number(i.adjustmentAmount)||0;
  if(i.type==='Cambio de Producto'){if(amount>0&&method&&method!=='Bono de Regalo')add(i.createdAt,'income',amount);continue;}
  if(i.type==='Ajuste de Caja'&&String(i.description||'').includes('Excedente pagado'))continue;
  if(i.type==='Recaudo')method='Recaudo Sistecredito';
  if((i.type==='Recaudo'||i.type==='Ingreso Adicional'||i.type==='Ajuste de Caja'&&i.adjustmentType==='income')&&method&&method!=='Bono de Regalo'&&amount>0)add(i.createdAt,'income',amount);
 }
 return{inventoryValue:inventory.reduce((sum,p)=>sum+(Number(p.cost)||0)*(Number(p.stock)||0),0),months};
}
export async function verifyOriginalDashboard(db,{companyId,storeId}){
 return db.runTransaction(async tx=>{
  const source={};for(const name of ['sales','layaways','incidents','inventory'])source[name]=(await tx.get(db.collection(name).where('storeId','==',storeId))).docs.map(d=>d.data());
  const expected=originalDashboardFigures(source),root=businessRoot(companyId,storeId),metadata=await tx.get(db.doc(root)),months=await tx.get(db.collection(root+'/months'));
  if(!metadata.exists||Math.abs(metadata.data().inventoryValue-expected.inventoryValue)>0.0001)throw Error('Original dashboard inventory value mismatch');
  const actual=new Map(months.docs.map(d=>[d.id,Object.values(d.data().days).reduce((sum,day)=>({income:sum.income+(day.income||0),sales:sum.sales+(day.sales||0)}),{income:0,sales:0})]));
  for(const month of new Set([...expected.months.keys(),...actual.keys()]))for(const field of ['income','sales'])if(Math.abs((expected.months.get(month)?.[field]||0)-(actual.get(month)?.[field]||0))>0.0001)throw Error('Original dashboard monthly '+field+' mismatch: '+month);
  return{companyId,storeId,inventoryMatches:true,chartMonthsMatch:true,months:expected.months.size};
 },{readOnly:true});
}
