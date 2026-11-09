import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const built = await build({entryPoints:['services/customerSuggestions.ts'],bundle:true,write:false,format:'esm',platform:'node',packages:'external'});
const dir=await mkdtemp(process.cwd()+'/tests/.customer-suggestions-');
await writeFile(dir+'/test.mjs',built.outputFiles[0].text);
const {customerSuggestions, normalizeCustomerPhone} = await import(pathToFileURL(dir+'/test.mjs').href);
test.after(()=>rm(dir,{recursive:true,force:true}));
test('suggestions recover sale/layaway customers, normalize phones and prefer directory edits',()=>{
 const row = {companyId:'co',storeId:'s',createdAt:'2026-11-01',id:'a',customerName:'Ana',customerPhone:'+57 300 123 4567'};
 const result=customerSuggestions('co','s',[],[row],[]);
 assert.equal(result[0].phone,'3001234567');assert.equal(result[0].name,'Ana');
 assert.equal(customerSuggestions('co','s',[],[],[row])[0].name,'Ana');
 assert.equal(customerSuggestions('co','s',[{companyId:'co',storeId:'s',id:'c',phone:'3001234567',name:'Corregida'}],[row],[])[0].name,'Corregida');
 assert.equal(normalizeCustomerPhone('300-123-4567'),'3001234567');
});
test('suggestions never use other company/store or malformed/anonymous numbers',()=>{
 const row={id:'x',companyId:'co',storeId:'s',createdAt:'2026-11-01',customerName:'Privado',customerPhone:'3001234567'};
 assert.deepEqual(customerSuggestions('co','s',[{...row,name:'Otra',phone:row.customerPhone,companyId:'other'}],[{...row,storeId:'other'},{...row,companyId:'other'},{...row,customerPhone:''}],[]),[]);
});
