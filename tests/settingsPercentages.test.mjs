import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import React from 'react';
import {create,act} from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('percentages can be cleared, typed with decimals and saved as rates without leaking drafts between stores',async()=>{
 const dir=await mkdtemp(join(process.cwd(),'tests/.settings-percent-'));let r;
 try{
 const b=await build({entryPoints:['components/SettingsView.tsx'],bundle:true,write:false,format:'esm',platform:'node',packages:'external',external:['react'],plugins:[{name:'external-services',setup(b){b.onResolve({filter:/storageService$|\/firebase$|LabelConfigPanel$/},a=>({path:a.path,namespace:'fake'}));b.onLoad({filter:/.*/,namespace:'fake'},()=>({contents:'export const db={}; export const compressImage=async x=>x; export const LabelConfigPanel=()=>null;'}));}}]});
 const path=join(dir,'settings.mjs');await writeFile(path,b.outputFiles[0].text);const {SettingsView}=await import(pathToFileURL(path).href);
 let saved;const props={companyId:'a',stores:[{id:'one',companyId:'a',name:'One'},{id:'two',companyId:'a',name:'Two'}],currentUser:{id:'u',companyId:'a',storeId:'one',roleId:'admin'},roles:[{id:'admin',companyId:'a',userType:'admin'}],allInventory:[],categories:[],onSave:s=>saved=s};
 await act(async()=>{r=create(React.createElement(SettingsView,props));});
 for(const prefix of ['commission','surcharge']){
 const name=prefix+'_Sistecredito',field=()=>r.root.findByProps({name});
 await act(async()=>field().props.onChange({target:{name,value:'',type:'number'}}));assert.equal(field().props.value,'');
 for(const value of ['3','3.','3.5']){await act(async()=>field().props.onChange({target:{name,value,type:'number'}}));assert.equal(field().props.value,value);}
 await act(async()=>r.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.equal(saved[prefix==='commission'?'paymentCommissions':'paymentSurcharges'].Sistecredito,.035);
 await act(async()=>field().props.onBlur({target:{name}}));assert.equal(field().props.value,'3.50');
 await act(async()=>field().props.onChange({target:{name,value:'',type:'number'}}));await act(async()=>field().props.onBlur({target:{name}}));assert.equal(field().props.value,'0.00');
 }
 const name='commission_Sistecredito';await act(async()=>r.root.findByProps({name}).props.onChange({target:{name,value:'7',type:'number'}}));
 await act(async()=>r.root.findByProps({id:'storeSelector'}).props.onChange({target:{value:'two'}}));assert.equal(r.root.findByProps({name}).props.value,'0.00');
 }finally{if(r)await act(async()=>r.unmount());await rm(dir,{recursive:true,force:true});}
});
