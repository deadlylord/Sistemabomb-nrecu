import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { build } from 'esbuild';

async function withWriter(run) {
 const dir = await mkdtemp(fileURLToPath(new URL('./.tenant-', import.meta.url)));
 try {
 const bundle=await build({bundle:true,write:false,format:'esm',platform:'node',stdin:{contents:`export * from './services/tenantWrites'; export * from './services/tenantIdentity'; export * from './services/legacyCategoryIsolation'; export * from './services/companyRoles'; export * from './services/developerAccess'; export * from './services/platformDevelopers'; export { View } from './types'; export { records, reads, writes } from 'firebase/firestore';`,resolveDir:process.cwd()},plugins:[{name:'fake',setup(b){b.onResolve({filter:/^firebase\/firestore$/},()=>({path:'firestore',namespace:'fake'}));b.onLoad({filter:/.*/,namespace:'fake'},()=>({contents:`
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
 records.set('stores/mayla-1',{companyId:'mayla'});
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


test('only the immutable Carlos account initially has platform access; names, legacy flags and company roles cannot grant it',()=>withWriter(async({PLATFORM_OWNER_USER_ID,hasPlatformDeveloperAccess,assertCompanyRole,assertPlatformOwnerAction,View})=>{
 const owner={id:PLATFORM_OWNER_USER_ID,name:'Carlos',roleId:'1',storeId:'2'};
 assert.equal(hasPlatformDeveloperAccess(owner),true);
 assert.equal(hasPlatformDeveloperAccess({...owner,name:'Nombre cambiado',username:'otro'}),true);
 for(const name of ['Carlos','Carlos V','Developer'])assert.equal(hasPlatformDeveloperAccess({id:'other',name,username:'Carlos',isDeveloper:true,roleId:'developer'}),false);
 const grant={userId:'other',role:'developer',active:true,grantedBy:PLATFORM_OWNER_USER_ID};
 assert.equal(hasPlatformDeveloperAccess({id:'other'},grant),true);
 assert.equal(hasPlatformDeveloperAccess({id:'third'},grant),false);
 assert.equal(hasPlatformDeveloperAccess({id:'other',isDisabled:true},grant),false);
 assert.equal(hasPlatformDeveloperAccess({id:'other'},{...grant,active:false}),false);
 assert.equal(hasPlatformDeveloperAccess({id:'other'},{...grant,grantedBy:'other'}),false);
 assert.throws(()=>assertCompanyRole({id:'x',name:'Vendedor',permissions:[View.DEVELOPER_CENTER]}));
 assert.throws(()=>assertCompanyRole({id:'x',name:'Developer',permissions:[]}));
 assert.throws(()=>assertCompanyRole({id:'x',name:'Personalizado',userType:'developer',permissions:[]}));
 assert.throws(()=>assertPlatformOwnerAction({id:'other'},View.DEVELOPER_CENTER));
 assert.throws(()=>assertPlatformOwnerAction(owner,View.ROLE_MANAGER));
}));

test('only Carlos can assign/revoke developers inside Developer Center; grants cannot remove owner or activate missing/disabled accounts',()=>withWriter(async({setPlatformDeveloper,PLATFORM_OWNER_USER_ID,View,records,writes,createTenantWriter})=>{
 const owner={id:PLATFORM_OWNER_USER_ID};records.set('sellers/other',{name:'Cuenta',isDisabled:false});
 await assert.rejects(setPlatformDeveloper({}, {id:'other'},View.DEVELOPER_CENTER,'other',true));
 await assert.rejects(setPlatformDeveloper({},owner,View.SELLERS,'other',true));
 assert.equal(writes.length,0);
 await setPlatformDeveloper({},owner,View.DEVELOPER_CENTER,'other',true);
 assert.equal(records.get('platformDevelopers/other').grantedBy,PLATFORM_OWNER_USER_ID);
 assert.equal(records.get('sellers/other').platformRole,'developer');
 await setPlatformDeveloper({},owner,View.DEVELOPER_CENTER,'other',false);
 assert.equal(records.get('platformDevelopers/other').active,false);assert.equal(records.get('sellers/other').platformRole,null);
 await assert.rejects(setPlatformDeveloper({},owner,View.DEVELOPER_CENTER,PLATFORM_OWNER_USER_ID,false));
 await assert.rejects(setPlatformDeveloper({},owner,View.DEVELOPER_CENTER,'missing',true));
 records.set('sellers/disabled',{isDisabled:true});await assert.rejects(setPlatformDeveloper({},owner,View.DEVELOPER_CENTER,'disabled',true));
 const writer=createTenantWriter({},scope);
 await assert.rejects(writer.setDoc(ref('platformDevelopers/forged'),{companyId:'mayla',userId:'forged',role:'developer',active:true,grantedBy:PLATFORM_OWNER_USER_ID}));
 await assert.rejects(writer.setDoc(ref('sellers/forged'),{storeId:'mayla-1',platformRole:'developer'}));
}));


test('financial links reject foreign vouchers, original sales, layaways and mirrored records before any writes',()=>withWriter(async({createTenantWriter,records,writes})=>{
 const writer=createTenantWriter({},scope);
 records.set('giftVouchers/foreign',{storeId:'metro',companyId:'bombon',currentValue:100});
 records.set('sales/foreign',{storeId:'metro',companyId:'bombon',items:[]});
 records.set('layaways/foreign',{storeId:'metro',companyId:'bombon',items:[]});
 records.set('financialRecords/foreign',{storeId:'metro',companyId:'bombon'});
 records.set('sales/own',{storeId:'mayla-1',companyId:'mayla',items:[],payments:[]});
 await assert.rejects(writer.updateDoc(ref('sales/own'),{payments:[{voucherId:'foreign',amount:25}]}));
 await assert.rejects(writer.setDoc(ref('giftVouchers/own'),{storeId:'mayla-1',saleId:'foreign'}));
 await assert.rejects(writer.updateDoc(ref('sales/own'),{layawayId:'foreign'}));
 await assert.rejects(writer.setDoc(ref('financialRecords/own'),{storeId:'mayla-1',relatedRecordId:'foreign'}));
 assert.equal(writes.length,0);assert.equal(records.get('giftVouchers/foreign').currentValue,100);
}));

test('financial audit validates source ownership and both snapshots, including historical snapshots without companyId',()=>withWriter(async({createTenantWriter,records,writes,assertTenantData})=>{
 const writer=createTenantWriter({},scope);
 const foreign={storeId:'metro',companyId:'bombon',description:'Información ajena',amount:100};
 records.set('financialRecords/foreign',foreign);
 await assert.rejects(writer.setDoc(ref('financialRecordsHistory/log'),{storeId:'mayla-1',recordId:'foreign',previousState:foreign}));
 await assert.rejects(writer.setDoc(ref('financialRecordsHistory/log'),{storeId:'mayla-1',recordId:'foreign',previousState:{storeId:'mayla-1',amount:100}}));
 assert.throws(()=>assertTenantData('financialRecordsHistory',{storeId:'mayla-1',previousState:{storeId:'metro',amount:100}},scope));
 assert.throws(()=>assertTenantData('financialRecordsHistory',{storeId:'mayla-1',newState:foreign},scope));
 assert.equal(writes.length,0);
 // An owned historical deletion remains restorable after its source was deleted.
 const owned={storeId:'mayla-1',amount:100};
 await writer.setDoc(ref('financialRecordsHistory/valid'),{storeId:'mayla-1',recordId:'deleted-own',previousState:owned});
 assert.equal(records.get('financialRecordsHistory/valid').companyId,'mayla');
}));

test('financial batches share reads for mirrors/history and rejected audit prevents all changes',()=>withWriter(async({createTenantWriter,records,reads,writes})=>{
 const writer=createTenantWriter({},scope);records.set('financialRecords/own',{storeId:'mayla-1',amount:20});
 const bad=writer.writeBatch();bad.update(ref('financialRecords/own'),{amount:40});bad.set(ref('financialRecordsHistory/log'),{storeId:'mayla-1',recordId:'own',previousState:{storeId:'metro',amount:20}});
 await assert.rejects(bad.commit());assert.equal(writes.length,0);assert.equal(records.get('financialRecords/own').amount,20);
 reads.length=0;const good=writer.writeBatch();
 for(const id of ['a','b','ha','hb'])writer.registerNew(ref((id.startsWith('h')?'financialRecordsHistory/':'financialRecords/')+id));
 good.set(ref('financialRecords/a'),{storeId:'mayla-1',relatedRecordId:'b'});good.set(ref('financialRecords/b'),{storeId:'mayla-2',relatedRecordId:'a'});
 good.set(ref('financialRecordsHistory/ha'),{storeId:'mayla-1',recordId:'a',newState:{storeId:'mayla-1',relatedRecordId:'b'}});
 good.set(ref('financialRecordsHistory/hb'),{storeId:'mayla-2',recordId:'b',newState:{storeId:'mayla-2',relatedRecordId:'a'}});
 await good.commit();assert.equal(reads.length,0);assert.equal(records.get('financialRecordsHistory/hb').companyId,'mayla');
}));


test('inventory counts, purchases and transfers reject products from another own-company store',()=>withWriter(async({createTenantWriter,records,writes})=>{
 const writer=createTenantWriter({},scope);
 records.set('inventory/other-store',{companyId:'mayla',storeId:'mayla-2',categoryId:'c',stock:10});
 records.set('categories/c',{companyId:'mayla',name:'Propia'});
 for(const collection of ['purchases','productHistory','stockTakes','pendingDetailedVerifications','detailedVerificationHistory','tagScanningSessions']){
  const data={storeId:'mayla-1',categoryId:'c'};
  if(['purchases','productHistory'].includes(collection)) data.productId='other-store';
  else data[collection==='tagScanningSessions'?'scannedCounts':'counts']={'other-store':2};
  await assert.rejects(writer.setDoc(ref(collection+'/test'),data));
 }
 await assert.rejects(writer.setDoc(ref('inventoryTransfers/test'),{fromStoreId:'mayla-1',toStoreId:'mayla-2',productId:'other-store'}));
 assert.equal(writes.length,0);assert.equal(records.get('inventory/other-store').stock,10);
}));

test('category count references and dotted tag scan updates cannot link foreign records',()=>withWriter(async({createTenantWriter,records,writes})=>{
 const writer=createTenantWriter({},scope);
 records.set('categories/foreign',{companyId:'bombon',name:'Ajena'});
 records.set('inventory/foreign',{companyId:'bombon',storeId:'metro',stock:9});
 records.set('tagScanningSessions/active',{companyId:'mayla',storeId:'mayla-1',scannedCounts:{}});
 await assert.rejects(writer.setDoc(ref('stockTakes/test'),{storeId:'mayla-1',verification:[{categoryId:'foreign'}]}));
 await assert.rejects(writer.updateDoc(ref('tagScanningSessions/active'),{'scannedCounts.foreign':1}));
 await assert.rejects(writer.updateDoc(ref('tagScanningSessions/active'),{scanHistory:[{productId:'foreign'}]}));
 assert.equal(writes.length,0);
}));

test('legacy category repair verifies actual store ownership and rejects categories from another new company',()=>withWriter(async({isolateLegacyCategoryForStore,records,writes})=>{
 records.set('stores/metro',{companyId:'default_company'});
 records.set('stores/mayla-1',{companyId:'mayla'});
 records.set('categories/legacy',{name:'Blusas'});
 records.set('categories/foreign',{name:'Secreto',companyId:'other'});
 records.set('inventory/legacy',{storeId:'metro',categoryId:'legacy',stock:12});
 await assert.rejects(isolateLegacyCategoryForStore({},'mayla','metro','legacy',['legacy']));
 await assert.rejects(isolateLegacyCategoryForStore({},'mayla','mayla-1','foreign',['legacy']));
 assert.equal(writes.length,0);assert.equal(records.get('inventory/legacy').stock,12);
}));

test('legacy repair only relinks eligible own-store products and preserves stock, source and historical records',()=>withWriter(async({isolateLegacyCategoryForStore,records})=>{
 records.set('stores/mayla-1',{companyId:'mayla'});
 records.set('categories/legacy',{name:'Blusas'});
 records.set('inventory/own',{storeId:'mayla-1',categoryId:'legacy',stock:12});
 records.set('inventory/foreign',{companyId:'other',storeId:'mayla-1',categoryId:'legacy',stock:7});
 records.set('stockTakes/history',{storeId:'mayla-1',verification:[{categoryId:'legacy',physicalCount:12}]});
 const history=JSON.stringify(records.get('stockTakes/history'));
 await isolateLegacyCategoryForStore({},'mayla','mayla-1','legacy',['own','foreign']);
 assert.equal(records.get('inventory/own').companyId,'mayla');assert.equal(records.get('inventory/own').stock,12);
 assert.equal(records.get('inventory/foreign').categoryId,'legacy');assert.equal(records.get('categories/legacy').companyId,undefined);
 assert.equal(JSON.stringify(records.get('stockTakes/history')),history);
}));


test('scanning one new product validates only changed links rather than rereading the entire session',()=>withWriter(async({createTenantWriter,records,reads})=>{
 const writer=createTenantWriter({},scope);
 const history=Array.from({length:100},(_,i)=>({id:'s'+i,productId:'p'+i}));
 records.set('tagScanningSessions/active',{companyId:'mayla',storeId:'mayla-1',scannedCounts:Object.fromEntries(history.map(s=>[s.productId,1])),scanHistory:history});
 records.set('inventory/new',{companyId:'mayla',storeId:'mayla-1'});
 await writer.updateDoc(ref('tagScanningSessions/active'),{'scannedCounts.new':1,scanHistory:[{id:'new',productId:'new'},...history].slice(0,100)});
 assert.deepEqual(reads,['tagScanningSessions/active','inventory/new']);
}));


test('permission resolution rejects borrowed company roles, contradictory stores and disabled accounts',()=>withWriter(async({resolveTenantRole,tenantPermissions,View})=>{
 const stores=[{id:'m',companyId:'mayla'},{id:'b',companyId:'default_company'}];
 const roles=[{id:'own',companyId:'mayla',name:'Admin',permissions:[View.POS,View.SETTINGS]},{id:'legacy',name:'Administrator',permissions:[View.ROLE_MANAGER]}];
 const user={id:'u',storeId:'m',companyId:'mayla',roleId:'own'};
 assert.deepEqual(tenantPermissions(user,roles,stores),[View.POS,View.SETTINGS]);
 assert.deepEqual(tenantPermissions(user,roles,stores,[View.POS]),[View.POS]);
 for(const change of [{roleId:'legacy'},{storeId:'b'},{isDisabled:true}])assert.equal(resolveTenantRole({...user,...change},roles,stores),undefined);
 assert.ok(resolveTenantRole({id:'u',storeId:'b',roleId:'legacy'},roles,stores));
}));

test('user/customer writes validate the actual store document and prevent platform privileges hidden inside an own-company role',()=>withWriter(async({createTenantWriter,records,writes,View})=>{
 const writer=createTenantWriter({},scope);
 records.set('stores/mayla-1',{companyId:'other'});
 records.set('roles/hidden',{companyId:'mayla',name:'Vendedor',permissions:[View.DEVELOPER_CENTER]});
 for(const name of ['sellers','customers'])await assert.rejects(writer.setDoc(ref(name+'/new'),{storeId:'mayla-1',name:'Cuenta'}));
 records.set('stores/mayla-1',{companyId:'mayla'});
 await assert.rejects(writer.setDoc(ref('sellers/new'),{storeId:'mayla-1',roleId:'hidden'}));
 await assert.rejects(writer.setDoc(ref('roles/new'),{name:'Vendedor',permissions:[View.DEVELOPER_CENTER]}));
 assert.equal(writes.length,0);
}));


test('legacy role cloning preserves company permissions but cannot carry platform access into another company',()=>withWriter(async({ensureCompanyRole,records,View})=>{
 records.set('roles/legacy-admin',{name:'Administrator',permissions:[View.POS,View.DEVELOPER_CENTER]});
 const id=await ensureCompanyRole({},'legacy-admin','mayla');
 assert.deepEqual(records.get('roles/'+id).permissions,[View.POS]);
 assert.deepEqual(records.get('roles/legacy-admin').permissions,[View.POS,View.DEVELOPER_CENTER]);
 records.set('roles/platform',{name:'Developer',permissions:[]});
 await assert.rejects(ensureCompanyRole({},'platform','mayla'));
}));

test('incidents reject foreign exchange products and original sales atomically',()=>withWriter(async({createTenantWriter,records,writes,reads})=>{
 const writer=createTenantWriter({},scope);
 records.set('inventory/own',{storeId:'mayla-1',companyId:'mayla',stock:5});
 records.set('inventory/foreign',{storeId:'metro',companyId:'bombon',stock:8});
 records.set('sales/foreign',{storeId:'metro',companyId:'bombon'});
 const incident={storeId:'mayla-1',type:'Cambio de Producto',returnedItems:[{productId:'own',quantity:1}],takenItems:[{productId:'foreign',quantity:1}]};
 const batch=writer.writeBatch();batch.update(ref('inventory/own'),{stock:6});batch.set(ref('incidents/new'),incident);
 await assert.rejects(batch.commit());assert.equal(writes.length,0);assert.equal(records.get('inventory/own').stock,5);
 await assert.rejects(writer.setDoc(ref('incidents/new'),{...incident,takenItems:[],originalSaleId:'foreign'}));
 assert.equal(writes.length,0);
}));

test('incident links respect source store, allow own-company transfers and reuse product reads',()=>withWriter(async({createTenantWriter,records,reads})=>{
 const writer=createTenantWriter({},scope);
 records.set('inventory/own',{storeId:'mayla-1',companyId:'mayla'});
 records.set('inventory/other-store',{storeId:'mayla-2',companyId:'mayla'});
 records.set('sales/other-store',{storeId:'mayla-2',companyId:'mayla'});
 await assert.rejects(writer.setDoc(ref('incidents/warranty'),{storeId:'mayla-1',productId:'other-store'}));
 await assert.rejects(writer.setDoc(ref('incidents/exchange'),{storeId:'mayla-1',originalSaleId:'other-store'}));
 await writer.setDoc(ref('incidents/transfer'),{storeId:'mayla-2',type:'Solicitud de Traslado',fromStoreId:'mayla-1',toStoreId:'mayla-2',productId:'own'});
 reads.length=0;
 await writer.setDoc(ref('incidents/exchange'),{storeId:'mayla-1',returnedItems:[{productId:'own'}],takenItems:[{productId:'own'}]});
 assert.equal(reads.filter(path=>path==='inventory/own').length,1);
}));
