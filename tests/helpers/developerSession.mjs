import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Entire App controller and real navigation/Developer Center; Firestore is in-memory.
// Operational screens expose their received props so isolation is checked at the boundary.
export async function developerSession({browser=false}={}) {
  const dir = await mkdtemp(join(process.cwd(), 'tests/.developer-session-'));
  const screens = ['LoginView', 'DashboardView', 'PosView', 'InventoryView', 'InventoryTransferView', 'LayawayView', 'SalesView', 'PurchasesView', 'SellersView', 'StoresView', 'StockTakeHistoryView', 'CustomersView', 'SettingsView', 'PayrollView', 'RoleManagerView', 'IncidentsView', 'CeoCenterView', 'SmartAccountantView', 'FinancialReconciliationView', 'GiftVouchersView', 'TagScanningView', 'ReportsView', 'ReceiptModal', 'RecaudoReceiptModal', 'InventoryVerificationModal', 'PendingIncidentsBriefingModal'];
  const result = await build({bundle:true, write:false, format:'esm', platform:browser?'browser':'node', external:browser?[]:['react'], stdin:{contents:`${browser ? "export {createElement} from 'react'; export {createRoot} from 'react-dom/client';" : ''}export {default as App} from './components/App'; export {default as Header} from './components/Header'; export {default as DeveloperCenter} from './components/DeveloperCenterView'; export {View, DEFAULT_COMPANY_ID} from './types'; export {PLATFORM_OWNER_USER_ID} from './services/developerAccess'; export * from 'firebase/firestore'; export {renderedScreens} from 'screen-state';`, resolveDir:process.cwd()}, plugins:[{name:'session-fixtures',setup(b){
    b.onResolve({filter:/^(firebase\/(firestore|auth)|\.\.\/firebase)$/}, a=>({path:a.path,namespace:'fixtures'}));
    b.onLoad({filter:/.*/,namespace:'fixtures'},a=>({contents:a.path==='../firebase' ? 'export const db={}; export const auth={};' : a.path==='firebase/auth' ? 'export const onAuthStateChanged=(_,f)=>{f({uid:"test"});return()=>{}}; export const signInAnonymously=async()=>{};' : `
      export const records=new Map(), connections=[], writes=[];
      export const collection=(_,name)=>({name,path:name});
      export const doc=(parent,name,id)=>({name:name||parent.name,id:id||'new-id',path:(name||parent.name)+'/'+(id||'new-id')});
      export const where=(field,op,value)=>({field,op,value});
      export const limit=value=>({limit:value}); export const orderBy=()=>({});
      export const query=(source,...filters)=>({...source,filters});
      const document=(name,row)=>({id:row.id,data:()=>row,exists:()=>true});
      export const snapshot=q=>q.id ? (records.get(q.name)||[]).filter(r=>r.id===q.id).map(r=>document(q.name,r))[0]||{exists:()=>false} : {docs:(records.get(q.name)||[]).filter(r=>(q.filters||[]).every(f=>!f.field||r[f.field]===f.value)).map(r=>document(q.name,r)),get empty(){return !this.docs.length}};
      export function onSnapshot(q,apply){const c={q,apply,closed:false}; connections.push(c); queueMicrotask(()=>{if(!c.closed)apply(snapshot(q))});return()=>{c.closed=true}};
      export const getDoc=async q=>snapshot(q); export const getDocs=async q=>snapshot(q);
      export const addDoc=async(ref,data)=>{writes.push({ref,data});return{id:'generated'}};
      export const setDoc=async()=>{throw Error('unexpected write')}, updateDoc=setDoc, deleteDoc=setDoc;
      export const writeBatch=()=>({update:setDoc,set:setDoc,delete:setDoc,commit:async()=>{}});
      export const runTransaction=async()=>{throw Error('unexpected transaction')};
      export const increment=value=>value, arrayUnion=(...v)=>v, deleteField=()=>{};
    `}));
    b.onResolve({filter:/^screen-state$/},()=>({path:'state',namespace:'screen-state'}));
    b.onLoad({filter:/.*/,namespace:'screen-state'},()=>({contents:'export const renderedScreens=[];'}));
    b.onResolve({filter:new RegExp('^\\./('+screens.join('|')+')$')},a=>({path:a.path.slice(2),namespace:'screen'}));
    b.onLoad({filter:/.*/,namespace:'screen'},a=>({resolveDir:process.cwd(),contents:`import React from 'react'; import {renderedScreens} from 'screen-state'; export function ${a.path}(props){renderedScreens.push({screen:${JSON.stringify(a.path)},props});return ${browser ? `React.createElement('div',{'data-screen':${JSON.stringify(a.path)}},${JSON.stringify(a.path)})` : `React.createElement('test-screen',{...props,screen:${JSON.stringify(a.path)}})`}}; export default ${a.path};`}));
    b.onResolve({filter:/storageService$/},()=>({path:'storage',namespace:'storage'}));
    b.onLoad({filter:/.*/,namespace:'storage'},()=>({contents:'export const compressImage=async file=>file.result; export const reuploadImageFromUrl=async()=>{}; export const uploadImageAndGetURL=async()=>{};'}));
  }}]});
  const path=join(dir,'app.mjs'); await writeFile(path,result.outputFiles[0].text);
  if(browser)return {path,cleanup:()=>rm(dir,{recursive:true,force:true})};
  return {...await import(pathToFileURL(path).href), cleanup:()=>rm(dir,{recursive:true,force:true})};
}

export function browserGlobals() {
  const previous = Object.fromEntries(['localStorage','window','document','alert'].map(k=>[k,globalThis[k]]));
  const values=new Map();
  globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
  globalThis.window={scrollTo(){},addEventListener(){},removeEventListener(){},confirm:()=>true};
  globalThis.document={documentElement:{style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}}},addEventListener(){},removeEventListener(){}};
  globalThis.alert=message=>{throw Error(message)};
  return ()=>Object.assign(globalThis,previous);
}
