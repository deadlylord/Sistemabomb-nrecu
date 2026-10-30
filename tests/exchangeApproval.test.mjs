import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build, transform } from 'esbuild';
const source = await readFile('components/App.tsx', 'utf8');
const code = (await transform(source.slice(source.indexOf('  const handleApproveIncident ='), source.indexOf('  const handleResolveIncident =')), {loader:'ts'})).code;
const tenantSource = await readFile('services/tenantWrites.ts', 'utf8');
const validator = tenantSource.slice(tenantSource.indexOf('export function assertTenantData'), tenantSource.indexOf('type Operation ='));
const b = await build({stdin:{contents:`import {DEFAULT_COMPANY_ID,IncidentType} from './types'; export {IncidentType,IncidentStatus,ProductChangeType} from './types'; ${validator}`,loader:'ts',resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const types = await import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64'));
function fixture() {
 const {IncidentType:T, IncidentStatus:S} = types;
 const saved = new Map(Object.entries({
  'incidents/change':{id:'change',companyId:'a',storeId:'a1',type:T.PRODUCT_EXCHANGE,status:S.CAMBIO_SOLICITADO,originalSaleId:'sale',originalSaleInvoiceNumber:2962,returnedItems:[{productId:'old',quantity:1,productName:'Old'}],takenItems:[{productId:'new',quantity:1,productName:'New',price:10,cost:5}]},
  'inventory/new':{id:'new',companyId:'a',storeId:'a1',stock:4},
  'inventory/old':{id:'old',companyId:'a',storeId:'a1',stock:1},
  'sales/sale':{id:'sale',companyId:'a',storeId:'a1',items:[{id:'old',quantity:1,price:10},{id:'unrelated',quantity:2,price:20}],totalAmount:50}
 }));
 const versions = new Map(); let serial=0, commits=0, attempts=0, fail=false, afterRead;
 const context={}; const scope={...types,operationContextRef:{current:context},contextAtRender:context,recordReadOnly:false,isAdmin:true,isDeveloper:false,operationalCompanyId:'a',currentStoreId:'a1',currentUser:{name:'Carlos'},incidents:[structuredClone(saved.get('incidents/change'))],db:{},increment:n=>({delta:n}),collection:(_,name)=>({name}),doc:(...args)=>{const path=args.length===1?args[0].name+'/'+(++serial):args[1]+'/'+args[2];return{path,id:path.split('/').at(-1)};},alerts:[],alert:m=>scope.alerts.push(m),console:{error(){}},runTransaction:async(_,callback)=>{
  for(let retry=0;retry<6;retry++) {
   attempts++;const reads=new Map(),ops=[];
   await callback({get:async ref=>{assert.equal(ops.length,0,'read all documents before writes');const value=structuredClone(saved.get(ref.path));reads.set(ref.path,versions.get(ref.path)||0);afterRead?.(ref.path);return{exists:()=>!!value,data:()=>value};},update:(ref,data)=>ops.push({ref,data,update:true}),set:(ref,data)=>ops.push({ref,data})});
   if([...reads].some(([path,v])=>(versions.get(path)||0)!==v))continue;
   if(fail)throw Error('Simulated network failure');
   if(ops.length)commits++;
   for(const {ref,data,update} of ops){const value=update?{...saved.get(ref.path)}:{};for(const[k,v]of Object.entries(data))value[k]=v&&typeof v==='object'&&'delta'in v?(value[k]||0)+v.delta:v;saved.set(ref.path,value);versions.set(ref.path,(versions.get(ref.path)||0)+1);}
   return;
  }
  throw Error('Too many conflicts');
 }};
 const approve = new Function('scope',`with(scope){${code};return handleApproveIncident;}`)(scope);
 return {saved,scope,approve:()=>approve('change'),get commits(){return commits},get attempts(){return attempts},set fail(value){fail=value},set afterRead(value){afterRead=value},logs:()=>[...saved].filter(([path])=>path.startsWith('productHistory/')).map(([,row])=>row)};
}
test('two devices approving the same change apply inventory, original sale and history exactly once',async()=>{
 const f=fixture();await Promise.all([f.approve(),f.approve()]);
 assert.equal(f.commits,1);assert.ok(f.attempts>=3,'second device retries after conflict');
 assert.equal(f.saved.get('inventory/new').stock,3);assert.equal(f.saved.get('inventory/old').stock,2);
 const sale=f.saved.get('sales/sale');assert.equal(sale.items.find(i=>i.id==='new').quantity,1);assert.equal(sale.items.find(i=>i.id==='unrelated').quantity,2);assert.equal(sale.items.some(i=>i.id==='old'),false);
 assert.equal(f.logs().length,2);assert.equal(f.saved.get('incidents/change').history.length,1);
 await f.approve();assert.equal(f.commits,1,'late stale UI/retry remains idempotent');
});
test('a persisted processed change is a no-op even while the screen still shows pending',async()=>{
 const f=fixture();f.saved.get('incidents/change').status=types.IncidentStatus.CAMBIO_PROCESADO;await f.approve();assert.equal(f.commits,0);
});
for(const target of ['incidents/change','inventory/new','sales/sale'])test(`foreign company or store in ${target} blocks every write`,async()=>{
 for(const fields of [{companyId:'b'},{storeId:'a2'}]){const f=fixture();Object.assign(f.saved.get(target),fields);await f.approve();assert.equal(f.commits,0);assert.ok(f.scope.alerts.length);}
});
test('invalid quantity and insufficient stock cannot partially return the old garment',async()=>{
 for(const mutate of [f=>f.saved.get('incidents/change').takenItems[0].quantity=0,f=>f.saved.get('inventory/new').stock=0]){
  const f=fixture();mutate(f);await f.approve();assert.equal(f.commits,0);assert.equal(f.saved.get('inventory/old').stock,1);assert.equal(f.logs().length,0);assert.ok(f.scope.alerts.length);
 }
});
test('failure writes nothing and a later retry processes once',async()=>{
 const f=fixture();f.fail=true;await f.approve();assert.equal(f.commits,0);f.fail=false;await f.approve();assert.equal(f.commits,1);assert.equal(f.logs().length,2);
});
test('permission denial and switching context while reading cannot approve an old screen',async()=>{
 for(const mode of ['read-only','seller','context']){
  const f=fixture();if(mode==='read-only')f.scope.recordReadOnly=true;else if(mode==='seller')f.scope.isAdmin=false;else f.afterRead=()=>{f.scope.operationContextRef.current={};};
  await f.approve();assert.equal(f.commits,0);assert.ok(f.scope.alerts.length);
 }
});
