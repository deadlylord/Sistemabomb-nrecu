import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import React from 'react';
import {create,act} from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

test('real module filters survive store remounts and module navigation but reset with company/user scope',async()=>{
 const dir=await mkdtemp(join(process.cwd(),'tests/.filters-'));let renderer;
 try{
 const result=await build({stdin:{contents:"export {ViewFiltersProvider} from './services/viewFilters';export {default as IncidentsView} from './components/IncidentsView';export {InventoryTransferView} from './components/InventoryTransferView';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',external:['react','firebase/firestore']});
 const path=join(dir,'views.mjs');await writeFile(path,result.outputFiles[0].text);
 const {ViewFiltersProvider,IncidentsView,InventoryTransferView}=await import(pathToFileURL(path).href);
 const props={readOnly:true,companyId:'mayla',stores:[{id:'m1',companyId:'mayla'},{id:'m2',companyId:'mayla'}],currentUser:{id:'u',roleId:'seller',storeId:'m1'},roles:[],incidents:[],inventory:[],sales:[],customers:[],transfers:[]};
 const render=(store,module='incidents',scope='u:mayla')=>React.createElement(ViewFiltersProvider,{key:scope},React.createElement('main',{key:store+module},React.createElement(module==='incidents'?IncidentsView:InventoryTransferView,{...props,activeStoreId:store})));
 await act(async()=>{renderer=create(render('m1'));});
 await act(async()=>renderer.root.findByType('select').props.onChange({target:{value:'Traslado Solicitado'}}));
 await act(async()=>renderer.root.findByType('input').props.onChange({target:{value:'azul'}}));
 await act(async()=>renderer.update(render('m2')));
 assert.equal(renderer.root.findByType('select').props.value,'Traslado Solicitado');
 assert.equal(renderer.root.findByType('input').props.value,'azul');
 await act(async()=>renderer.update(render('m2','transfers')));
 const dateInputs=()=>renderer.root.findAllByType('input').filter(n=>n.props.type==='date');
 await act(async()=>dateInputs()[0].props.onChange({target:{value:'2026-09-01'}}));
 await act(async()=>dateInputs()[1].props.onChange({target:{value:'2026-09-30'}}));
 await act(async()=>renderer.update(render('m1','transfers')));
 assert.deepEqual(dateInputs().map(n=>n.props.value),['2026-09-01','2026-09-30']);
 await act(async()=>renderer.update(render('m1')));
 assert.equal(renderer.root.findByType('select').props.value,'Traslado Solicitado');
 for(const scope of ['u:other','another:mayla']){
 await act(async()=>renderer.update(render('m1','incidents',scope)));
 assert.equal(renderer.root.findByType('select').props.value,'ALL');
 assert.equal(renderer.root.findByType('input').props.value,'');
 }
 }finally{if(renderer)await act(async()=>renderer.unmount());await rm(dir,{recursive:true,force:true});}
});
