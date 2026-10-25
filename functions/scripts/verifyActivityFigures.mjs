import {browserChartDay} from '../src/verifyDashboardFigures.mjs';
const list=v=>Array.isArray(v)?v:Object.values(v||{}),n=v=>Number(v)||0;
const rates={Addi:.065,Sistecredito:.03,Tarjeta:.0515};
// Independently mirror the dashboard's source-dependent figures, not the projection builder.
export function originalActivityFigures(layaways,incidents,start,end){
 const inside=v=>{const day=browserChartDay(v);return day&&day>=start&&day<=end;};
 const out={units:0,gifts:0,collected:0,cogs:0,profit:0,direct:0,cash:0,methods:{},sellers:{},categories:{},products:{},invoices:[]};const invoices=new Set();
 const add=(field,key,v)=>{out[field][key]=(out[field][key]||0)+v;};
 for(const l of layaways){const items=list(l.items).filter(Boolean),paid=items.filter(i=>n(i.price)>0);
  if(inside(l.createdAt)){
   for(const i of items){add('categories',i.categoryId,n(i.price)*n(i.quantity));add('products',i.id,n(i.quantity));}
   if(!['cancelled','pre-order'].includes(l.status)){const units=paid.reduce((s,i)=>s+n(i.quantity),0);out.units+=units;out.gifts+=items.filter(i=>!n(i.price)).reduce((s,i)=>s+n(i.quantity),0);add('sellers',l.seller,units);}
  }
  const cost=paid.reduce((s,i)=>s+n(i.cost)*n(i.quantity),0),profit=paid.reduce((s,i)=>s+(n(i.price)-n(i.cost))*n(i.quantity),0)-n(l.discountAmount);
  for(const p of list(l.payments).filter(Boolean))if(inside(p.date)){
   const amount=n(p.amount);add('methods',p.method,amount);if(p.method==='Efectivo')out.cash+=amount;
   if(l.status!=='cancelled'&&p.method!=='Bono de Regalo'){out.collected+=amount;out.direct+=amount;out.cogs+=cost*amount/Math.max(n(l.totalAmount),1);out.profit+=profit*amount/Math.max(n(l.totalAmount),1)-amount*(rates[p.method]||0);invoices.add(l.id);}
  }
 }
 for(const i of incidents){if(!inside(i.createdAt)||i.status==='Pendiente de Aprobación')continue;const amount=n(i.adjustmentAmount),type=i.type;
  if(type==='Recaudo'||type==='Ajuste de Caja'&&i.adjustmentType==='income'){out.direct+=amount;if(type!=='Recaudo')out.profit+=amount;}
  if(type==='Recaudo')out.cash+=amount;
  if(type==='Ajuste de Caja'&&(!i.paymentMethod||i.paymentMethod==='Efectivo')&&!String(i.description).includes('Excedente pagado'))out.cash+=i.adjustmentType==='expense'?-amount:i.adjustmentType==='income'?amount:0;
  if(type==='Cambio de Producto'&&i.paymentMethod==='Efectivo'&&amount>0)out.cash+=amount;
  const skip=type==='Ajuste de Caja'&&String(i.description).includes('Excedente pagado'),valid=['Recaudo','Ingreso Adicional','Cambio de Producto'].includes(type)||type==='Ajuste de Caja'&&i.adjustmentType==='income',method=type==='Recaudo'?'Recaudo Sistecredito':i.paymentMethod;
  if(!skip&&valid&&method&&amount>0)add('methods',method,amount);
 }
 out.invoices=[...invoices].sort();return out;
}
export const comparableFigures=v=>JSON.stringify(v,(_,x)=>typeof x==='number'?Math.round(x*1e6)/1e6:x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
