import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {developerSession,browserGlobals} from './helpers/developerSession.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('staging measurement survives login and grant resolution, captures startup reads and clears on logout',async()=>{
 const restore=browserGlobals();const m=await developerSession({diagnostics:true});let r;
 try{
  const user={id:'test-user',name:'Test',username:'SECRET_USER',password:'SECRET_PASSWORD',companyId:'A',storeId:'A1',roleId:'r'};
  m.records.set('sellers',[user]);m.records.set('stores',[{id:'A1',name:'One',companyId:'A',accentColorsUpdated:true}]);m.records.set('roles',[{id:'r',name:'Vendedor',companyId:'A',userType:'seller',permissions:[m.View.POS]}]);m.records.set('companies',[{id:'A',name:'A'}]);
  await act(async()=>{r=create(React.createElement(m.App))});
  const button=label=>r.root.findAllByType('button').find(b=>b.children.join('')===label);
  await act(async()=>button('Medir ingreso').props.onClick());await act(async()=>button('Iniciar medición').props.onClick());
  const id=m.meter.getReadDiagnostics().session.id;
  await act(async()=>r.root.findByProps({screen:'LoginView'}).props.onLogin(user.username,user.password));
  const value=m.meter.getReadDiagnostics();assert.equal(value.session.id,id);assert.equal(value.session.active,true);
  assert.equal(value.session.label,'Ingreso al POS');assert.ok(value.rows.some(x=>x.resource==='sellers'&&x.operation==='Consulta'));
  assert.ok(value.rows.some(x=>x.operation==='Listener'));assert.ok(value.timings.some(t=>t.phase==='Inicio de sesión: verificar acceso'&&t.status==='success'));
  assert.doesNotMatch(JSON.stringify(value),/SECRET_USER|SECRET_PASSWORD/);
  await act(async()=>button('● Midiendo · Ver / detener').props.onClick());await act(async()=>button('Detener').props.onClick());assert.equal(m.meter.getReadDiagnostics().session.active,false);
  await act(async()=>r.root.findByType(m.Header).props.onLogout());assert.equal(m.meter.getReadDiagnostics().session,null);
 }finally{if(r)await act(async()=>r.unmount());await m.cleanup();restore()}
});
