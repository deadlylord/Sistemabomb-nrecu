import test from 'node:test';
import assert from 'node:assert/strict';
import {approveTransferRequest} from '../functions/src/transferApproval.mjs';
import {identityUid} from '../functions/src/stagingUsers.mjs';

function fixture(stock=1) {
 const rows=new Map(Object.entries({
  'companies/co':{status:'active',allowedViews:['incidents']},
  'stores/creator':{companyId:'co',name:'Creator'},'stores/origin':{companyId:'co',name:'Origin'},'stores/destination':{companyId:'co',name:'Destination'},
  'roles/admin':{companyId:'co',userType:'admin',permissions:['incidents']},
  'sellers/u':{name:'Private Admin',companyId:'co',storeId:'creator',roleId:'admin',authVersion:1},
  'sellers/v':{name:'Second Admin',companyId:'co',storeId:'creator',roleId:'admin',authVersion:1},
  'categories/cat':{companyId:'co'},
  'inventory/source':{companyId:'co',storeId:'origin',categoryId:'cat',name:'PRIVATE_PRODUCT',stock,cost:5},
  'inventory/dest':{companyId:'co',storeId:'destination',categoryId:'cat',name:'PRIVATE_PRODUCT',stock:0,cost:5,isDisabled:true},
  'incidents/request':{companyId:'co',storeId:'creator',fromStoreId:'origin',toStoreId:'destination',productId:'source',quantity:1,type:'Solicitud de Traslado',status:'Traslado Solicitado',sellerName:'Private Seller',history:[]}
 }));
 const versions=new Map(),collectionVersions=new Map(),reads=[],queries=[];let commits=0,attempts=0,beforeCommit,failCommit=false,loseAck=false;
 const bump=path=>{versions.set(path,(versions.get(path)||0)+1);const collection=path.split('/')[0];collectionVersions.set(collection,(collectionVersions.get(collection)||0)+1);};
 const external=(path,data)=>{if(data===null)rows.delete(path);else rows.set(path,{...rows.get(path),...data});bump(path);};
 class Ref {constructor(path){this.path=path;this.id=path.split('/').at(-1)}}
 class Query {
  constructor(path,filters=[],max=Infinity){Object.assign(this,{path,filters,max});}
  doc(id){return new Ref(this.path+'/'+id)}
  where(field,op,value){assert.equal(op,'==');return new Query(this.path,[...this.filters,{field,value}],this.max)}
  limit(max){return new Query(this.path,this.filters,max)}
 }
 const snapshot=path=>{const value=structuredClone(rows.get(path));return {id:path.split('/').at(-1),ref:new Ref(path),exists:value!==undefined,data:()=>value};};
 const db={collection:name=>new Query(name),runTransaction:async callback=>{
  for(let retry=0;retry<10;retry++){
   attempts++;const readVersions=new Map(),queryVersions=new Map(),writes=[];
   const tx={get:async target=>{
    assert.equal(writes.length,0,'all reads must precede writes');
    if(target instanceof Query){
     queries.push({collection:target.path,filters:target.filters,max:target.max});queryVersions.set(target.path,collectionVersions.get(target.path)||0);
     const docs=[...rows.keys()].filter(path=>path.startsWith(target.path+'/')&&!path.slice(target.path.length+1).includes('/')).filter(path=>target.filters.every(f=>rows.get(path)[f.field]===f.value)).slice(0,target.max).map(path=>{readVersions.set(path,versions.get(path)||0);return snapshot(path)});
     await Promise.resolve();return {docs,empty:!docs.length};
    }
    reads.push(target.path);readVersions.set(target.path,versions.get(target.path)||0);const value=snapshot(target.path);await Promise.resolve();return value;
   },update:(ref,data)=>writes.push({kind:'update',ref,data}),create:(ref,data)=>writes.push({kind:'create',ref,data})};
   const result=await callback(tx);
   if(beforeCommit){const hook=beforeCommit;beforeCommit=null;hook();}
   if([...readVersions].some(([path,version])=>(versions.get(path)||0)!==version)||[...queryVersions].some(([path,version])=>(collectionVersions.get(path)||0)!==version))continue;
   if(failCommit)throw Error('simulated commit failure');
   // Validate every write before applying any of them, like an atomic commit.
   for(const op of writes){if(op.kind==='create')assert.equal(rows.has(op.ref.path),false,'create cannot overwrite a receipt/history');else assert.ok(rows.has(op.ref.path));}
   if(writes.length){commits++;for(const op of writes){rows.set(op.ref.path,op.kind==='create'?structuredClone(op.data):{...rows.get(op.ref.path),...structuredClone(op.data)});bump(op.ref.path);}if(loseAck){loseAck=false;throw Error('confirmation lost');}}
   return result;
  }
  throw Error('too many transaction conflicts');
 }};
 const auth=(sellerId='u')=>({uid:identityUid(sellerId),token:{identityVersion:1,sellerId,companyId:'co',storeId:'creator',roleId:'admin',authVersion:1}});
 const input={companyId:'co',storeId:'creator',incidentId:'request'};
 const call=(overrides={},identity=auth())=>approveTransferRequest(db,identity,{...input,...overrides});
 const logs=()=>[...rows].filter(([path])=>path.startsWith('productHistory/'));
 return {rows,db,reads,queries,auth,input,call,external,logs,get commits(){return commits},get attempts(){return attempts},set beforeCommit(fn){beforeCommit=fn},set failCommit(value){failCommit=value},set loseAck(value){loseAck=value}};
}
async function rejectsWithoutChanges(f,overrides={},auth=f.auth()){
 const before=structuredClone([...f.rows]);await assert.rejects(f.call(overrides,auth));assert.deepEqual([...f.rows],before);assert.equal(f.commits,0);
}

test('server approval uses scoped transactional query and writes one linked receipt and two deterministic histories',async()=>{
 const f=fixture(),result=await f.call();assert.deepEqual(result,{processed:true,alreadyProcessed:false});
 assert.equal(f.rows.get('inventory/source').stock,0);assert.equal(f.rows.get('inventory/dest').stock,1);assert.equal(f.rows.get('inventory/dest').isDisabled,false);
 assert.equal(f.rows.get('incidents/request').status,'Traslado Completado');assert.equal(f.rows.get('incidents/request').history.length,1);
 assert.equal(f.queries.length,1);assert.deepEqual(f.queries[0],{collection:'inventory',filters:[{field:'storeId',value:'destination'},{field:'name',value:'PRIVATE_PRODUCT'}],max:2});
 assert.equal(f.logs().length,2);assert.deepEqual(f.logs().map(([path])=>path).sort(),['productHistory/transfer_request_request_in','productHistory/transfer_request_request_out']);
 for(const[,log]of f.logs())assert.equal(log.transferId,'request_request');assert.equal(f.rows.get('inventoryTransfers/request_request').toProductId,'dest');
 assert.equal(f.reads.filter(path=>path==='stores/creator').length,1,'shared actor/store reads deduplicate');
});
test('two administrators concurrently approving the same request apply stock only once',async()=>{
 const f=fixture();const results=await Promise.all([f.call({},f.auth('u')),f.call({},f.auth('v'))]);
 assert.equal(f.commits,1);assert.ok(f.attempts>=3,'loser retries with fresh persisted status');assert.equal(results.filter(r=>r.alreadyProcessed).length,1);assert.equal(f.logs().length,2);assert.equal(f.rows.get('inventory/source').stock,0);assert.equal(f.rows.get('inventory/dest').stock,1);
});
test('lost confirmation recovers completed receipt without repeating stock or needing destination product',async()=>{
 const f=fixture();f.loseAck=true;await assert.rejects(f.call(),/confirmation lost/);const queryCount=f.queries.length;f.external('inventory/dest',null);
 assert.deepEqual(await f.call({},f.auth('v')),{processed:true,alreadyProcessed:true});assert.equal(f.commits,1);assert.equal(f.logs().length,2);assert.equal(f.queries.length,queryCount);
});
test('legacy completed request without deterministic receipt is a no-op',async()=>{
 const f=fixture();f.rows.get('incidents/request').status='Traslado Completado';assert.deepEqual(await f.call(),{processed:true,alreadyProcessed:true});assert.equal(f.commits,0);assert.equal(f.logs().length,0);assert.equal(f.queries.length,0);
});
test('pending request with an existing receipt rejects instead of guessing inventory impact',async()=>{
 const f=fixture();f.rows.set('inventoryTransfers/request_request',{companyId:'co',fromStoreId:'origin',toStoreId:'destination',productId:'source',quantity:1});await rejectsWithoutChanges(f);
});
test('forged or missing authentication cannot cause writes',async()=>{
 for(const mutate of [()=>null,a=>({...a,uid:'forged'}),a=>({...a,token:{...a.token,identityVersion:0}}),a=>({...a,token:{...a.token,authVersion:0}}),a=>({...a,token:{...a.token,companyId:'foreign'}}),a=>({...a,token:{...a.token,storeId:'destination'}})]){
  const f=fixture();await rejectsWithoutChanges(f,{},mutate(f.auth()));
 }
});
for(const [label,mutate]of [
 ['disabled seller',f=>f.rows.get('sellers/u').isDisabled=true],
 ['stale auth version',f=>f.rows.get('sellers/u').authVersion=2],
 ['disabled role',f=>f.rows.get('roles/admin').isDisabled=true],
 ['foreign role',f=>f.rows.get('roles/admin').companyId='foreign'],
 ['disabled company',f=>f.rows.get('companies/co').isDisabled=true],
 ['suspended company',f=>f.rows.get('companies/co').status='suspended'],
 ['blocked company module',f=>f.rows.get('companies/co').allowedViews=['pos']],
 ['missing incidents permission',f=>f.rows.get('roles/admin').permissions=['pos']],
 ['explicit seller with admin name/permissions',f=>Object.assign(f.rows.get('roles/admin'),{userType:'seller',name:'Administrador',permissions:['incidents','role_manager','ceo_center']})],
 ['unverified developer flag',f=>Object.assign(f.rows.get('sellers/u'),{platformRole:'developer'})]
])test(`${label} cannot approve`,async()=>{const f=fixture();if(label==='unverified developer flag')f.rows.get('roles/admin').userType='seller';mutate(f);await rejectsWithoutChanges(f);});
test('legacy admin role without userType remains compatible',async()=>{
 const f=fixture();delete f.rows.get('roles/admin').userType;f.rows.get('roles/admin').name='  ADMINISTRADOR ';await f.call();assert.equal(f.commits,1);
});
for(const [label,path,patch]of [
 ['foreign creator store','stores/creator',{companyId:'other'}],['foreign origin store','stores/origin',{companyId:'other'}],['foreign destination store','stores/destination',{companyId:'other'}],
 ['inactive destination','stores/destination',{status:'inactive'}],['disabled origin','stores/origin',{isDisabled:true}],
 ['foreign incident','incidents/request',{companyId:'other'}],['wrong creator','incidents/request',{storeId:'origin'}],
 ['foreign source product','inventory/source',{companyId:'other'}],['wrong source store','inventory/source',{storeId:'destination'}],['foreign destination product','inventory/dest',{companyId:'other'}],
 ['foreign category','categories/cat',{companyId:'other'}]
])test(`${label} rejects the entire operation`,async()=>{const f=fixture();Object.assign(f.rows.get(path),patch);await rejectsWithoutChanges(f);});
test('changing input tenant/store or providing forged inventory fields is rejected',async()=>{
 for(const patch of [{companyId:'other'},{storeId:'origin'},{quantity:100},{productId:'dest'},{incidentId:'../secret'}]){const f=fixture();await rejectsWithoutChanges(f,patch);}
});
test('missing categories or products and ambiguous destinations reject atomically',async()=>{
 for(const mode of ['category','source','destination','ambiguous']){const f=fixture();if(mode==='category')f.rows.delete('categories/cat');if(mode==='source')f.rows.delete('inventory/source');if(mode==='destination')f.rows.delete('inventory/dest');if(mode==='ambiguous')f.rows.set('inventory/dest2',{...f.rows.get('inventory/dest')});await rejectsWithoutChanges(f);}
});
test('legacy incident/products without companyId are accepted only via their authoritative own-company stores',async()=>{
 const f=fixture();for(const path of ['incidents/request','inventory/source','inventory/dest'])delete f.rows.get(path).companyId;await f.call();assert.equal(f.commits,1);assert.equal(f.rows.get('inventoryTransfers/request_request').companyId,'co');
 const bad=fixture();delete bad.rows.get('inventory/source').companyId;bad.rows.get('stores/origin').companyId='foreign';await rejectsWithoutChanges(bad);
});
test('invalid quantities, stock and cost never write partial data',async()=>{
 for(const qty of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,2]){const f=fixture();f.rows.get('incidents/request').quantity=qty;await rejectsWithoutChanges(f);}
 for(const [path,field,value]of [['inventory/source','stock',NaN],['inventory/source','stock',Infinity],['inventory/source','stock',-1],['inventory/source','cost',-1],['inventory/source','cost',NaN],['inventory/dest','stock',Infinity],['inventory/dest','stock',Number.MAX_SAFE_INTEGER]]){const f=fixture();f.rows.get(path)[field]=value;await rejectsWithoutChanges(f);}
});
test('same-store routes, bad status/type/history and unrelated exchange items are rejected',async()=>{
 for(const patch of [{toStoreId:'origin'},{status:'Rechazado'},{type:'Cambio de Producto'},{history:{}},{takenItems:[{productId:'source'}]}]){const f=fixture();Object.assign(f.rows.get('incidents/request'),patch);await rejectsWithoutChanges(f);}
});
test('foreign historical links are rejected and vanished historical links remain compatible',async()=>{
 const f=fixture();f.rows.get('incidents/request').originalSaleId='sale';f.rows.set('sales/sale',{companyId:'other',storeId:'creator'});await rejectsWithoutChanges(f);
 const legacy=fixture();legacy.rows.get('incidents/request').originalSaleId='vanished';await legacy.call();assert.equal(legacy.commits,1);
});
test('concurrent sale of last origin unit causes retry and rejection instead of negative stock',async()=>{
 const f=fixture();f.beforeCommit=()=>f.external('inventory/source',{stock:0});await assert.rejects(f.call());assert.equal(f.commits,0);assert.ok(f.attempts>=2);assert.equal(f.rows.get('inventory/source').stock,0);assert.equal(f.rows.get('inventory/dest').stock,0);assert.equal(f.logs().length,0);
});
test('concurrent destination sale is preserved by transaction-query retry',async()=>{
 const f=fixture();f.rows.get('inventory/dest').stock=1;f.beforeCommit=()=>f.external('inventory/dest',{stock:0});await f.call();assert.ok(f.attempts>=2);assert.equal(f.rows.get('inventory/dest').stock,1);assert.equal(f.rows.get('inventory/source').stock,0);assert.equal(f.commits,1);
});
test('a newly ambiguous destination before commit is detected on query retry',async()=>{
 const f=fixture();f.beforeCommit=()=>f.external('inventory/dest2',{...f.rows.get('inventory/dest')});await assert.rejects(f.call());assert.equal(f.commits,0);assert.ok(f.attempts>=2);assert.equal(f.rows.get('inventory/source').stock,1);
});
test('commit failure leaves stock, history and pending request unchanged; retry succeeds once',async()=>{
 const f=fixture();f.failCommit=true;await rejectsWithoutChanges(f);f.failCommit=false;await f.call();assert.equal(f.commits,1);assert.equal(f.logs().length,2);
});
test('diagnostics are opt-in, bounded metadata only, and never expose private document contents',async()=>{
 const a=fixture();assert.equal((await a.call()).diagnostics,undefined);
 const f=fixture();const result=await f.call({diagnostics:true});assert.equal(result.diagnostics.version,1);assert.equal(result.diagnostics.attempts,1);assert.ok(result.diagnostics.reads>0);assert.ok(Number.isFinite(result.diagnostics.totalMs));
 assert.deepEqual(Object.keys(result.diagnostics).sort(),['attempts','reads','totalMs','version']);for(const text of ['PRIVATE_PRODUCT','Private Admin','Private Seller','source','dest','request_request'])assert.ok(!JSON.stringify(result).includes(text));
});

test('live verified developer grant permits approval while forged, inactive or mismatched grants do not',async()=>{
 const validGrant={userId:'u',active:true,role:'developer',grantedBy:'-OYqLOlA2gyy_TrUtzf2'};
 const f=fixture();f.rows.get('roles/admin').userType='seller';f.rows.get('roles/admin').permissions=[];f.rows.set('platformDevelopers/u',validGrant);await f.call();assert.equal(f.commits,1);
 for(const patch of [{active:false},{userId:'other'},{grantedBy:'forged'},{role:'admin'}]){const bad=fixture();bad.rows.get('roles/admin').userType='seller';bad.rows.set('platformDevelopers/u',{...validGrant,...patch});await rejectsWithoutChanges(bad);}
});
test('administrator cannot cross company; verified developer can use explicitly validated target scope',async()=>{
 function targetCompany(f){
  f.rows.set('companies/target',{status:'active'});
  for(const storeId of ['targetCreator','targetOrigin','targetDestination'])f.rows.set('stores/'+storeId,{companyId:'target'});
  f.rows.set('categories/targetCat',{companyId:'target'});
  f.rows.set('inventory/targetSource',{companyId:'target',storeId:'targetOrigin',categoryId:'targetCat',name:'PRIVATE_OTHER_PRODUCT',stock:1,cost:5});
  f.rows.set('inventory/targetDest',{companyId:'target',storeId:'targetDestination',categoryId:'targetCat',name:'PRIVATE_OTHER_PRODUCT',stock:0,cost:5});
  f.rows.set('incidents/targetRequest',{companyId:'target',storeId:'targetCreator',fromStoreId:'targetOrigin',toStoreId:'targetDestination',productId:'targetSource',quantity:1,type:'Solicitud de Traslado',status:'Traslado Solicitado'});
  return {companyId:'target',storeId:'targetCreator',incidentId:'targetRequest'};
 }
 const ordinary=fixture();await rejectsWithoutChanges(ordinary,targetCompany(ordinary));
 const developer=fixture();const input=targetCompany(developer);developer.rows.set('platformDevelopers/u',{userId:'u',active:true,role:'developer',grantedBy:'-OYqLOlA2gyy_TrUtzf2'});await developer.call(input);
 assert.equal(developer.rows.get('inventory/targetSource').stock,0);assert.equal(developer.rows.get('inventory/targetDest').stock,1);assert.equal(developer.rows.get('inventory/source').stock,1);assert.equal(developer.rows.get('inventory/dest').stock,0);
});
test('quantity multiplied by unit cost must remain within safe finite bounds',async()=>{
 const f=fixture(2);f.rows.get('incidents/request').quantity=2;f.rows.get('inventory/source').cost=Number.MAX_SAFE_INTEGER;await rejectsWithoutChanges(f);
});

test('a valid 128-character incident ID still supports longer deterministic receipt and history IDs',async()=>{
 const f=fixture(),incidentId='x'.repeat(128);f.rows.set('incidents/'+incidentId,f.rows.get('incidents/request'));f.rows.delete('incidents/request');
 const result=await f.call({incidentId});assert.equal(result.processed,true);assert.equal(f.commits,1);assert.ok(f.rows.has('inventoryTransfers/request_'+incidentId));assert.ok(f.rows.has('productHistory/transfer_request_'+incidentId+'_out'));assert.ok(f.rows.has('productHistory/transfer_request_'+incidentId+'_in'));
});
