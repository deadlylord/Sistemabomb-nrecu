import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import React from 'react';
import {create,act} from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
async function fixture(run){
 const dir=await mkdtemp(fileURLToPath(new URL('./.analytics-',import.meta.url)));
 try{
  const result=await build({bundle:true,write:false,format:'esm',platform:'node',external:['react','firebase/firestore'],stdin:{contents:`export * from './services/analyticsScope';export * from './services/useAsyncScope';export {default as Accountant} from './components/SmartAccountantView';export {default as Reports} from './components/ReportsView';export {CeoCenterView as Ceo} from './components/CeoCenterView';export {requests} from './services/geminiService';`,resolveDir:process.cwd()},plugins:[{name:'fake-ai',setup(b){b.onResolve({filter:/^recharts$/},()=>({path:'charts',namespace:'fake-chart'}));b.onLoad({filter:/.*/,namespace:'fake-chart'},()=>({contents:'export const BarChart=()=>null,Bar=()=>null,XAxis=()=>null,YAxis=()=>null,CartesianGrid=()=>null,Tooltip=()=>null,ResponsiveContainer=()=>null,Cell=()=>null,Legend=()=>null;'}));b.onResolve({filter:/geminiService$/},()=>({path:'ai',namespace:'fake'}));b.onLoad({filter:/.*/,namespace:'fake'},()=>({contents:`export const requests=[];const ask=(data,...args)=>new Promise(resolve=>requests.push({data,args,resolve}));export const getAccountingChatResponse=ask,analyzeSalesData=ask,generateStrategicReport=ask,getCeoCenterChatResponse=ask,generateProactiveCeoInsights=ask;`}));}}]});
  const path=join(dir,'fixture.mjs');await writeFile(path,result.outputFiles[0].text);await run(await import(pathToFileURL(path).href));
 }finally{await rm(dir,{recursive:true,force:true});}
}
test('analytics excludes foreign companies, foreign stores and contradictory company tags across all monetary sources',()=>fixture(async({analyticsScope,selectAnalyticsRows})=>{
 const scope=analyticsScope('mayla',[{id:'m1',companyId:'mayla'},{id:'metro',companyId:'default_company'}]);
 assert.deepEqual([...scope.storeIds],['m1']);
 const rows=[{id:'own',storeId:'m1',companyId:'mayla'},{id:'legacy',storeId:'m1'},{id:'foreign',storeId:'metro',companyId:'default_company'},{id:'contradictory',storeId:'m1',companyId:'other'}];
 for(const name of ['sales','layaways','inventory','purchases','expenses','payrollHistory','financialRecords','loans'])assert.deepEqual(selectAnalyticsRows(name,rows,scope).map(r=>r.id),['own','legacy']);
 assert.deepEqual(selectAnalyticsRows('daily_notes',[{id:'a',tienda:'m1',companyId:'mayla'},{id:'b',tienda:'metro',companyId:'mayla'}],scope).map(r=>r.id),['a']);
}));
test('pending operations stay invalid after company A -> B -> A, superseding requests and unmounting',()=>fixture(async({useAsyncScope})=>{
 let begin,renderer;function Probe({scope}){begin=useAsyncScope(scope);return null;}
 try{
  await act(async()=>{renderer=create(React.createElement(Probe,{scope:'A'}));});const first=begin();assert.equal(first(),true);
  await act(async()=>renderer.update(React.createElement(Probe,{scope:'B'})));assert.equal(first(),false);
  await act(async()=>renderer.update(React.createElement(Probe,{scope:'A'})));assert.equal(first(),false);
  const superseded=begin(),last=begin();assert.equal(superseded(),false);assert.equal(last(),true);
  await act(async()=>renderer.unmount());assert.equal(last(),false);renderer=null;
 }finally{if(renderer)await act(async()=>renderer.unmount());}
}));
test('real accountant sends only selected-store data and cannot save a late AI response into another context',()=>fixture(async({Accountant,requests})=>{
 const now=new Date().toISOString();const sale=(id,storeId,companyId,amount)=>({id,storeId,companyId,createdAt:now,totalAmount:amount,items:[{id:'p',cost:1,quantity:1}],payments:[{amount,date:now,method:'Efectivo'}]});
 const saves=[];const props={sales:[sale('own','m1','mayla',11),sale('foreign','metro','default_company',999),sale('bad','m1','other',888),sale('other-store','m2','mayla',777)],layaways:[],expenses:[],payrollHistory:[],inventory:[],purchases:[],financialRecords:[],loans:[],currentStore:{id:'m1',companyId:'mayla',name:'Mayla'},currentUser:{id:'c'},chatMessages:[],onUpdateChatMessages:async messages=>saves.push(messages)};
 let renderer,pending;
 try{
  await act(async()=>{renderer=create(React.createElement(Accountant,props));});
  await act(async()=>renderer.root.findAllByType('button').find(b=>b.children.includes('Auditoría IA Chat')).props.onClick());
  await act(async()=>{pending=renderer.root.findAllByType('button').find(b=>b.children.includes('PyG')).props.onClick();});
  assert.equal(requests[0].data.totalRevenue,11);assert.equal(saves.length,1);
  await act(async()=>renderer.update(React.createElement(Accountant,{...props,currentStore:{id:'metro',name:'Metro',companyId:'default_company'}})));
  await act(async()=>{requests[0].resolve('Respuesta de Mayla');await pending;});assert.equal(saves.length,1);
 }finally{if(renderer)await act(async()=>renderer.unmount());}
}));
test('report AI payload rejects another company and late results are discarded after closing',()=>fixture(async({Reports,requests})=>{
 const now=new Date().toISOString();const stores=[{id:'m1',name:'Mayla',companyId:'mayla'},{id:'metro',name:'Ajena',companyId:'default_company'}];
 const props={companyId:'mayla',isOpen:true,onClose:()=>{},stores,categories:[],allInventory:[],allSales:[{id:'own',storeId:'m1',companyId:'mayla',createdAt:now,items:[{id:'p',name:'Propio',quantity:1,price:11}]},{id:'bad',storeId:'m1',companyId:'other',createdAt:now,items:[{id:'bad',name:'Secreto',quantity:1,price:999}]}]};
 let renderer,pending;
 try{
  await act(async()=>{renderer=create(React.createElement(Reports,props));});
  await act(async()=>{pending=renderer.root.findAllByType('button').find(b=>b.children.includes('Análisis General del Periodo')).props.onClick();});
  assert.deepEqual(requests[0].data.tiendasAnalizadas,['Mayla']);assert.equal(requests[0].data.resumenPorTienda[0].totalVentas,11);assert.ok(!JSON.stringify(requests[0].data).includes('Secreto'));
  await act(async()=>renderer.update(React.createElement(Reports,{...props,isOpen:false})));
  await act(async()=>{requests[0].resolve('Respuesta anterior');await pending;});
  await act(async()=>renderer.update(React.createElement(Reports,props)));
  assert.ok(!JSON.stringify(renderer.toJSON()).includes('Respuesta anterior'));
 }finally{if(renderer)await act(async()=>renderer.unmount());}
}));

test('real CEO insights are requested manually and use selected-store purchases and expenses, excluding foreign tags',()=>fixture(async({Ceo,requests})=>{
 const now=new Date().toISOString();const props={companyId:'mayla',selectedStoreId:'m1',onSelectStore:()=>{},sales:[],layaways:[],inventory:[],purchases:[{id:'own',storeId:'m1',companyId:'mayla',createdAt:now,totalCost:12},{id:'other',storeId:'m2',companyId:'mayla',createdAt:now,totalCost:400},{id:'bad',storeId:'m1',companyId:'foreign',createdAt:now,totalCost:900}],expenses:[{id:'own',storeId:'m1',companyId:'mayla',date:now,amount:5},{id:'bad',storeId:'m1',companyId:'foreign',date:now,amount:800}],stores:[{id:'m1',name:'Mayla 1',companyId:'mayla'},{id:'m2',name:'Mayla 2',companyId:'mayla'}],sellers:[],ceoNotes:[],currentUser:{id:'c'},categories:[]};
 let renderer,pending;
 try{
  await act(async()=>{renderer=create(React.createElement(Ceo,props));});assert.equal(requests.length,0);
  await act(async()=>{pending=renderer.root.findAllByType('button').find(b=>b.children.includes('Generar sugerencias IA')).props.onClick();});
  assert.equal(requests[0].data.kpis.compras,12);assert.equal(requests[0].data.kpis.gastos,5);
  await act(async()=>renderer.update(React.createElement(Ceo,{...props,selectedStoreId:'m2'})));
  await act(async()=>{requests[0].resolve('Sugerencia anterior');await pending;});assert.ok(!JSON.stringify(renderer.toJSON()).includes('Sugerencia anterior'));assert.equal(requests.length,1);
 }finally{if(renderer)await act(async()=>renderer.unmount());}
}));
