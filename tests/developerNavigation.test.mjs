import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {create, act} from 'react-test-renderer';
import {developerSession, browserGlobals} from './helpers/developerSession.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

const text=node=>typeof node==='string'?node:(node.children||[]).map(text).join(' ');
const button=(root,label)=>root.findAllByType('button').find(b=>text(b).includes(label));

async function setup({ownerAccess=true}={}) {
  const restore=browserGlobals(); const m=await developerSession(); const {View,records,PLATFORM_OWNER_USER_ID,DEFAULT_COMPANY_ID}=m;
  const companies=['A','B','C','D'].map(id=>({id,name:`Empresa ${id}`,status:'active',maxStores:5,maxAdmins:5,maxSellers:5,allowedViews:[View.POS,View.INVENTORY,View.DASHBOARD]}));
  const stores=['A1','A2','B1','B2','C1','C2'].map(id=>({id,name:`Sede ${id}`,companyId:id[0],accentColorsUpdated:true}));
  const roles=['A','B','C'].map(id=>({id:`admin-${id}`,companyId:id,name:'Administrator',userType:'admin',permissions:Object.values(View).filter(v=>v!==View.DEVELOPER_CENTER)}));
  const owner={id:ownerAccess?PLATFORM_OWNER_USER_ID:'seller-A',name:ownerAccess?'Carlos':'Vendedor',username:'fixture-owner',password:'fixture-only',companyId:'A',storeId:'A1',roleId:'admin-A'};
  if(!ownerAccess){owner.roleId='seller-role';roles.push({id:'seller-role',companyId:'A',name:'Vendedor',userType:'seller',permissions:[View.POS,View.INVENTORY,View.DEVELOPER_CENTER,View.INVENTORY_TRANSFER]});}
  records.set('categories',['A','B','C'].map(companyId=>({id:'category-'+companyId,companyId,name:companyId})));
  records.set('companies',[...companies,{id:DEFAULT_COMPANY_ID}]); records.set('stores',stores); records.set('roles',roles); records.set('sellers',[owner]);
  for(const name of ['inventory','sales','purchases','layaways','incidents'])records.set(name,stores.map(s=>({id:`${name}-${s.id}`,companyId:s.companyId,storeId:s.id,status:'closed'})));
  let renderer; await act(async()=>{renderer=create(React.createElement(m.App))});
  await act(async()=>{await renderer.root.findByProps({screen:'LoginView'}).props.onLogin(owner.username,owner.password)});
  const header=()=>renderer.root.findByType(m.Header);
  const navigate=async view=>act(async()=>header().props.setCurrentView(view));
  const connect=async id=>{await navigate(View.DEVELOPER_CENTER);await act(async()=>renderer.root.findByType(m.DeveloperCenter).props.onSetActiveCompanyId(id));};
  return {...m,renderer,header,navigate,connect,owner,companies,stores,roles,cleanup:async()=>{await act(async()=>renderer.unmount());await m.cleanup();restore()}};
}

test('developer can select another company store without borrowing that company role',async()=>{
  const s=await setup();try{
    await s.connect('B');
    const h=s.header();
    await act(async()=>button(h,'Sede B1').props.onClick());
    assert.ok(button(s.header(),'Cambiar Sede') || text(s.header()).includes('Cambiar Sede'),'authorized developer store selector opens');
    await act(async()=>button(s.header(),'Sede B2').props.onClick());
    assert.equal(s.header().props.currentStore.id,'B2');
    assert.ok(text(s.header()).includes('Traslados Internos'));
  }finally{await s.cleanup()}
});

test('connecting company changes branding and clears store for a company without stores',async()=>{
  const s=await setup();try{
    await s.connect('B');assert.equal(s.header().props.currentCompany.id,'B');
    assert.deepEqual(s.header().props.stores.map(v=>v.id),['B1','B2']);
    await s.connect('D');assert.equal(s.header().props.currentCompany.id,'D');
    assert.equal(s.header().props.currentStore,undefined);
    assert.equal(localStorage.getItem('currentStoreId'),null);
  }finally{await s.cleanup()}
});

test('navigation closes global verification and briefing overlays',async()=>{
  const s=await setup();try{
    await s.navigate(s.View.DASHBOARD);
    await act(async()=>s.renderer.root.findByProps({screen:'DashboardView'}).props.onOpenVerification());
    assert.equal(s.renderer.root.findByProps({screen:'InventoryVerificationModal'}).props.isOpen,true);
    await s.navigate(s.View.DEVELOPER_CENTER);
    assert.equal(s.renderer.root.findAllByProps({screen:'InventoryVerificationModal'}).filter(n=>n.props.isOpen).length,0);
    await act(async()=>s.header().props.onOpenBriefing());
    await s.connect('B');
    assert.equal(s.renderer.root.findAllByProps({screen:'PendingIncidentsBriefingModal'}).some(n=>n.props.isOpen),false);
    assert.equal(s.renderer.root.findAllByProps({screen:'DashboardView'}).length,0);
  }finally{await s.cleanup()}
});

test('repeated A/B company switches leave exactly one module tree and no React key collisions',async()=>{
  const errors=[];const original=console.error;console.error=(...args)=>{if(String(args[0]).includes('same key'))errors.push(args);else original(...args)};
  let s;try{
    s=await setup();
    for(const company of ['B','A','B','A']){
      await s.connect(company);
      assert.equal(s.renderer.root.findAllByType('main').length,1,'previous company screen must be removed');
      assert.equal(s.renderer.root.findAllByType(s.DeveloperCenter).length,1,'only one Developer Center');
    }
    assert.deepEqual(errors,[],'sibling components must have distinct React keys');
  }finally{if(s)await s.cleanup();console.error=original}
});

test('repeated company/store changes isolate snapshots, ignore late A/B/A callbacks and bound subscriptions',async()=>{
  const s=await setup();try{
    const operationalNames=new Set(['inventory','sales','purchases','layaways','incidents','categories','daily_notes','inventoryTransfers']);
    const live=()=>s.connections.filter(c=>!c.closed);
    const directories=()=>s.connections.filter(c=>['stores','companies','roles','sellers'].includes(c.q.name)).length;
    const initialDirectories=directories();
    const staleCategory=s.connections.find(c=>c.q.name==='categories'&&!c.closed);
    const staleInventory=s.connections.find(c=>c.q.name==='inventory'&&!c.closed);
    for(const company of ['B','C','A','B','C','A']){
      await s.connect(company);
      assert.equal(live().filter(c=>operationalNames.has(c.q.name)).length,0,'company management needs no operational data listeners');
      assert.equal(s.renderer.root.findAllByType('main').length,1);
      await s.navigate(s.View.POS);
      await act(async()=>s.header().props.onRequestStores());
      const catalogs=s.connections.filter(c=>c.q.name==='inventory').length;
      for(const suffix of ['2','1','2','1']){
        const storeId=company+suffix;
        s.renderedScreens.length=0;
        await act(async()=>s.header().props.onSwitchStore(storeId));
        await act(async()=>s.renderer.root.findByProps({screen:'PosView'}).props.onRequestData(['sales','purchases','layaways','incidents']));
        const props=s.renderer.root.findByProps({screen:'PosView'}).props;
        assert.equal(props.currentStore.id,storeId);
        for(const name of ['inventory','sales','purchases','layaways','incidents']){
          assert.ok(props[name].length>0,`${name} loaded for ${storeId}`);
          assert.ok(props[name].every(row=>row.companyId===company && row.storeId===storeId),`${name} belongs to current store`);
        }
        for(const {screen,props:frame} of s.renderedScreens.filter(f=>f.screen==='PosView')){
          for(const name of ['inventory','sales','purchases','layaways','incidents']) assert.ok(frame[name].every(row=>row.companyId===company && row.storeId===frame.currentStore.id),`${screen} never paints another context's ${name}`);
        }
        const keys=live().map(c=>JSON.stringify(c.q));
        assert.equal(new Set(keys).size,keys.length,'one live listener per query');
        assert.ok(live().filter(c=>operationalNames.has(c.q.name)).every(c=>(c.q.filters||[]).every(f=>f.field==='companyId'?f.value===company:!['storeId','fromStoreId','tienda'].includes(f.field)||f.value.startsWith(company))), 'operational queries stay in the selected company');
      }
      assert.equal(s.connections.filter(c=>c.q.name==='inventory').length,catalogs + 4,'each visited store reconnects to synchronize its cache');
      assert.equal(live().filter(c=>c.q.name==='inventory').length,1,'only the active store inventory remains subscribed');
      const reads=s.connections.length;
      await act(async()=>{
        for(const c of live().filter(c=>['stores','roles','sellers'].includes(c.q.name)))c.apply(s.snapshot(c.q));
      });
      assert.equal(s.connections.length,reads,'metadata updates do not reread operational collections');
    }
    assert.ok(directories()>initialDirectories,'directories reconnect within the selected tenant');
    assert.equal(live().filter(c=>['stores','roles','sellers','companies'].includes(c.q.name)).length,5,'metadata listeners remain bounded across context changes');
    const expected=s.renderer.root.findByProps({screen:'PosView'}).props.categories;
    await act(async()=>{
      staleCategory.apply({docs:[{id:'late',data:()=>({companyId:'A',name:'outdated'})}]});
      staleInventory.apply({docs:[{id:'late',data:()=>({companyId:'A',storeId:'A1'})}]});
    });
    const props=s.renderer.root.findByProps({screen:'PosView'}).props;
    assert.deepEqual(props.categories,expected,'late callback from first visit to A ignored after returning to A');
    assert.ok(props.inventory.every(row=>row.id!=='late'));
    await act(async()=>s.header().props.onLogout());
    assert.equal(live().filter(c=>operationalNames.has(c.q.name)||c.q.name==='platformDevelopers').length,0);
  }finally{await s.cleanup()}
  assert.ok(s.connections.every(c=>c.closed),'unmount closes all subscriptions');
});

test('ordinary seller cannot open Developer Center, transfers or switch to another company',async()=>{
  const s=await setup({ownerAccess:false});try{
    assert.equal(s.header().props.isDeveloper,false);
    assert.equal(text(s.header()).includes('Developer Center'),false);
    assert.equal(text(s.header()).includes('Traslados Internos'),false);
    await act(async()=>s.header().props.onSwitchStore('B1'));
    assert.equal(s.header().props.currentStore.id,'A1');
    await s.navigate(s.View.DEVELOPER_CENTER);
    assert.equal(s.renderer.root.findAllByType(s.DeveloperCenter).length,0);
    assert.equal(s.header().props.currentView,s.View.POS);
  }finally{await s.cleanup()}
});

test('inspecting another company closes its forms and ignores async completion after returning',async()=>{
  const s=await setup();try{
    await s.navigate(s.View.DEVELOPER_CENTER);
    const props=s.renderer.root.findByType(s.DeveloperCenter).props;
    let finish;const updates=[];
    const onUpdateCompany=company=>{updates.push(company.id);return new Promise(resolve=>{finish=resolve})};
    let panel;await act(async()=>{panel=create(React.createElement(s.DeveloperCenter,{...props,isOwner:false,onUpdateCompany}))});
    try{
      // Start a module change in A, then inspect B and return to A before it finishes.
      const preset=button(panel.root,'POS Básico');
      assert.ok(preset,'module preset present');
      let pending;await act(async()=>{pending=preset.props.onClick()});
      const select=id=>panel.root.findAllByType('div').find(n=>n.props.onClick&&n.findAllByType('h3').some(h=>text(h)===`Empresa ${id}`));
      await act(async()=>select('B').props.onClick());
      await act(async()=>button(panel.root,'+ Crear Sede').props.onClick());
      assert.equal(panel.root.findAllByType('form').length,1);
      await act(async()=>select('A').props.onClick());
      assert.equal(panel.root.findAllByType('form').length,0,'previous company form unmounted');
      await act(async()=>{finish();await pending});
      assert.deepEqual(updates,['A']);
      assert.equal(text(panel.root).includes('Preset de módulos aplicado'),false,'old save feedback cannot appear in a new company instance');
    }finally{await act(async()=>panel.unmount())}
  }finally{await s.cleanup()}
});
