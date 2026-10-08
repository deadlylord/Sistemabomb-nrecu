import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { developerSession, browserGlobals } from './helpers/developerSession.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const inventoryReads = m => m.reads.filter(q => q.name === 'inventory' && q.filters);
const storeOf = q => q.filters.find(f => f.field === 'storeId').value;

async function session({ realPurchases = false, owner = false, stores = 3 } = {}) {
  const restore = browserGlobals({ idleQueue: [] }), m = await developerSession({ realPurchases });
  const user = { id: owner ? m.PLATFORM_OWNER_USER_ID : 'user', username: 'admin', password: 'test', companyId: 'A', storeId: 'A0', roleId: 'role', name: 'Admin' };
  m.records.set('companies', ['A', 'B'].map(id => ({ id, name: id, allowedViews: Object.values(m.View) })));
  m.records.set('stores', [...Array.from({ length: stores }, (_, i) => ({ id: `A${i}`, name: `Store A${i}`, companyId: 'A', accentColorsUpdated: true })), { id: 'B0', companyId: 'B', name: 'Foreign', accentColorsUpdated: true }]);
  m.records.set('sellers', [user]);
  m.records.set('roles', [{ id: 'role', companyId: 'A', name: 'Administrator', userType: 'admin', permissions: Object.values(m.View) }]);
  m.records.set('categories', [{ id: 'catA', companyId: 'A', name: 'TEST' }]);
  m.records.set('inventory', Array.from({ length: stores }, (_, i) => ({ id: `p${i}`, storeId: `A${i}`, companyId: 'A', name: `TEST A${i}`, categoryId: 'catA', stock: 5, cost: 50, price: 100, sku: `TEST-${i}`, imageUrl: '', description: 'TEST' })));
  let renderer;
  await act(async () => { renderer = create(React.createElement(m.App)); });
  assert.equal(m.connections.length, 0);
  await act(async () => renderer.root.findByProps({ screen: 'LoginView' }).props.onLogin('admin', 'test'));
  const header = () => renderer.root.findByType(m.Header);
  const purchases = () => realPurchases ? renderer.root.findByType(m.PurchasesView).props : renderer.root.findByProps({ screen: 'PurchasesView' }).props;
  return { ...m, renderer, header, purchases, cleanup: async () => { await act(async () => renderer.unmount()); await m.cleanup(); restore(); } };
}

test('Compras normal reads no foreign inventories; adding stores is incremental, scoped and deduplicated', async () => {
  const s = await session(); try {
    assert.equal(inventoryReads(s).length, 0);
    await act(async () => s.header().props.setCurrentView(s.View.PURCHASES));
    assert.equal(inventoryReads(s).length, 0);
    for (const ids of [['A1'], ['A1', 'A2'], ['A1'], ['A1', 'A1', 'B0', 'A0']]) await act(async () => s.purchases().onRequestStoreInventory(ids));
    assert.deepEqual(inventoryReads(s).map(storeOf), ['A1', 'A2']);
    assert.deepEqual(s.purchases().allInventoryForSearch.map(p => p.storeId).sort(), ['A0', 'A1']);
    assert.equal(s.connections.filter(c => !c.closed && c.q.name === 'inventory').length, 1);
    await act(async () => s.header().props.onToggleGlobalMode());
    assert.deepEqual(inventoryReads(s).map(storeOf), ['A1', 'A2', 'A2']);
    await act(async () => s.header().props.onToggleGlobalMode());
    assert.equal(inventoryReads(s).length, 3);
  } finally { await s.cleanup(); }
});

test('lookup caps requests at four and stops queued work after deselection/disposal', async () => {
  const m = await developerSession(); let lookup;
  try {
    const pending = []; let state;
    m.control.read = q => new Promise(resolve => pending.push({ q, resolve }));
    lookup = m.createInventoryLookup('u:A', value => { state = value; });
    lookup.setStores(Array.from({ length: 1000 }, (_, i) => `A${i}`));
    assert.equal(pending.length, 4); assert.equal(state.loading, true);
    lookup.setStores(['A4']);
    pending[0].resolve(m.snapshot(pending[0].q)); await settle();
    assert.equal(pending.length, 5); assert.equal(storeOf(pending[4].q), 'A4');
    assert.equal(m.getCachedStoreRows('inventory', 'A0', 'u:A'), undefined);
    lookup.dispose();
    for (const job of pending) job.resolve(m.snapshot(job.q)); await settle();
    assert.equal(pending.length, 5);
    assert.equal(m.getCachedStoreRows('inventory', 'A4', 'u:A'), undefined);
  } finally { lookup?.dispose(); await m.cleanup(); }
});

test('cache paints pending data; late cancelled A-B-A responses cannot cache or overwrite the new A request', async () => {
  const m = await developerSession(); let lookup;
  try {
    const cached = { id: 'cached', companyId: 'A', storeId: 'A1', stock: 2 };
    m.cacheStoreRows('inventory', 'A1', 'u:A', [cached]);
    const pending = []; let state;
    m.control.read = q => new Promise(resolve => pending.push({ q, resolve }));
    lookup = m.createInventoryLookup('u:A', value => { state = value; });
    lookup.setStores(['A1']); assert.deepEqual(state.rows, [cached]); assert.equal(state.loading, true); assert.equal(state.updatedAt, undefined);
    lookup.setStores(['A2']); lookup.setStores(['A1']);
    pending[0].resolve({ metadata: { fromCache: false }, docs: [{ id: 'late', data: () => ({ companyId: 'A', storeId: 'A1', stock: 999 }) }] }); await settle();
    assert.deepEqual(state.rows, [cached]); assert.deepEqual(m.getCachedStoreRows('inventory', 'A1', 'u:A'), [cached]);
    pending[2].resolve({ metadata: { fromCache: false }, docs: [
      { id: 'fresh', data: () => ({ companyId: 'A', storeId: 'A1', stock: 3 }) },
      { id: 'foreign-company', data: () => ({ companyId: 'B', storeId: 'A1' }) },
      { id: 'foreign-store', data: () => ({ companyId: 'A', storeId: 'A2' }) },
    ] }); await settle();
    assert.deepEqual(state.rows.map(p => p.id), ['fresh']); assert.equal(state.loading, false); assert.ok(state.updatedAt);
    assert.deepEqual(m.getCachedStoreRows('inventory', 'A1', 'u:B'), undefined);
  } finally { lookup?.dispose(); await m.cleanup(); }
});

test('offline and failed requests are explicit; one failure does not hide other selected stores', async () => {
  const m = await developerSession(), original = console.error; let lookup;
  console.error = () => {};
  try {
    const old = { id: 'cached', companyId: 'A', storeId: 'A1' };
    m.cacheStoreRows('inventory', 'A1', 'u:A', [old]); let state;
    m.control.read = async q => {
      if (storeOf(q) === 'A2') throw Error('network');
      return { metadata: { fromCache: true }, docs: [{ id: 'offline', data: () => ({ companyId: 'A', storeId: 'A1' }) }] };
    };
    lookup = m.createInventoryLookup('u:A', value => { state = value; }); lookup.setStores(['A1', 'A2']); await settle();
    assert.equal(state.loading, false); assert.ok(state.error); assert.equal(state.updatedAt, undefined);
    assert.deepEqual(state.rows.map(p => p.id), ['offline']); assert.deepEqual(m.getCachedStoreRows('inventory', 'A1', 'u:A'), [old]);
  } finally { lookup?.dispose(); console.error = original; await m.cleanup(); }
});

test('old Purchases callbacks cannot request data after store, module, company changes or logout', async () => {
  const s = await session({ owner: true }); try {
    await act(async () => s.header().props.setCurrentView(s.View.PURCHASES)); const request = s.purchases().onRequestStoreInventory;
    await act(async () => s.header().props.onSwitchStore('A1'));
    await act(async () => request(['A2'])); assert.equal(inventoryReads(s).length, 0);
    const request2 = s.purchases().onRequestStoreInventory;
    await act(async () => s.header().props.setCurrentView(s.View.POS));
    await act(async () => s.header().props.setCurrentView(s.View.PURCHASES));
    await act(async () => request2(['A2'])); assert.equal(inventoryReads(s).length, 0);
    await act(async () => s.header().props.setCurrentView(s.View.DEVELOPER_CENTER));
    await act(async () => s.renderer.root.findByType(s.DeveloperCenter).props.onSetActiveCompanyId('B'));
    await act(async () => s.header().props.setCurrentView(s.View.PURCHASES));
    await act(async () => request(['A2'])); assert.equal(inventoryReads(s).length, 0);
    await act(async () => s.header().props.onLogout()); await act(async () => request2(['A2']));
    assert.equal(inventoryReads(s).length, 0); assert.ok(s.connections.every(c => c.closed));
  } finally { await s.cleanup(); }
});

test('real Compras waits before claiming product absent; store switch closes draft and preserves search', async () => {
  const s = await session({ realPurchases: true }); try {
    await act(async () => s.header().props.setCurrentView(s.View.PURCHASES));
    let release; s.control.readGate = new Promise(resolve => { release = resolve; });
    await act(async () => s.renderer.root.findAllByType('button').find(n => n.children.join('') === 'Store A1').props.onClick());
    const search = () => s.renderer.root.findByProps({ placeholder: 'BUSCA Y SELECCIONA PRODUCTOS...' });
    await act(async () => search().props.onChange({ target: { value: 'Unknown TEST' } }));
    assert.equal(s.renderer.root.findAllByType('button').filter(n => n.children.join('') === 'Crear y Añadir al Lote').length, 0);
    await act(async () => { release(); await settle(); }); s.control.readGate = null;
    assert.equal(s.renderer.root.findAllByType('button').filter(n => n.children.join('') === 'Crear y Añadir al Lote').length, 1);
    await act(async () => search().props.onChange({ target: { value: 'TEST A0' } }));
    await act(async () => s.renderer.root.findAllByType('button').find(n => n.children.join('') === '+ TODAS LAS SELECCIONADAS').props.onClick());
    assert.equal(s.renderer.root.findAllByType('button').filter(n => n.children.join('') === 'FINALIZAR COMPRA DE LOTE').length, 1);
    await act(async () => s.header().props.onSwitchStore('A1'));
    assert.equal(search().props.value, 'TEST A0');
    assert.equal(s.renderer.root.findAllByType('button').filter(n => n.children.join('') === 'FINALIZAR COMPRA DE LOTE').length, 0);
  } finally { await s.cleanup(); }
});

test('purchase writes query only destinations even with 1000 authorized stores; cache invalidated after confirmed batch', async () => {
  const s = await session({ stores: 1000 }); try {
    await act(async () => s.header().props.setCurrentView(s.View.PURCHASES));
    s.control.uniqueIds = 1;
    s.control.batch = () => { const ops = []; return { set: (ref, data) => ops.push({ kind: 'set', ref, data }), update: (ref, data) => ops.push({ kind: 'update', ref, data }), commit: async () => s.writes.push(...ops) }; };
    s.cacheStoreRows('inventory', 'A2', 'user:A', [{ id: 'old', companyId: 'A', storeId: 'A2' }]);
    await act(async () => s.purchases().onMultiStorePurchase({ productInfo: { name: 'TEST A1', categoryId: 'catA' }, storeEntries: { A1: { quantity: 1, cost: 50, price: 100, supplier: 'TEST' }, A2: { quantity: 2, cost: 50, price: 100, supplier: 'TEST' } } }));
    assert.deepEqual(inventoryReads(s).map(storeOf).sort(), ['A1', 'A2']);
    assert.equal(s.getCachedStoreRows('inventory', 'A2', 'user:A'), undefined);
    const purchaseWrites = s.writes.filter(op => op.ref.name === 'purchases');
    assert.equal(purchaseWrites.length, 2); assert.deepEqual(purchaseWrites.map(op => op.data.storeId).sort(), ['A1', 'A2']);
    assert.ok(s.writes.every(op => op.data.companyId === 'A'));
    await assert.rejects(s.purchases().onMultiStorePurchase({ productInfo: { name: 'TEST', categoryId: 'catA' }, storeEntries: { B0: { quantity: 1 } } }), /bloqueado/);
  } finally { await s.cleanup(); }
});

test('a store change during purchase lookups cancels the write and queued destination queries', async () => {
  const s = await session({ stores: 10 }); try {
    await act(async () => s.header().props.setCurrentView(s.View.PURCHASES));
    let release; s.control.readGate = new Promise(resolve => { release = resolve; });
    const entries = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`A${i}`, { quantity: 1, cost: 50, price: 100, supplier: 'TEST' }]));
    const originalWrites = [...s.writes];
    let result;
    await act(async () => { result = s.purchases().onMultiStorePurchase({ productInfo: { name: 'TEST A1', categoryId: 'catA' }, storeEntries: entries }); result.catch(() => {}); await settle(); });
    assert.equal(inventoryReads(s).length, 4);
    await act(async () => s.header().props.onSwitchStore('A1'));
    await act(async () => { release(); await assert.rejects(result, /cambió/); });
    assert.equal(inventoryReads(s).length, 4); assert.deepEqual(s.writes, originalWrites);
  } finally { await s.cleanup(); }
});

test('explicit refresh recovers an incomplete inventory request without duplicate listeners', async () => {
  const s = await session(), original = console.error; console.error = () => {};
  try {
    await act(async () => s.header().props.setCurrentView(s.View.PURCHASES));
    s.control.read = async () => { throw Error('network'); };
    await act(async () => s.purchases().onRequestStoreInventory(['A1']));
    assert.ok(s.purchases().inventorySearchStatus.error);
    s.control.read = null;
    await act(async () => s.renderer.root.findAllByType('button').find(n => n.children.join('') === 'Actualizar consulta').props.onClick());
    assert.equal(s.purchases().inventorySearchStatus.error, null);
    assert.ok(s.purchases().allInventoryForSearch.some(p => p.storeId === 'A1'));
    assert.equal(inventoryReads(s).length, 2);
    assert.equal(s.connections.filter(c => !c.closed && c.q.name === 'inventory').length, 1);
  } finally { console.error = original; await s.cleanup(); }
});

test('a failed purchase lookup stops its queue and rejects foreign product data before any write', async () => {
  const m = await developerSession();
  try {
    m.control.read = async q => ({ metadata: { fromCache: false }, docs: [{ id: 'forged', data: () => ({ companyId: 'B', storeId: storeOf(q) }) }] });
    await assert.rejects(m.findPurchaseProducts(Array.from({ length: 1000 }, (_, i) => `A${i}`), 'TEST', 'A', () => true), /otra empresa/);
    assert.equal(inventoryReads(m).length, 4);
    assert.deepEqual(m.writes, []);
  } finally { await m.cleanup(); }
});

test('CEO still confirms selected active-store inventory on demand when no inventory listener is running', async () => {
  const s = await session(); try {
    await act(async () => s.header().props.setCurrentView(s.View.CEO_CENTER));
    assert.equal(inventoryReads(s).length, 0);
    assert.equal(s.connections.filter(c => !c.closed && c.q.name === 'inventory').length, 0);
    s.records.set('inventory', s.records.get('inventory').map(p => p.storeId === 'A0' ? { ...p, stock: 17 } : p));
    await act(async () => s.renderer.root.findAllByType('button').find(n => n.children.join('') === 'Cargar y analizar CEO Center').props.onClick());
    const ceo = () => s.renderer.root.findByProps({ screen: 'CeoCenterView' }).props;
    assert.deepEqual(inventoryReads(s).map(storeOf), ['A0']);
    assert.equal(ceo().inventory.find(p => p.storeId === 'A0').stock, 17);
    await act(async () => ceo().onSelectStore('all'));
    assert.deepEqual(inventoryReads(s).map(storeOf), ['A0', 'A1', 'A2']);
    assert.equal(ceo().inventory.length, 3);
    assert.equal(s.connections.filter(c => !c.closed && c.q.name === 'inventory').length, 0);
  } finally { await s.cleanup(); }
});
