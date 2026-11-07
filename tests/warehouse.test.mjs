import test from 'node:test';
import assert from 'node:assert/strict';
import { warehouseOperation } from '../functions/src/warehouse.mjs';
import { identityUid } from '../functions/src/stagingUsers.mjs';
function fixture() {
 const rows=new Map(Object.entries({
 'sellers/u':{name:'Vendedora',companyId:'co',storeId:'st',roleId:'seller',authVersion:1},
 'roles/seller':{companyId:'co',userType:'seller',permissions:['pos']},
 'companies/co':{status:'active'}, 'stores/st':{companyId:'co'}, 'stores/other':{companyId:'co'},
 'inventory/p':{companyId:'co',storeId:'st',name:'Blusa',stock:10,categoryId:'cat',supplier:'Marca'}
 }));
 const snapshot=(path)=>({id:path.split('/').at(-1),exists:rows.has(path),data:()=>rows.get(path)});
 class Ref { constructor(path){this.path=path;this.id=path.split('/').at(-1)} collection(n){return new Query(this.path+'/'+n)} }
 class Query {
   constructor(path, filter = null, cursor = '', max = Infinity, ordering = null) { Object.assign(this, { path, filter, cursor, max, ordering }); }
   doc(id) { return new Ref(this.path + '/' + id); }
   where(k, op, v) { return new Query(this.path, [k, op, v], this.cursor, this.max, this.ordering); }
   orderBy(k, direction) { return new Query(this.path, this.filter, this.cursor, this.max, [k, direction]); }
   limit(max) { return new Query(this.path, this.filter, this.cursor, max, this.ordering); }
   startAfter(s) { return new Query(this.path, this.filter, s.id, this.max, this.ordering); }
   async get() {
     const docs = [...rows.keys()].filter(p => p.startsWith(this.path + '/') && !p.slice(this.path.length + 1).includes('/')).map(snapshot);
     const match = doc => !this.filter || (this.filter[1] === '==' ? doc.data()[this.filter[0]] === this.filter[2] : doc.data()[this.filter[0]] >= this.filter[2]);
     const compare = (a, b) => this.ordering
       ? String(b.data()[this.ordering[0]]).localeCompare(String(a.data()[this.ordering[0]])) || b.id.localeCompare(a.id)
       : a.id.localeCompare(b.id);
     const ordered = docs.filter(match).sort(compare);
     return { docs: ordered.slice(this.cursor ? ordered.findIndex(doc => doc.id === this.cursor) + 1 : 0).slice(0, this.max) };
   }
 }
 Ref.prototype.get=async function(){return snapshot(this.path)};
 let queue=Promise.resolve();
 const db={collection:n=>new Query(n),runTransaction:fn=>{const task=queue.then(async()=>{let writing=false;const writes=[];const tx={get:async ref=>{assert.equal(writing,false,'all transaction reads precede writes');return snapshot(ref.path)},set:(ref,data)=>{writing=true;writes.push(['set',ref.path,data])},update:(ref,data)=>{writing=true;writes.push(['update',ref.path,data])},create:(ref,data)=>{writing=true;writes.push(['create',ref.path,data])}};const result=await fn(tx);for(const [op,path,data]of writes){if(op==='create')assert.equal(rows.has(path),false);if(op==='update')assert.equal(rows.has(path),true);rows.set(path,op==='update'?{...rows.get(path),...data}:data)}return result});queue=task.catch(()=>{});return task}};
 const auth={uid:identityUid('u'),token:{identityVersion:1,sellerId:'u',companyId:'co',storeId:'st',roleId:'seller',authVersion:1}};
 const call=data=>warehouseOperation(db,auth,{companyId:'co',storeId:'st',...data});
 const input=(id='one',n=4)=>({action:'move',operationId:id,productId:'p',direction:'toWarehouse',quantity:n,note:'Guardar'});
 return {rows,db,auth,call,input,root:'warehouseCompanies/co/stores/st'};
}
test('seller can move both directions; category summary, immutable history and company total stay consistent',async()=>{
 const f=fixture();await f.call(f.input());assert.equal(f.rows.get('inventory/p').stock,6);assert.equal(f.rows.get(f.root+'/products/p').stock,4);assert.equal(f.rows.get(f.root+'/categories/cat').stock,4);
 await f.call({...f.input('two',2),direction:'toStore'});assert.equal(f.rows.get('inventory/p').stock,8);assert.equal(f.rows.get(f.root+'/products/p').stock,2);
 await assert.rejects(f.call({action:'history'}), /administrador/);
 await assert.rejects(f.call({action:'counts'}), /administrador/);
 f.rows.get('roles/seller').userType='admin';
 const history=await f.call({action:'history'});assert.equal(history.rows.length,2);assert.equal(history.rows[0].actorName,'Vendedora');const publicLog=f.rows.get('productHistory/warehouse_one');assert.equal(publicLog.stockDelta,-4);assert.equal(publicLog.changedBy,'Sistema');assert.equal(publicLog.warehouseMovementId,undefined);assert.equal(publicLog.note,undefined);assert.doesNotMatch(publicLog.details,/Guardar/);assert.equal([...f.rows.keys()].filter(k=>k.startsWith('productHistory/')).length,2);
});
test('concurrent duplicate operation and lost acknowledgement apply inventory once',async()=>{const f=fixture();await Promise.all([f.call(f.input()),f.call(f.input())]);await f.call(f.input());assert.equal(f.rows.get('inventory/p').stock,6);assert.equal([...f.rows.keys()].filter(k=>k.startsWith(f.root+'/movements/')).length,1);await assert.rejects(f.call(f.input('one',3)),/otros datos/)});
test('concurrent independent operations cannot spend the same stock twice',async()=>{const f=fixture();const result=await Promise.allSettled([f.call(f.input('one',7)),f.call(f.input('two',7))]);assert.equal(result.filter(x=>x.status==='fulfilled').length,1);assert.equal(f.rows.get('inventory/p').stock,3)});
test('invalid stock, negative/fractional amounts and cross-company/store attempts cannot write',async()=>{
 for(const change of [{quantity:0},{quantity:-1},{quantity:1.5},{quantity:11},{storeId:'other'},{companyId:'foreign'},{productId:'other'},{direction:'wrong'}]){const f=fixture();const before=JSON.stringify([...f.rows]);await assert.rejects(f.call({...f.input(),...change}));assert.equal(JSON.stringify([...f.rows]),before)}
 for(const mode of ['disabled','revoked','roleCompany','productCompany','expired']){const f=fixture();if(mode==='disabled')f.rows.get('sellers/u').isDisabled=true;if(mode==='revoked')f.rows.get('roles/seller').permissions=[];if(mode==='roleCompany')f.rows.get('roles/seller').companyId='foreign';if(mode==='productCompany')f.rows.get('inventory/p').companyId='foreign';if(mode==='expired')f.auth.token.authVersion=0;await assert.rejects(f.call(f.input()));assert.equal(f.rows.get('inventory/p').stock,10)}
});
test('category count records differences without inventing product adjustments, blocks stale revisions',async()=>{const f=fixture();await f.call(f.input());const entries=[{categoryId:'cat',revision:1,physicalCount:3}];await f.call({action:'count',operationId:'count',entries,productCounts:{p:3}});assert.equal(f.rows.get(f.root+'/products/p').stock,4);f.rows.get('roles/seller').userType='admin';const counts=await f.call({action:'counts'});assert.equal(counts.rows[0].verification[0].difference,-1);assert.equal(counts.rows[0].isApplied,false);await f.call(f.input('next',1));await assert.rejects(f.call({action:'count',operationId:'stale',entries}),/movimientos/)});
test('warehouse drafts are separate and cannot reference other product/category scopes',async()=>{const f=fixture();await f.call(f.input());await f.call({action:'draftSave',operationId:'draft',entries:[{categoryId:'cat',revision:1,physicalCount:4}],productCounts:{p:4}});assert.equal((await f.call({action:'draft',categoryId:'cat'})).draft.productCounts.p,4);await assert.rejects(f.call({action:'count',operationId:'bad',entries:[{categoryId:'cat',revision:1,physicalCount:4}],productCounts:{foreign:1}}));assert.equal([...f.rows.keys()].some(k=>k.startsWith('stockTakes/')),false)});
test('only administrator can reverse once; reversal is linked and does not erase audit',async()=>{const f=fixture();const saved=await f.call(f.input());await assert.rejects(f.call({action:'reverse',operationId:'reverse',movementId:saved.id}));f.rows.get('roles/seller').userType='admin';await f.call({action:'reverse',operationId:'reverse',movementId:saved.id});assert.equal(f.rows.get('inventory/p').stock,10);assert.equal(f.rows.get(f.root+'/products/p').stock,0);assert.equal((await f.call({action:'history'})).rows.length,2);await assert.rejects(f.call({action:'reverse',operationId:'again',movementId:saved.id}));});
test('movement history pages 25 records and excludes older or other-store movements', async () => {
 const f = fixture();
 for (let i = 0; i < 27; i++) await f.call({ ...f.input('operation_' + i, 1), direction: i % 2 ? 'toStore' : 'toWarehouse' });
 f.rows.get('roles/seller').userType = 'admin';
 f.rows.set(f.root + '/movements/old', { createdAt: new Date(Date.now() - 31 * 86400000).toISOString() });
 f.rows.set('warehouseCompanies/co/stores/other/movements/new', { createdAt: new Date().toISOString() });
 const first = await f.call({ action: 'history' });
 assert.equal(first.rows.length, 25);
 assert.ok(first.cursor);
 const last = await f.call({ action: 'history', cursor: first.cursor });
 assert.equal(last.rows.length, 2);
 assert.equal(last.cursor, null);
 const ids = new Set([...first.rows, ...last.rows].map(row => row.id));
 assert.equal(ids.size, 27);
 assert.ok(!ids.has('old') && !ids.has('new'));
});
test('administrator settings disable normal sends but allow returns and receipt retries', async () => {
 const f = fixture();
 await f.call(f.input());
 const settings = { action: 'settings', sendEnabled: false, categoryVisible: true };
 await assert.rejects(f.call(settings), /administrador/);
 f.rows.get('roles/seller').userType = 'admin';
 await f.call(settings);
 assert.equal(f.rows.get('stores/st').warehouseSendEnabled, false);
 assert.equal(f.rows.get('stores/st').warehouseCategoryVisible, true);
 assert.equal(f.rows.get('stores/other').warehouseSendEnabled, undefined);
 await f.call(f.input());
 await assert.rejects(f.call(f.input('blocked')), /desactivado/);
 await f.call({ ...f.input('back'), direction: 'toStore' });
 assert.equal(f.rows.get('inventory/p').stock, 10);
});
test('purchase transfer is atomic, scoped, aggregated by category and idempotent', async () => {
 const f = fixture();
 f.rows.get('roles/seller').permissions.push('purchases');
 f.rows.set('inventory/q', { ...f.rows.get('inventory/p'), name: 'Pantalón', stock: 1 });
 f.rows.set('purchases/a', { companyId: 'co', storeId: 'st', productId: 'p', quantity: 4 });
 f.rows.set('purchases/b', { companyId: 'co', storeId: 'st', productId: 'q', quantity: 3 });
 f.rows.set('purchases/foreign', { companyId: 'co', storeId: 'other', productId: 'q', quantity: 3 });
 const request = { action: 'purchaseMove', operationId: 'batch', entries: [{ purchaseId: 'a', quantity: 4 }, { purchaseId: 'b', quantity: 2 }] };
 await assert.rejects(f.call({ ...request, entries: [...request.entries, { purchaseId: 'foreign', quantity: 1 }] }), /sede/);
 await assert.rejects(f.call(request), /No hay existencias suficientes/);
 assert.equal(f.rows.get('inventory/p').stock, 10);
 assert.equal(f.rows.get(f.root + '/purchaseDispatches/a'), undefined);
 f.rows.get('inventory/q').stock = 5;
 const [first, duplicate] = await Promise.all([f.call(request), f.call(request)]);
 assert.deepEqual(first, duplicate);
 assert.deepEqual(first.purchaseIds, ['a', 'b']);
 assert.equal(f.rows.get('inventory/p').stock, 6);
 assert.equal(f.rows.get('inventory/q').stock, 3);
 assert.equal(f.rows.get(f.root + '/categories/cat').stock, 6);
 assert.equal(f.rows.get(f.root + '/categories/cat').revision, 1);
 assert.equal(f.rows.get('purchases/a').quantity, 4);
 await assert.rejects(f.call({ ...request, operationId: 'another' }), /ya fue enviada/);
});
test('only explicit administrator detailed adjustment updates warehouse products; store counts stay untouched',async()=>{const f=fixture();await f.call(f.input());const request={action:'adjust',operationId:'adjust',entries:[{categoryId:'cat',revision:1,physicalCount:3}],productCounts:{p:3}};await assert.rejects(f.call(request));f.rows.get('roles/seller').userType='admin';await f.call(request);assert.equal(f.rows.get(f.root+'/products/p').stock,3);assert.equal(f.rows.get('inventory/p').stock,6);const saved=(await f.call({action:'counts'})).rows[0];assert.equal(saved.isApplied,true);assert.deepEqual(saved.productAdjustments,[{productId:'p',categoryId:'cat',before:4,after:3}]);});
test('warehouse mirror preserves owned units, permits reclassification only after emptying warehouse',async()=>{const f=fixture();await f.call(f.input());assert.equal(f.rows.get('inventory/p').warehouseUnits,4);f.rows.get('inventory/p').categoryId='new';await assert.rejects(f.call(f.input('blocked',1)),/categoría/);f.rows.get('inventory/p').categoryId='cat';await f.call({...f.input('return',4),direction:'toStore'});assert.equal(f.rows.get('inventory/p').warehouseUnits,0);f.rows.get('inventory/p').categoryId='new';await f.call(f.input('new',2));assert.equal(f.rows.get(f.root+'/categories/new').stock,2);assert.equal(f.rows.get(f.root+'/categories/cat').stock,0);assert.equal(f.rows.get('inventory/p').stock+f.rows.get('inventory/p').warehouseUnits,10);});
test('inconsistent warehouse mirror cannot be spent or adjusted silently',async()=>{const f=fixture();await f.call(f.input());f.rows.get('inventory/p').warehouseUnits=1;await assert.rejects(f.call(f.input('broken',1)),/enlazadas/);});
