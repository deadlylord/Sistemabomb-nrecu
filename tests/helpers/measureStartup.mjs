import React from 'react';
import {create, act} from 'react-test-renderer';
import {developerSession,browserGlobals} from './developerSession.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
export async function measureStartup(storeCount=3) {
 const idleQueue=[],restore=browserGlobals({idleQueue}),m=await developerSession(); let r;
 const {records,View,DEFAULT_COMPANY_ID}=m;
 const stores=Array.from({length:storeCount},(_,i)=>({id:`A${i}`,companyId:'A',name:`Store ${i}`,accentColorsUpdated:true}));
 records.set('stores',stores);records.set('companies',[{id:'A',allowedViews:Object.values(View)},{id:DEFAULT_COMPANY_ID}]);
 records.set('roles',[{id:'admin',companyId:'A',name:'Administrador',userType:'admin',permissions:Object.values(View)}]);
 records.set('sellers',[{id:'user',username:'admin',name:'Admin',password:'test',companyId:'A',storeId:'A0',roleId:'admin'}]);
 records.set('inventory',stores.map(s=>({id:`product-${s.id}`,companyId:'A',storeId:s.id,stock:1})));
 const sample=()=>{const counts={};for(const c of m.connections.filter(c=>!c.closed))counts[c.q.name]=(counts[c.q.name]||0)+1;return{listeners:counts,total:Object.values(counts).reduce((a,b)=>a+b,0),queries:m.reads.map(q=>({collection:q.name,id:q.id,filters:q.filters})),inventoryConnections:m.connections.filter(c=>c.q.name==='inventory').length}};
 try {
 await act(async()=>{r=create(React.createElement(m.App))}); const beforeLogin=sample();
 await act(async()=>{await r.root.findByProps({screen:'LoginView'}).props.onLogin('admin','test')});const essential=sample();
 const settleSecondary=()=>act(async()=>{for(let i=0;i<idleQueue.length;i++){const callback=idleQueue[i];idleQueue[i]=null;callback?.()}});
 await settleSecondary();const afterLogin=sample();
 const header=()=>r.root.findByType(m.Header);
 await act(async()=>header().props.setCurrentView(View.POS));const pos=sample();
 await act(async()=>header().props.onRequestStores?.());
 await act(async()=>header().props.onSwitchStore('A1'));await settleSecondary();const secondStore=sample();
 await act(async()=>header().props.onSwitchStore('A0'));await settleSecondary();const revisit=sample();
 await act(async()=>header().props.onToggleGlobalMode());const global=sample();
 return {storeCount,beforeLogin,essential,afterLogin,pos,secondStore,revisit,global};
 }finally{if(r)await act(async()=>r.unmount());await m.cleanup();restore()}
}
if(process.argv[1]?.endsWith('measureStartup.mjs'))console.log(JSON.stringify(await measureStartup(Number(process.argv[2]||3)),null,2));
