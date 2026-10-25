import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {businessContribution,emptyBusinessDay} from '../functions/src/businessSummary.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
async function fixture(run){
 const dir=await mkdtemp(join(process.cwd(),'tests/.business-overview-'));let r;
 try{
 const b=await build({bundle:true,write:false,format:'esm',platform:'node',external:['react'],logLevel:'silent',stdin:{contents:`export {default as Overview} from './components/BusinessOverview';export {useBusinessSummary} from './services/useBusinessSummary';export * as fake from 'firebase/firestore';`,resolveDir:process.cwd()},plugins:[{name:'business-fixture',setup(b){
 b.onResolve({filter:/^firebase\/firestore$|^\.\.\/firebase$|^\.\/SalesHistoryChart$/},a=>({path:a.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='../firebase'?'export const db={};':a.path==='./SalesHistoryChart'?`import React from 'react';export default function Chart(props){return React.createElement('chart',props)}`:`
 export const connections=[];export const doc=(_,path)=>({path,document:true}),collection=(_,path)=>({path}),documentId=()=>'__name__',where=(field,op,value)=>({field,op,value}),orderBy=(field)=>({order:field}),query=(base,...filters)=>({...base,filters});
 export const onSnapshot=(q,...args)=>{const i=typeof args[0]==='function'?0:1;const c={q,next:args[i],error:args[i+1],closed:false,emit(rows,fromCache=false){const snapshot=q.document?{exists:()=>!!rows,data:()=>rows,metadata:{fromCache}}:{size:rows.length,metadata:{fromCache},docs:rows.map(d=>({id:d.id||d.date||d.month,data:()=>d})),docChanges:()=>rows.map(d=>({type:'added'}))};this.next(snapshot)}};connections.push(c);return()=>{c.closed=true}};
 `}));}}]});
 const path=join(dir,'view.mjs');await writeFile(path,b.outputFiles[0].text);const m=await import(pathToFileURL(path).href);
 await run(m,async element=>{await act(async()=>{if(r)r.update(element);else r=create(element)});return r});
 }finally{if(r)await act(async()=>r.unmount());await rm(dir,{recursive:true,force:true})}
}
const meta=store=>({companyId:'company',storeId:store,schemaVersion:1,ready:true,inventoryValue:1000});
test('summary counts recent payments on old layaways, deduplicates range invoices, and rejects late old-store callbacks',()=>fixture(async({useBusinessSummary,fake},render)=>{
 let value;const props={companyId:'company',storeId:'one',start:'2026-10-24',end:'2026-10-24',year:null,scope:'user:company'};
 function Probe(p){value=useBusinessSummary(p.companyId,p.storeId,p.start,p.end,p.year,p.scope);return null}
 await render(React.createElement(Probe,props));const root=fake.connections[0];await act(async()=>root.emit(meta('one')));
 assert.equal(fake.connections.length,2);const days=fake.connections[1];
 const contribution=businessContribution('layaways',{companyId:'company',storeId:'one',status:'active',createdAt:'2020-01-01T12:00:00-05:00',totalAmount:10000,seller:'Ana',items:[{price:10000,cost:5000,quantity:1}],payments:[{date:'2026-10-24T12:00:00-05:00',amount:3000,method:'QR'}]});
 await act(async()=>days.emit([{...contribution.days['2026-10-24'],id:'2026-10-24',companyId:'company',storeId:'one'}]));
 assert.equal(value.total(props.start,props.end).income,3000);assert.equal(value.total(props.start,props.end).units,0);assert.equal(value.loading,false);
 await render(React.createElement(Probe,{...props,start:'2026-10-23'}));assert.equal(days.closed,true);
 const periodDays=fake.connections.findLast(c=>c.q.path.endsWith('/days'));const repeats=fake.connections.findLast(c=>c.q.path.endsWith('/repeats'));
 await act(async()=>{periodDays.emit(['2026-10-23','2026-10-24'].map(id=>({...emptyBusinessDay(),id,companyId:'company',storeId:'one',income:100,invoices:1})));repeats.emit([{id:'repeat',companyId:'company',storeId:'one',days:['2026-10-23','2026-10-24']}]);});
 assert.equal(value.total('2026-10-23','2026-10-24').invoices,1);
 await render(React.createElement(Probe,{...props,storeId:'two'}));assert.equal(value.loading,true);assert.equal(value.total(props.start,props.end).income,0);
 await act(async()=>{root.emit(meta('one'));periodDays.emit([{...emptyBusinessDay(),id:props.start,companyId:'company',storeId:'one',income:99999}])});
 assert.equal(value.total(props.start,props.end).income,0);assert.equal(value.loading,true);
}));
test('overview loads only the selected date summaries; monthly chart opens and disconnects on demand',()=>fixture(async({Overview,fake},render)=>{
 let detail;const props={companyId:'company',store:{id:'one',companyId:'company',name:'One'},stores:[],scope:'user:company',onOpenDetails:s=>detail=s,onOpenVerification(){}};
 const r=await render(React.createElement(Overview,props));await act(async()=>fake.connections[0].emit(meta('one')));
 for(const c of fake.connections.filter(c=>!c.closed&&!c.q.document))await act(async()=>c.emit([]));
 assert.equal(fake.connections.some(c=>c.q.path.endsWith('/months')),false);assert.equal(r.root.findAllByType('chart').length,0);
 const button=label=>r.root.findAllByType('button').find(b=>b.children.join('')===label);
 await act(async()=>button('Mostrar gráfico').props.onClick());const months=fake.connections.find(c=>!c.closed&&c.q.path.endsWith('/months'));assert.ok(months);
 await act(async()=>months.emit([]));assert.equal(r.root.findAllByType('chart').length,1);
 await act(async()=>button('Cerrar gráfico').props.onClick());assert.equal(months.closed,true);assert.equal(r.root.findAllByType('chart').length,0);
 await act(async()=>button('Historial de ventas y abonos').props.onClick());assert.equal(detail,'sales-history');
 assert.ok(fake.connections.every(c=>c.q.path.startsWith('businessSummaryCompanies/')));
 await act(async()=>button('Mes').props.onClick());assert.ok(fake.connections.some(c=>!c.closed&&c.q.path.endsWith('/repeats')));
}));
test('empty cache does not declare the summary missing; authoritative absence enables full-data fallback',()=>fixture(async({Overview,fake},render)=>{
 let fallback=0;const r=await render(React.createElement(Overview,{companyId:'company',store:{id:'one',name:'One'},stores:[],scope:'scope',onOpenDetails(){},onOpenVerification(){},onSummaryUnavailable(){fallback++}}));
 await act(async()=>fake.connections[0].emit(null,true));assert.equal(fallback,0);
 await act(async()=>fake.connections[0].emit(null,false));assert.equal(fallback,1);assert.match(JSON.stringify(r.toJSON()),/pendiente de verificación/);
}));
