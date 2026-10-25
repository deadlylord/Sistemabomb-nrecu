import {useEffect,useState} from 'react';
import {collection,onSnapshot,query,where} from './measuredFirestore';
import {db} from '../firebase';
import {businessRoot} from '../functions/src/businessSummary.mjs';
import {bogotaDateKey} from './incomeChart';
import type {SalesRange} from './dashboardSalesRange';
import type {Layaway,Incident} from '../types';
export function useDashboardActivity(companyId:string,storeId:string|null,scope:string,enabled:boolean,ranges:SalesRange[]){
 const key=JSON.stringify([companyId,storeId,scope,ranges]);
 const [state,setState]=useState<{key:string;layaways:Layaway[];incidents:Incident[];loading:boolean;error:string}>({key:'',layaways:[],incidents:[],loading:true,error:''});
 useEffect(()=>{
  if(!enabled||!storeId)return;let active=true,failed=false;
  setState({key,layaways:[],incidents:[],loading:true,error:''});
  const rows=new Map<number,any[]>(),ready=new Set<number>();
  const requests=ranges.some(r=>!r)?[null]:[...ranges,'pending' as const];
  const fail=()=>{failed=true;if(active)setState({key,layaways:[],incidents:[],loading:false,error:'No se pudo cargar el resumen del período.'});};
  const stops=requests.map((range,i)=>{
   const filters=range==='pending'?[where('month','==','pending')]:range?[where('month','>=',bogotaDateKey(new Date(range.start)).slice(0,7)),where('month','<=',bogotaDateKey(new Date(new Date(range.end).getTime()-1)).slice(0,7))]:[];
   return onSnapshot(query(collection(db,businessRoot(companyId,storeId)+'/dashboardActivity'),...filters),snapshot=>{
    if(!active||failed)return;
    try{const groups=snapshot.docs.map(d=>d.data());
     for(const g of groups)if(g.companyId!==companyId||g.storeId!==storeId||g.schemaVersion!==1||!['layaways','incidents'].includes(g.kind)||typeof g.payload!=='string')throw Error('Invalid activity scope');
     rows.set(i,groups);ready.add(i);if(ready.size!==requests.length)return;
     const unique=new Map<string,{kind:string;version:string;row:any}>();
     for(const g of [...rows.values()].flat())for(const [id,value]of Object.entries(JSON.parse(g.payload)) as [string,any][]){const data=value.data;
      if(!id||id.includes('/')||typeof value.version!=='string'||data.storeId!==storeId||data.companyId&&data.companyId!==companyId)throw Error('Invalid activity row');
      const k=g.kind+'/'+id,previous=unique.get(k);if(!previous||previous.version<value.version)unique.set(k,{kind:g.kind,version:value.version,row:{...data,id}});
     }
     const all=[...unique.values()];setState({key,layaways:all.filter(v=>v.kind==='layaways').map(v=>v.row),incidents:all.filter(v=>v.kind==='incidents').map(v=>v.row),loading:false,error:''});
    }catch{fail();}
   },fail);
  });return()=>{active=false;stops.forEach(stop=>stop());};
 },[key,enabled]);
 return state.key===key?state:{layaways:[],incidents:[],loading:true,error:''};
}
