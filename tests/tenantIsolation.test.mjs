import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { build } from 'esbuild';

async function withWriter(run) {
 const dir = await mkdtemp(fileURLToPath(new URL('./.tenant-', import.meta.url)));
 try {
 const bundle=await build({bundle:true,write:false,format:'esm',platform:'node',stdin:{contents:`export * from './services/tenantWrites'; export * from './services/companyRoles'; export { records, reads, writes } from 'firebase/firestore';`,resolveDir:process.cwd()},plugins:[{name:'fake',setup(b){b.onResolve({filter:/^firebase\/firestore$/},()=>({path:'firestore',namespace:'fake'}));b.onLoad({filter:/.*/,namespace:'fake'},()=>({contents:`
 export const records=new Map(), reads=[], writes=[];
 export const doc=(_,collection,id)=>({path:collection+'/'+id,id});
 const snapshot=ref=>({ref,id:ref.id,exists:()=>records.has(ref.path),data:()=>records.get(ref.path)});
 export const getDoc=async ref=>{reads.push(ref.path);return snapshot(ref)};
 export const setDoc=async(ref,data)=>{writes.push(['set',ref.path]);records.set(ref.path,data)};
 export const updateDoc=async(ref,data)=>{writes.push(['update',ref.path]);records.set(ref.path,{...records.get(ref.path),...data})};
 export const deleteDoc=async ref=>{writes.push(['delete',ref.path]);records.delete(ref.path)};
 export const writeBatch=()=>{const queued=[];const b={set:(r,d)=>{queued.push(()=>setDoc(r,d));return b},update:(r,d)=>{queued.push(()=>updateDoc(r,d));return b},delete:r=>{queued.push(()=>deleteDoc(r));return b},commit:async()=>{for(const f of queued)await f()}};return b};
 export const runTransaction=async(_,callback)=>{const b=writeBatch();let wrote=false;const tx={get:async ref=>{if(wrote)throw Error('read after write');return getDoc(ref)},set:(...a)=>{wrote=true;b.set(...a)},update:(...a)=>{wrote=true;b.update(...a)},delete:(...a)=>{wrote=true;b.delete(...a)}};const value=await callback(tx);await b.commit();return value};
 `}));}}]});
 const path=join(dir,'tenant.mjs');await writeFile(path,bundle.outputFiles[0].text);const module=await import(pathToFileURL(path).href);await run(module);
 }finally{await rm(dir,{recursive:true,force:true})}
}
const ref = path => ({ path, id: path.split('/')[1] });
const scope = {companyId:'mayla',storeIds:new Set(['mayla-1','mayla-2'])};

test('tenant writer rejects foreign mutation, forged payload ownership and references without partial batch writes',()=>withWriter(async({createTenantWriter,records,writes})=>{
 const writer=createTenantWriter({},scope);
 records.set('inventory/foreign',{storeId:'metro',companyId:'bombon',stock:8});
 records.set('inventory/own',{storeId:'mayla-1',companyId:'mayla',stock:4});
 await assert.rejects(writer.updateDoc(ref('inventory/foreign'),{storeId:'mayla-1',companyId:'mayla',stock:0}));
 await assert.rejects(writer.deleteDoc(ref('inventory/foreign')));
 const b=writer.writeBatch();b.update(ref('inventory/own'),{stock:9});b.update(ref('inventory/foreign'),{stock:0});await assert.rejects(b.commit());
 await assert.rejects(writer.setDoc(ref('sales/sale'),{storeId:'mayla-1',items:[{id:'foreign',quantity:1}]}));
 assert.equal(writes.length,0);assert.equal(records.get('inventory/own').stock,4);
}));

test('tenant writer validates linked category, role and transfer destination and preserves legacy own-store records',()=>withWriter(async({createTenantWriter,records})=>{
 const writer=createTenantWriter({},scope);
 records.set('categories/foreign',{name:'Blusas',companyId:'bombon'});
 records.set('roles/foreign',{name:'Vendedor',companyId:'bombon'});
 records.set('customers/legacy',{storeId:'mayla-1',name:'Original'});
 await writer.updateDoc(ref('customers/legacy'),{name:'Actualizado'});assert.equal(records.get('customers/legacy').companyId,'mayla');
 await assert.rejects(writer.setDoc(ref('inventory/new'),{storeId:'mayla-1',categoryId:'foreign'}));
 await assert.rejects(writer.setDoc(ref('sellers/new'),{storeId:'mayla-1',roleId:'foreign'}));
 await assert.rejects(writer.setDoc(ref('inventoryTransfers/new'),{fromStoreId:'mayla-1',toStoreId:'metro'}));
 await assert.rejects(writer.setDoc(ref('financialRecords/new'),{storeId:'mayla-1',debtStoreId:'metro'}));
}));

test('bulk creation shares reference reads, skips generated ID reads and stamps tenant ownership',()=>withWriter(async({createTenantWriter,records,reads})=>{
 const writer=createTenantWriter({},scope);const b=writer.writeBatch();
 const category=ref('categories/new');writer.registerNew(category);b.set(category,{name:'Propia'});
 for(let i=0;i<40;i++){const product=ref('inventory/p'+i);writer.registerNew(product);b.set(product,{storeId:'mayla-1',categoryId:'new',stock:1});const log=ref('productHistory/l'+i);writer.registerNew(log);b.set(log,{storeId:'mayla-1',productId:product.id});}
 await b.commit();assert.equal(reads.length,0);assert.equal(records.get('categories/new').companyId,'mayla');assert.equal(records.get('inventory/p39').stock,1);
}));

test('sales transactions validate all linked products before any write and preserve transaction read order',()=>withWriter(async({createTenantWriter,records})=>{
 const writer=createTenantWriter({},scope);records.set('stores/mayla-1',{companyId:'mayla',nextInvoiceNumber:1});records.set('inventory/own',{storeId:'mayla-1',stock:4});
 const sale=ref('sales/sale');writer.registerNew(sale);
 await writer.runTransaction({},async tx=>{await tx.get(ref('stores/mayla-1'));tx.update(ref('inventory/own'),{stock:3});tx.set(sale,{storeId:'mayla-1',items:[{id:'own'}]});return true});
 assert.equal(records.get('inventory/own').stock,3);assert.equal(records.get('sales/sale').companyId,'mayla');
 await writer.updateDoc(sale,{customerName:'Prueba'});assert.equal(records.get('sales/sale').customerName,'Prueba');
 records.set('giftVouchers/foreign',{storeId:'metro'});await assert.rejects(writer.runTransaction({},async tx=>{await tx.get(ref('giftVouchers/foreign'));tx.update(ref('inventory/own'),{stock:0});}));assert.equal(records.get('inventory/own').stock,3);
}));

test('company roles preserve old permissions and an existing company role customization',()=>withWriter(async({ensureCompanyRole,records})=>{
 records.set('roles/seller',{name:'Vendedor',permissions:['pos']});
 const id=await ensureCompanyRole({},'seller','mayla');assert.equal(records.get('roles/'+id).companyId,'mayla');assert.deepEqual(records.get('roles/seller').permissions,['pos']);
 records.get('roles/'+id).permissions=['pos','payroll'];await ensureCompanyRole({},'seller','mayla');assert.deepEqual(records.get('roles/'+id).permissions,['pos','payroll']);
 records.set('roles/foreign',{companyId:'other',permissions:['developer']});await assert.rejects(ensureCompanyRole({},'foreign','mayla'));
}));
