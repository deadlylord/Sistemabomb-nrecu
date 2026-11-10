import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import React from 'react';
import {create,act} from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('settings use active store, preserve edits, patch only changed rates and await tenant-scoped confirmation',async()=>{
 const dir=await mkdtemp(join(process.cwd(),'tests/.settings-isolation-'));let r;
 try{
 const built=await build({stdin:{contents:"export {SettingsView} from './components/SettingsView';export * from './services/storeSettingsPatch';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',packages:'external',external:['react'],plugins:[{name:'external-services',setup(b){b.onResolve({filter:/storageService$|\/firebase$|LabelConfigPanel$/},a=>({path:a.path,namespace:'fake'}));b.onLoad({filter:/.*/,namespace:'fake'},()=>({contents:'export const db={}; export const compressImage=async x=>x; export const LabelConfigPanel=()=>null;'}));}}]});
 const path=join(dir,'settings.mjs');await writeFile(path,built.outputFiles[0].text);const {SettingsView,storeSettingsPatch}=await import(pathToFileURL(path).href);

 const a={id:'a1',companyId:'a',name:'A',nextInvoiceNumber:10,paymentCommissions:{Sistecredito:.01,Addi:.02},labelConfig:{width:57}};
 const b={id:'a2',companyId:'a',name:'B',paymentCommissions:{Sistecredito:.03}};
 let release,reject,called=0,patch;
 const props={companyId:'a',activeStoreId:'a2',stores:[a,b],currentUser:{id:'u',companyId:'a',storeId:'a1',roleId:'admin'},roles:[{id:'admin',companyId:'a',userType:'admin'}],allInventory:[],categories:[],onSave:async(s,p)=>{called++;patch=p;await new Promise((ok,no)=>{release=ok;reject=no;});}};
 await act(async()=>{r=create(React.createElement(SettingsView,props));});
 assert.equal(r.root.findByProps({id:'storeSelector'}).props.value,'a2');
 await act(async()=>r.root.findByProps({id:'storeSelector'}).props.onChange({target:{value:'a1'}}));
 const field=()=>r.root.findByProps({name:'commission_Sistecredito'});
 await act(async()=>field().props.onChange({target:{name:'commission_Sistecredito',value:'5',type:'number'}}));
 await act(async()=>r.update(React.createElement(SettingsView,{...props,stores:[{...a,nextInvoiceNumber:20,paymentCommissions:{Sistecredito:.01,Addi:.04}},b]})));
 assert.equal(field().props.value,'5');assert.equal(r.root.findByProps({name:'nextInvoiceNumber'}).props.value,20);
 assert.equal(r.root.findByProps({name:'commission_Addi'}).props.value,'4.00');
 let pending;await act(async()=>{pending=r.root.findByType('form').props.onSubmit({preventDefault(){}});});
 assert.equal(called,1);assert.deepEqual(patch,{'paymentCommissions.Sistecredito':.05});
 assert.equal(r.root.findByType('fieldset').props.disabled,true);
 assert.ok(!JSON.stringify(r.toJSON()).includes('¡Ajustes guardados!'));
 await act(async()=>r.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.equal(called,1);
 await act(async()=>{reject(Error('Permiso denegado'));await pending;});
 assert.match(r.root.findByProps({role:'alert'}).children.join(''),/Permiso denegado/);assert.equal(field().props.value,'5');
 await act(async()=>{pending=r.root.findByType('form').props.onSubmit({preventDefault(){}});});
 await act(async()=>{release();await pending;});assert.ok(JSON.stringify(r.toJSON()).includes('¡Ajustes guardados!'));
 assert.throws(()=>storeSettingsPatch(a,{...a,companyId:'b'},'a'));
 assert.throws(()=>storeSettingsPatch(a,{...a,id:'b'},'a'));
 assert.deepEqual(storeSettingsPatch(a,{...a,contactInfo:'new'},'a'),{contactInfo:'new'});
 // A late acknowledgement from A must not confirm anything in another company.
 await act(async()=>field().props.onChange({target:{name:'commission_Sistecredito',value:'6',type:'number'}}));
 await act(async()=>{pending=r.root.findByType('form').props.onSubmit({preventDefault(){}});});
 await act(async()=>r.update(React.createElement(SettingsView,{...props,companyId:'b',activeStoreId:'b1',stores:[{id:'b1',companyId:'b',name:'Other'}]})));
 await act(async()=>{release();await pending;});
 assert.ok(!JSON.stringify(r.toJSON()).includes('¡Ajustes guardados!'));assert.equal(field().props.value,'0.00');
 }finally{if(r)await act(async()=>r.unmount());await rm(dir,{recursive:true,force:true});}
});
