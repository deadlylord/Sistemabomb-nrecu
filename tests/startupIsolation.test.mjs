import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {developerSession,browserGlobals} from './helpers/developerSession.mjs';
import {measureStartup} from './helpers/measureStartup.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

async function session({permissions, username='admin', owner=false}={}) {
 const restore=browserGlobals(),m=await developerSession();let renderer;
 const {records,View}=m;
 const user={id:owner?m.PLATFORM_OWNER_USER_ID:'user',username,password:'test',name:'Admin',companyId:'A',storeId:'A0',roleId:'role'};
 records.set('companies',[{id:'A',name:'Company A',allowedViews:Object.values(View)}]);
 records.set('stores',[{id:'A0',name:'One',companyId:'A',accentColorsUpdated:true},{id:'A1',name:'Two',companyId:'A',accentColorsUpdated:true},{id:'B0',companyId:'B',accentColorsUpdated:true}]);
 records.set('roles',[{id:'role',name:'Administrator',userType:'admin',companyId:'A',permissions:permissions||Object.values(View).filter(v=>v!==View.DEVELOPER_CENTER)}]);
 records.set('sellers',[user,{id:'foreign',username:'different',password:'not-for-this-user',storeId:'B0',companyId:'B'}]);
 records.set('inventory',[{id:'A-zero',companyId:'A',storeId:'A0',stock:5},{id:'A-one',companyId:'A',storeId:'A1',stock:10},{id:'foreign-product',companyId:'B',storeId:'B0',stock:99}]);
 await act(async()=>{renderer=create(React.createElement(m.App))});
 return {...m,user,renderer,header:()=>renderer.root.findByType(m.Header),login:()=>renderer.root.findByProps({screen:'LoginView'}).props.onLogin(username,'test'),cleanup:async()=>{await act(async()=>renderer.unmount());await m.cleanup();restore()}};
}

test('pre-auth reads nothing and active POS inventory cost remains constant for 3, 50 and 1000 stores',async()=>{
 const samples=[];
 for(const size of [3,50,1000]){
  const sample=await measureStartup(size);samples.push(sample);
  assert.equal(sample.beforeLogin.total,0);assert.deepEqual(sample.beforeLogin.queries,[]);
  for(const phase of ['afterLogin','pos','secondStore','revisit','global'])assert.equal(sample[phase].listeners.inventory,1,`${phase}: only active inventory is live`);
  assert.equal(sample.afterLogin.inventoryConnections,1,'no inactive-store prefetch');
  assert.equal(sample.revisit.inventoryConnections,3,'revisit opens one fresh listener while using session cache');
  assert.equal(sample.afterLogin.listeners.stores,1);
  assert.ok(!sample.afterLogin.queries.some(q=>q.collection==='inventory'));
  assert.ok(sample.afterLogin.queries.filter(q=>q.collection==='sellers').every(q=>q.filters?.some(f=>f.field==='username'||f.field==='name')),'credential lookup is constrained');
  assert.equal(sample.global.queries.filter(q=>q.collection==='inventory').length,size,'global cost appears only after explicit activation');
 }
 assert.equal(new Set(samples.map(s=>s.afterLogin.total)).size,1);
 assert.equal(new Set(samples.map(s=>s.pos.total)).size,1);
});

test('cached A paints immediately on revisit, stays visibly synchronizing, and ignores late old callbacks',async()=>{
 const s=await session();try{
  await act(async()=>s.login());
  assert.equal(s.renderer.root.findByProps({screen:'PosView'}).props.inventory[0].stock,5);
  assert.ok(s.connections.filter(c=>!c.closed&&c.q.name==='stores').every(c=>c.q.id==='A0'),'startup reads only active store metadata');
  await act(async()=>s.header().props.onRequestStores());
  const old=s.connections.find(c=>!c.closed&&c.q.name==='inventory');
  s.control.pause=true;
  await act(async()=>s.header().props.onSwitchStore('A1'));
  assert.deepEqual(s.renderer.root.findByProps({screen:'PosView'}).props.inventory,[],'first visit never shows A');
  const b=s.connections.find(c=>!c.closed&&c.q.name==='inventory');
  await act(async()=>b.apply(s.snapshot(b.q)));
  assert.equal(s.renderer.root.findByProps({screen:'PosView'}).props.inventory[0].id,'A-one');
  await act(async()=>s.header().props.onSwitchStore('A0'));
  assert.ok(old.closed&&b.closed);
  assert.equal(s.renderer.root.findByProps({screen:'PosView'}).props.inventory[0].stock,5,'cached A precedes network response');
  assert.ok(s.renderer.root.findAllByProps({role:'status'}).some(n=>JSON.stringify(n.props.children).includes('Sincronizando inventario')));
  await act(async()=>old.apply({docs:[{id:'late',data:()=>({companyId:'A',storeId:'A0',stock:999})}]}));
  assert.equal(s.renderer.root.findByProps({screen:'PosView'}).props.inventory[0].stock,5);
  const active=s.connections.find(c=>!c.closed&&c.q.name==='inventory');
  await act(async()=>active.apply({metadata:{fromCache:false},docs:[{id:'fresh',data:()=>({companyId:'A',storeId:'A0',stock:7})}]}));
  assert.equal(s.renderer.root.findByProps({screen:'PosView'}).props.inventory[0].stock,7);
  assert.ok(!s.renderer.root.findAllByProps({role:'status'}).some(n=>JSON.stringify(n.props.children).includes('Sincronizando inventario')));
  await act(async()=>s.header().props.onLogout());
  assert.equal(s.getCachedStoreRows('inventory','A0','user:A'),undefined);
  assert.ok(s.connections.every(c=>c.closed));
 }finally{await s.cleanup()}
});

test('session cache isolates company, store, user and data type; expires and evicts excessive data',async()=>{
 const m=await developerSession();const now=Date.now;try{
  const a={id:'a',companyId:'A',storeId:'same',stock:1};
  m.cacheStoreRows('inventory','same','u:A',[a,{id:'wrong-company',companyId:'B',storeId:'same'},{id:'wrong-store',companyId:'A',storeId:'other'},{id:'forged-link',companyId:'A',storeId:'same',fromStoreId:'foreign-store'}]);
  assert.deepEqual(m.getCachedStoreRows('inventory','same','u:A'),[a]);
  for(const args of [['inventory','same','u:B'],['inventory','other','u:A'],['inventory','same','other:A'],['sales','same','u:A']])assert.equal(m.getCachedStoreRows(...args),undefined);
  Date.now=()=>now()+5*60*1000+1;
  assert.equal(m.getCachedStoreRows('inventory','same','u:A'),undefined);
  Date.now=now;
  for(let i=0;i<21;i++)m.cacheStoreRows('inventory',String(i),'u:A',[{id:String(i),storeId:String(i),companyId:'A'}]);
  assert.equal(m.getCachedStoreRows('inventory','0','u:A'),undefined);
  assert.ok(m.getCachedStoreRows('inventory','20','u:A'));
  m.cacheStoreRows('inventory','oversize','u:A',Array.from({length:50001},(_,id)=>({id,storeId:'oversize',companyId:'A'})));
  assert.equal(m.getCachedStoreRows('inventory','oversize','u:A'),undefined);
  m.cacheStoreRows('inventory','huge','u:A',[{id:'huge',storeId:'huge',image:'x'.repeat(9*1024*1024)}]);
  assert.equal(m.getCachedStoreRows('inventory','huge','u:A'),undefined);
  m.clearStoreCache();assert.equal(m.getCachedStoreRows('inventory','20','u:A'),undefined);
 }finally{Date.now=now;await m.cleanup()}
});

test('cached subscription deduplicates, rejects foreign rows, reports offline/errors and closes after last consumer',async()=>{
 const m=await developerSession();const original=console.error;console.error=()=>{};
 try{
  m.control.pause=true;
  m.cacheStoreRows('inventory','A','u:C',[{id:'cache',storeId:'A',companyId:'C'}]);
  const values=[],states=[];
  const left=m.subscribeStoreRows('inventory','A','u:C',rows=>values.push(rows),state=>states.push(state));
  const right=m.subscribeStoreRows('inventory','A','u:C',()=>{});
  assert.equal(m.connections.length,1);assert.equal(values[0][0].id,'cache');assert.ok(states.at(-1).syncing);
  const c=m.connections[0];
  c.apply({metadata:{fromCache:true},docs:[{id:'local',data:()=>({storeId:'A',companyId:'C'})},{id:'foreign',data:()=>({storeId:'A',companyId:'other'})},{id:'store',data:()=>({storeId:'B',companyId:'C'})}]});
  assert.deepEqual(values.at(-1).map(row=>row.id),['local']);assert.ok(states.at(-1).syncing);
  assert.equal(m.getCachedStoreRows('inventory','A','u:C')[0].id,'cache','unverified local SDK cache does not renew server data');
  c.fail(new Error('network failed'));assert.ok(states.at(-1).error);
  left();assert.equal(c.closed,false);right();assert.equal(c.closed,true);
  const count=values.length;c.apply({docs:[]});assert.equal(values.length,count);
 }finally{console.error=original;await m.cleanup()}
});

test('double login sends one audit write and cannot download business directories before identification',async()=>{
 const s=await session();try{
  assert.deepEqual(s.writes,[]);assert.deepEqual(s.reads,[]);
  await act(async()=>Promise.all([s.login(),s.login()]));
  assert.equal(s.writes.length,1);assert.equal(s.writes[0].ref.name,'loginHistory');
  assert.ok(s.reads.every(q=>q.id||q.filters?.some(f=>['username','name'].includes(f.field))));
  assert.ok(!s.connections.some(c=>c.q.name==='sellers'&&!c.q.id&&!c.q.filters?.some(f=>f.field==='storeId')));
 }finally{await s.cleanup()}
});

test('admin without POS permission also starts with only active-store inventory and no company analytics fanout',async()=>{
 // View values are string enum values; obtain the actual enum rather than guess UI labels.
 const types=await developerSession();const views=[types.View.DASHBOARD];await types.cleanup();
 const s=await session({permissions:views});try{
  await act(async()=>s.login());
  assert.equal(s.header().props.currentView,s.View.DASHBOARD);
  assert.equal(s.connections.filter(c=>!c.closed&&c.q.name==='inventory').length,1);
  assert.ok(s.connections.filter(c=>!c.closed&&c.q.filters?.some(f=>f.field==='storeId')).every(c=>c.q.filters.find(f=>f.field==='storeId').value==='A0'));
 }finally{await s.cleanup()}
});

test('purchases request additional inventories only after selecting stores, and CEO remains dormant until activated',async()=>{
 const s=await session();try{
  await act(async()=>s.login());
  await act(async()=>s.header().props.setCurrentView(s.View.PURCHASES));
  assert.equal(s.reads.filter(q=>q.name==='inventory').length,0);
  await act(async()=>s.renderer.root.findByProps({screen:'PurchasesView'}).props.onRequestStoreInventory(['A1','B0']));
  const reads=s.reads.filter(q=>q.name==='inventory');assert.equal(reads.length,1);assert.equal(reads[0].filters[0].value,'A1');
  assert.deepEqual(s.renderer.root.findByProps({screen:'PurchasesView'}).props.allInventoryForSearch.filter(row=>row.storeId==='A1').map(row=>row.id),['A-one']);
  assert.equal(s.connections.filter(c=>!c.closed&&c.q.name==='inventory').length,1);
  await act(async()=>s.header().props.setCurrentView(s.View.CEO_CENTER));
  assert.ok(!s.connections.some(c=>!c.closed&&['sales','purchases','layaways','expenses'].includes(c.q.name)),'CEO collections await activation');
 }finally{await s.cleanup()}
});

test('mismatched tenant, disabled user and ambiguous credentials cannot open business subscriptions',async()=>{
 for(const scenario of ['company','disabled','ambiguous']){
  const s=await session();const original=globalThis.alert;const messages=[];globalThis.alert=message=>messages.push(message);
  try{
   if(scenario==='company')s.records.set('sellers',[{...s.user,companyId:'B'}]);
   if(scenario==='disabled')s.records.set('sellers',[{...s.user,isDisabled:true}]);
   if(scenario==='ambiguous')s.records.set('sellers',[s.user,{...s.user,id:'other-user',companyId:'B',storeId:'B0'}]);
   await act(async()=>s.login());
   assert.ok(messages.length);assert.equal(s.connections.length,0);assert.deepEqual(s.writes,[]);
   assert.ok(s.renderer.root.findByProps({screen:'LoginView'}));
  }finally{globalThis.alert=original;await s.cleanup()}
 }
});

test('global mode also fetches the tenant directory when activated directly after login, with active stock staying live',async()=>{
 const s=await session();try{
  await act(async()=>s.login());
  await act(async()=>s.header().props.onToggleGlobalMode());
  const pos=()=>s.renderer.root.findByProps({screen:'PosView'}).props;
  assert.deepEqual(pos().inventory.map(row=>row.id).sort(),['A-one','A-zero']);
  assert.ok(s.reads.filter(q=>q.name==='inventory').every(q=>q.filters[0].value.startsWith('A')));
  const active=s.connections.find(c=>!c.closed&&c.q.name==='inventory');
  await act(async()=>active.apply({metadata:{fromCache:false},docs:[{id:'A-zero',data:()=>({companyId:'A',storeId:'A0',stock:3})}]}));
  assert.equal(pos().inventory.find(row=>row.id==='A-zero').stock,3);
  await act(async()=>s.header().props.onToggleGlobalMode());
  assert.deepEqual(pos().inventory.map(row=>row.id),['A-zero']);
  assert.equal(s.connections.filter(c=>!c.closed&&c.q.name==='inventory').length,1);
 }finally{await s.cleanup()}
});

test('late global reads cannot repaint or refill company A cache after the developer connects company B',async()=>{
 const s=await session({owner:true});try{
  s.records.set('companies',[{id:'A',name:'Company A',allowedViews:Object.values(s.View)},{id:'B',name:'Company B',allowedViews:Object.values(s.View)}]);
  await act(async()=>s.login());
  let release;s.control.readGate=new Promise(resolve=>{release=resolve});
  await act(async()=>s.header().props.onToggleGlobalMode());
  assert.ok(s.reads.some(q=>q.name==='inventory'));
  await act(async()=>s.header().props.setCurrentView(s.View.DEVELOPER_CENTER));
  await act(async()=>s.renderer.root.findByType(s.DeveloperCenter).props.onSetActiveCompanyId('B'));
  await act(async()=>s.header().props.setCurrentView(s.View.POS));
  assert.equal(s.header().props.currentStore.id,'B0');
  await act(async()=>{release();await Promise.resolve()});
  assert.deepEqual(s.renderer.root.findByProps({screen:'PosView'}).props.inventory.map(row=>row.id),['foreign-product']);
  assert.equal(s.getCachedStoreRows('inventory','A0',`${s.user.id}:A`),undefined);
  assert.ok(s.connections.filter(c=>!c.closed&&c.q.name==='inventory').every(c=>c.q.filters[0].value==='B0'));
 }finally{await s.cleanup()}
});

test('store changes keep company metadata listeners stable and explicit global refresh updates inactive stock',async()=>{
 const s=await session();try{
  await act(async()=>s.login());await act(async()=>s.header().props.onRequestStores());
  const dirs=()=>s.connections.filter(c=>['companies','stores','roles'].includes(c.q.name)).length;
  const before=dirs();
  for(const id of ['A1','A0','A1','A0'])await act(async()=>s.header().props.onSwitchStore(id));
  assert.equal(dirs(),before,'active-store changes never reread company/store/role directories');
  await act(async()=>s.header().props.onToggleGlobalMode());
  s.records.set('inventory',s.records.get('inventory').map(row=>row.storeId==='A1'?{...row,stock:6}:row));
  await act(async()=>s.renderer.root.findAllByType('button').find(n=>n.children.join('')==='Actualizar consulta').props.onClick());
  assert.equal(s.renderer.root.findByProps({screen:'PosView'}).props.inventory.find(row=>row.storeId==='A1').stock,6);
  assert.equal(s.connections.filter(c=>!c.closed&&c.q.name==='inventory').length,1);
 }finally{await s.cleanup()}
});

test('developer identity role updates in another company do not revert to a stale directory copy',async()=>{
 const s=await session({owner:true});try{
  s.records.set('companies',[{id:'A',name:'A'},{id:'B',name:'B'}]);
  await act(async()=>s.login());await act(async()=>s.header().props.setCurrentView(s.View.DEVELOPER_CENTER));
  await act(async()=>s.renderer.root.findByType(s.DeveloperCenter).props.onSetActiveCompanyId('B'));
  await act(async()=>s.header().props.setCurrentView(s.View.POS));
  s.records.set('roles',[...s.records.get('roles'),{...s.records.get('roles')[0],id:'updated-role'}]);
  s.records.set('sellers',[{...s.user,roleId:'updated-role'}]);
  const identity=s.connections.find(c=>!c.closed&&c.q.name==='sellers'&&c.q.id===s.user.id);
  await act(async()=>identity.apply(s.snapshot(identity.q)));
  assert.equal(s.header().props.currentUser.roleId,'updated-role');assert.equal(s.header().props.currentStore.id,'B0');
  assert.equal(s.connections.filter(c=>!c.closed&&c.q.name==='roles'&&c.q.id==='updated-role').length,1);
 }finally{await s.cleanup()}
});

test('original company categories load only referenced legacy IDs plus the scoped directory, with no global scan',async()=>{
 const s=await session();try{
  const companyId=s.DEFAULT_COMPANY_ID;
  s.records.set('companies',[{id:companyId,name:'Original',allowedViews:Object.values(s.View)}]);
  s.records.set('stores',[{id:'A0',name:'One',companyId,accentColorsUpdated:true}]);
  s.records.set('sellers',[{...s.user,companyId}]);s.records.set('roles',s.records.get('roles').map(role=>({...role,companyId})));
  s.records.set('inventory',[{id:'own',storeId:'A0',companyId,categoryId:'legacy'}]);
  s.records.set('categories',[{id:'legacy',name:'Own legacy category'},{id:'unused',name:'Unused old category'},{id:'other-company',companyId:'B',name:'Foreign category'}]);
  await act(async()=>s.login());
  assert.deepEqual(s.renderer.root.findByProps({screen:'PosView'}).props.categories.map(row=>row.id),['legacy']);
  assert.ok(s.connections.filter(c=>c.q.name==='categories').every(c=>c.q.filters.some(f=>f.field==='companyId'&&f.value===companyId)));
  assert.deepEqual(s.reads.filter(q=>q.name==='categories').map(q=>q.id),['legacy']);
  assert.equal(s.writes.length,1,'only audit log is written; no category/history migration');
 }finally{await s.cleanup()}
});

test('existing transfer requests stay visible in their source store without loading the entire store directory',async()=>{
 const s=await session();try{
  s.records.set('incidents',[{id:'own-transfer',companyId:'A',storeId:'A0',fromStoreId:'A0',toStoreId:'A1',status:'closed'}, {id:'foreign-reference',companyId:'A',storeId:'A0',fromStoreId:'A0',toStoreId:'B0',status:'closed'}, {id:'destination-only',companyId:'A',storeId:'A1',fromStoreId:'A0',toStoreId:'A1',status:'closed'}]);
  await act(async()=>s.login());
  assert.deepEqual(s.renderer.root.findByProps({screen:'PosView'}).props.incidents.map(row=>row.id),['own-transfer']);
  assert.ok(s.connections.filter(c=>c.q.name==='stores').every(c=>c.q.id),'no store-directory listener is needed for referenced destinations');
  const refs=s.reads.filter(q=>q.name==='stores'&&!q.id);
  assert.equal(refs.length,2);assert.ok(refs.every(q=>q.filters.some(f=>f.field==='companyId'&&f.value==='A')&&q.filters.some(f=>f.field==='__name__')));
  assert.equal(s.getCachedStoreRows('storeMetadata','B0','user:A'),undefined,'foreign referenced metadata is never cached');
  assert.equal(s.connections.filter(c=>!c.closed&&c.q.name==='inventory').length,1);
 }finally{await s.cleanup()}
});
