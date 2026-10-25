import {useEffect,useState,type Dispatch,type SetStateAction} from 'react';
import {collection,doc,onSnapshot,query,where} from './measuredFirestore';
import {db} from '../firebase';
import {bogotaDateKey} from './incomeChart';
import {businessRoot} from '../functions/src/businessSummary.mjs';
import type {Sale} from '../types';
import type {SalesRange} from './dashboardSalesRange';
export function useDashboardSales(companyId:string,storeId:string|null,scope:string,enabled:boolean,ranges:SalesRange[],setter:Dispatch<SetStateAction<Sale[]>>) {
 const key=JSON.stringify([scope,companyId,storeId,ranges]);
 const [state,setState]=useState({key:'',loading:false,error:''});
 useEffect(()=>{
  if(!enabled||!storeId)return;
  let active=true,failed=false;
  const rows=new Map<number,Sale[]>(),links=new Map<number,string[]>(),ready=new Set<number>(),linksReady=new Set<number>();
  const extra=new Map<string,{stop:()=>void;ready:boolean;row?:Sale}>(),stops:(()=>void)[]=[];
  setter([]);setState({key,loading:true,error:''});
  const fail=()=>{if(active){failed=true;setState({key,loading:false,error:'No se pudieron cargar las ventas del período. Vuelve a abrir la vista para reintentar.'});}};
  const own=(s:Sale)=>s.storeId===storeId&&(!s.companyId||s.companyId===companyId);
  const publish=()=>{
   if(!active||failed)return;
   const merged=new Map([...rows.values()].flat().map(s=>[s.id,s]));
   const needed=new Set([...links.values()].flat().filter(id=>!merged.has(id)));
   for(const [id,value] of extra)if(!needed.has(id)){value.stop();extra.delete(id);}
   for(const id of needed)if(!extra.has(id)){
    const value:{stop:()=>void;ready:boolean;row?:Sale}={stop:()=>{},ready:false};extra.set(id,value);
    value.stop=onSnapshot(doc(db,'sales',id),snapshot=>{
     if(!active||extra.get(id)!==value)return;
     const row=snapshot.exists()?{...snapshot.data(),id} as Sale:undefined;
     if(row&&!own(row)){fail();return;}value.row=row;value.ready=true;publish();
    },fail);
   }
   if(ready.size!==ranges.length||linksReady.size!==ranges.length||[...extra.values()].some(v=>!v.ready))return;
   for(const value of extra.values())if(value.row)merged.set(value.row.id,value.row);
   setter([...merged.values()].sort((a,b)=>a.id.localeCompare(b.id)));setState({key,loading:false,error:''});
  };
  ranges.forEach((range,i)=>{
   if(range){
    const first=bogotaDateKey(new Date(range.start)).slice(0,7),last=bogotaDateKey(new Date(new Date(range.end).getTime()-1)).slice(0,7);
    stops.push(onSnapshot(query(collection(db,businessRoot(companyId,storeId)+'/paymentSalesByMonth'),where('month','>=',first),where('month','<=',last)),snapshot=>{
     if(!active)return;
     const values=snapshot.docs.map(d=>d.data());
     if(values.some(v=>v.companyId!==companyId||v.storeId!==storeId||typeof v.saleId!=='string'||!v.saleId||v.saleId.includes('/'))){fail();return;}
     links.set(i,values.map(v=>v.saleId));linksReady.add(i);publish();
    },fail));
   }else{links.set(i,[]);linksReady.add(i);}
   stops.push(onSnapshot(query(collection(db,'sales'),where('storeId','==',storeId),...(range?[where('createdAt','>=',range.start),where('createdAt','<',range.end)]:[])),snapshot=>{
    if(!active)return;rows.set(i,snapshot.docs.map(d=>({...d.data(),id:d.id} as Sale)).filter(own));ready.add(i);publish();
   },fail));
  });
  return()=>{active=false;stops.forEach(stop=>stop());extra.forEach(v=>v.stop());};
 },[key,enabled,setter]);
 return enabled?(state.key===key?state:{loading:true,error:''}):{loading:false,error:''};
}
