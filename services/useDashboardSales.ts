import {useEffect,useState,type Dispatch,type SetStateAction} from 'react';
import {collection,onSnapshot,query,where} from './measuredFirestore';
import {db} from '../firebase';
import type {Sale} from '../types';
import type {SalesRange} from './dashboardSalesRange';
export function useDashboardSales(companyId:string,storeId:string|null,scope:string,enabled:boolean,ranges:SalesRange[],setter:Dispatch<SetStateAction<Sale[]>>) {
 const key=JSON.stringify([scope,companyId,storeId,ranges]);
 const [state,setState]=useState({key:'',loading:false,error:''});
 useEffect(()=>{
  if(!enabled||!storeId)return;
  let active=true;const rows=new Map<number,Sale[]>();const ready=new Set<number>();setter([]);setState({key,loading:true,error:''});
  const stops=ranges.map((range,i)=>onSnapshot(query(collection(db,'sales'),where('storeId','==',storeId),...(range?[where('createdAt','>=',range.start),where('createdAt','<',range.end)]:[])),snapshot=>{
   if(!active)return;
   rows.set(i,snapshot.docs.map(d=>({...d.data(),id:d.id} as Sale)).filter(s=>s.storeId===storeId&&(!s.companyId||s.companyId===companyId)));ready.add(i);
   if(ready.size!==ranges.length)return;
   const merged=new Map([...rows.values()].flat().map(s=>[s.id,s]));setter([...merged.values()].sort((a,b)=>a.id.localeCompare(b.id)));setState({key,loading:false,error:''});
  },()=>{if(active)setState({key,loading:false,error:'No se pudieron cargar las ventas del período. Vuelve a abrir la vista para reintentar.'});}));
  return()=>{active=false;stops.forEach(stop=>stop());};
 },[key,enabled,setter]);
 return enabled?(state.key===key?state:{loading:true,error:''}):{loading:false,error:''};
}
