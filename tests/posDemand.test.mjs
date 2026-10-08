import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { developerSession, browserGlobals } from './helpers/developerSession.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function session({ realPos = false, owner = false } = {}) {
  const idleQueue = [], restore = browserGlobals({ idleQueue });
  const m = await developerSession({ realPos });
  const { records, View } = m;
  const user = { id: owner ? m.PLATFORM_OWNER_USER_ID : 'user', username: 'admin', password: 'test', name: 'Admin', companyId: 'A', storeId: 'A0', roleId: 'role' };
  records.set('companies', [{ id: 'A', name: 'Company A', allowedViews: Object.values(View) }, { id: 'B', name: 'Company B', allowedViews: Object.values(View) }]);
  records.set('stores', ['A0', 'A1', 'B0'].map(id => ({ id, name: id, companyId: id[0], accentColorsUpdated: true, nextInvoiceNumber: 1 })));
  records.set('roles', [{ id: 'role', companyId: 'A', userType: 'admin', name: 'Administrator', permissions: Object.values(View).filter(view => view !== View.DEVELOPER_CENTER) }]);
  records.set('sellers', [user]);
  records.set('categories', [{ id: 'categoryA', companyId: 'A', name: 'Test' }, { id: 'categoryB', companyId: 'B', name: 'Test B' }]);
  records.set('inventory', ['A0', 'A1', 'B0'].map(id => ({ id: `product-${id}`, name: `TEST ${id}`, sku: `TEST-${id}`, companyId: id[0], storeId: id, stock: 5, price: 100, cost: 50, categoryId: `category${id[0]}` })));
  records.set('sales', [{ id: 'sale-A0', companyId: 'A', storeId: 'A0', createdAt: new Date().toISOString(), totalAmount: 100, items: [], payments: [], seller: 'Admin' }, { id: 'foreign', companyId: 'B', storeId: 'B0' }]);
  records.set('customers', [{ id: 'customer-A0', companyId: 'A', storeId: 'A0', name: 'Known', phone: '3001234567' }]);
  records.set('giftVouchers', [{ id: 'voucher', companyId: 'A', storeId: 'A0', code: 'TEST-BONO', status: 'active', currentValue: 100 }]);
  let renderer;
  await act(async () => { renderer = create(React.createElement(m.App)); });
  const before = m.connections.length;
  await act(async () => renderer.root.findByProps({ screen: 'LoginView' }).props.onLogin('admin', 'test'));
  const live = name => m.connections.filter(c => !c.closed && (!name || c.q.name === name));
  return { ...m, user, idleQueue, renderer, before, live,
    pos: () => renderer.root.findByProps({ screen: 'PosView' }).props,
    header: () => renderer.root.findByType(m.Header),
    flushIdle: () => act(async () => { for (let i = 0; i < idleQueue.length; i++) { const callback = idleQueue[i]; idleQueue[i] = null; callback?.(); } }),
    cleanup: async () => { await act(async () => renderer.unmount()); await m.cleanup(); restore(); },
  };
}

test('POS starts with essentials only; reminders arrive after idle, histories and vouchers require action', async () => {
  const s = await session(); try {
    assert.equal(s.before, 0); assert.equal(s.live().length, 8); assert.equal(s.live('inventory').length, 1);
    for (const name of ['sales', 'purchases', 'layaways', 'giftVouchers', 'customers', 'heldCarts', 'incidents', 'daily_notes', 'dailyNotes']) assert.equal(s.live(name).length, 0, name);
    assert.equal(s.pos().dataStatus.heldCarts.loading, true);
    await s.flushIdle(); assert.equal(s.live().length, 12);
    for (const name of ['purchases', 'layaways', 'heldCarts', 'incidents']) assert.equal(s.live(name).length, 1, name);
    for (const name of ['sales', 'giftVouchers', 'customers', 'daily_notes', 'dailyNotes']) assert.equal(s.live(name).length, 0, name);
    await act(async () => s.pos().onRequestData(['sales', 'layaways', 'incidents', 'dailyNotes']));
    assert.equal(s.live('sales').length, 1); assert.equal(s.live('dailyNotes').length, 1);
    await act(async () => s.pos().onRequestData(['sales', 'dailyNotes']));
    assert.equal(s.live('sales').length, 1); assert.equal(s.live('dailyNotes').length, 1);
    assert.ok(s.pos().sales.every(row => row.companyId === 'A' && row.storeId === 'A0'));
  } finally { await s.cleanup(); }
});

test('deferred actions and callbacks cannot enable or repaint old store/company after A-B-A or logout', async () => {
  const s = await session({ owner: true }); try {
    const stale = s.pos().onRequestData;
    await act(async () => s.header().props.onRequestStores());
    await act(async () => s.header().props.onSwitchStore('A1'));
    const lateIdle = s.idleQueue.filter(Boolean);
    await act(async () => s.header().props.onSwitchStore('A0'));
    await act(async () => { stale(['sales', 'customers']); lateIdle.forEach(callback => callback()); });
    assert.equal(s.live('sales').length, 0); assert.equal(s.live('customers').length, 0);
    await act(async () => s.pos().onRequestData(['sales']));
    const oldSales = s.live('sales')[0];
    await act(async () => s.header().props.setCurrentView(s.View.DEVELOPER_CENTER));
    await act(async () => s.renderer.root.findByType(s.DeveloperCenter).props.onSetActiveCompanyId('B'));
    await act(async () => s.header().props.setCurrentView(s.View.POS));
    await act(async () => { stale(['customers']); oldSales.apply({ docs: [{ id: 'late', data: () => ({ companyId: 'A', storeId: 'A0' }) }] }); });
    assert.equal(s.live('sales').length, 0); assert.deepEqual(s.pos().sales, []);
    assert.equal(s.live('inventory').length, 1); assert.equal(s.header().props.currentStore.companyId, 'B');
    const pending = s.idleQueue.filter(Boolean);
    await act(async () => s.header().props.onLogout());
    await act(async () => pending.forEach(callback => callback()));
    assert.equal(s.live().length, 0);
  } finally { await s.cleanup(); }
});

test('explicit POS data distinguishes pending, offline and failure from an empty synchronized collection', async () => {
  const s = await session(); const original = console.error; console.error = () => {};
  try {
    s.control.pause = true;
    await act(async () => s.pos().onRequestData(['sales', 'giftVouchers']));
    assert.equal(s.pos().dataStatus.sales.loading, true);
    const sales = s.live('sales')[0];
    await act(async () => sales.apply({ metadata: { fromCache: true }, docs: [] }));
    assert.equal(s.pos().dataStatus.sales.loading, true);
    await act(async () => sales.fail(new Error('network')));
    assert.ok(s.pos().dataStatus.sales.error);
    const voucher = s.live('giftVouchers')[0];
    await act(async () => voucher.apply({ metadata: { fromCache: false }, docs: [] }));
    assert.equal(s.pos().dataStatus.giftVouchers.loading, false); assert.equal(s.pos().dataStatus.giftVouchers.error, null);
  } finally { console.error = original; await s.cleanup(); }
});

test('real POS mounts checkout lazily, cash sale needs no history or vouchers, and store change closes checkout while preserving search', async () => {
  const s = await session({ realPos: true }); try {
    assert.equal(s.renderer.root.findAllByType(s.PaymentModal).length, 0);
    const search = () => s.renderer.root.findByProps({ placeholder: 'Buscar por nombre o proveedor...' });
    await act(async () => search().props.onChange({ target: { value: 'TEST' } }));
    const product = s.records.get('inventory')[0];
    const card = s.renderer.root.findAll(node => node.props.product?.id === product.id && node.props.onAddToCart)[0];
    await act(async () => card.props.onAddToCart(product));
    const checkout = s.renderer.root.findAllByType('button').find(node => node.props.onClick?.name === 'handleProcessSaleClick');
    await act(async () => s.renderer.root.findAllByType('button').find(node => node.props.onClick?.name === 'handleProcessSaleClick').props.onClick());
    assert.equal(s.live('customers').length, 1);
    for (const name of ['sales', 'purchases', 'giftVouchers']) assert.equal(s.live(name).length, 0, name);
    const payment = s.renderer.root.findByType(s.PaymentModal);
    const click = label => act(async () => payment.findAllByType('button').find(node => node.children.includes(label)).props.onClick());
    await click('Admin'); await click(s.PaymentMethod.Efectivo);
    const writes = [];
    s.control.transaction = async callback => callback({
      get: async ref => s.snapshot(ref), set: (ref, data) => writes.push({ ref, data }),
      update: (ref, data) => writes.push({ ref, data }), delete: ref => writes.push({ ref }),
    });
    const finalize = payment.findAllByType('button').find(node => node.props.onClick?.name === 'handleFinalize');
    assert.equal(finalize.props.disabled, false);
    await act(async () => finalize.props.onClick());
    assert.ok(writes.some(write => write.ref.name === 'sales' && write.data.companyId === 'A' && write.data.storeId === 'A0'));
    await act(async () => search().props.onChange({ target: { value: 'TEST' } }));
    // Open checkout again before switching, and verify it cannot carry state to B.
    await act(async () => s.renderer.root.findAll(node => node.props.product?.id === product.id && node.props.onAddToCart)[0].props.onAddToCart(product));
    await act(async () => search().props.onChange({ target: { value: 'TEST' } }));
    await act(async () => s.renderer.root.findAllByType('button').find(node => node.props.onClick?.name === 'handleProcessSaleClick').props.onClick());
    await act(async () => s.header().props.onRequestStores());
    await act(async () => s.header().props.onSwitchStore('A1'));
    assert.equal(s.renderer.root.findAllByType(s.PaymentModal).length, 0);
    assert.equal(search().props.value, 'TEST');
    assert.equal(s.live('customers').length, 0);
  } finally { await s.cleanup(); }
});

test('real POS report waits for requested data and disappears when its store changes', async () => {
  const s = await session({ realPos: true }); try {
    const text = node => typeof node === 'string' ? node : (node.children || []).map(text).join('');
    const button = label => s.renderer.root.findAllByType('button').find(node => text(node).includes(label));
    await act(async () => button('Panel de Control POS').props.onClick());
    s.control.pause = true;
    await act(async () => button('Reporte Diario').props.onClick());
    assert.ok(s.renderer.root.findAllByProps({ role: 'status' }).some(node => text(node).includes('Cargando datos')));
    assert.equal(s.live('sales').length, 1); assert.equal(s.live('dailyNotes').length, 1);
    await act(async () => { for (const name of ['sales', 'layaways', 'incidents', 'dailyNotes']) { const c = s.live(name)[0]; c.apply(s.snapshot(c.q)); } });
    assert.ok(JSON.stringify(s.renderer.toJSON()).includes('Reporte de Caja'));
    s.control.pause = false;
    await act(async () => s.header().props.onRequestStores());
    await act(async () => s.header().props.onSwitchStore('A1'));
    assert.equal(s.live('sales').length, 0); assert.equal(s.live('dailyNotes').length, 0);
    assert.ok(!JSON.stringify(s.renderer.toJSON()).includes('Reporte de Caja'));
  } finally { await s.cleanup(); }
});

test('real checkout autocompletes late customers without overwriting manual names and waits for tenant-filtered vouchers', async () => {
  const s = await session({ realPos: true }); try {
    const product = s.records.get('inventory')[0];
    await act(async () => s.renderer.root.findAll(node => node.props.product?.id === product.id && node.props.onAddToCart)[0].props.onAddToCart(product));
    s.control.pause = true;
    await act(async () => s.renderer.root.findAllByType('button').find(node => node.props.onClick?.name === 'handleProcessSaleClick').props.onClick());
    const modal = () => s.renderer.root.findByType(s.PaymentModal);
    const input = placeholder => modal().findByProps({ placeholder });
    await act(async () => input('Celular (10 dígitos)').props.onChange({ target: { value: '3001234567' } }));
    const customer = s.live('customers')[0];
    await act(async () => customer.apply(s.snapshot(customer.q)));
    const name = () => modal().findAllByType('input').find(node => node.props.value === 'Known' || node.props.value === 'Manual');
    assert.ok(name(), 'name fills when delayed customer snapshot arrives');
    await act(async () => name().props.onChange({ target: { value: 'Manual' } }));
    await act(async () => customer.apply(s.snapshot(customer.q)));
    assert.equal(name().props.value, 'Manual');
    const code = input('COD. BONO');
    await act(async () => { code.props.onFocus(); code.props.onChange({ target: { value: 'TEST-BONO' } }); });
    assert.equal(s.live('giftVouchers').length, 1);
    const redeem = () => modal().findAllByType('button').find(node => node.children.includes('Redimir'));
    assert.equal(redeem().props.disabled, true);
    assert.ok(!JSON.stringify(s.renderer.toJSON()).includes('no encontrado'));
    const vouchers = s.live('giftVouchers')[0];
    await act(async () => vouchers.apply({ metadata: { fromCache: false }, docs: [
      { id: 'foreign', data: () => ({ companyId: 'B', storeId: 'B0', code: 'TEST-BONO', currentValue: 999, status: 'active' }) },
      ...s.snapshot(vouchers.q).docs,
    ] }));
    assert.deepEqual(modal().props.giftVouchers.map(v => v.id), ['voucher']);
    assert.equal(redeem().props.disabled, false);
    await act(async () => redeem().props.onClick());
    assert.ok(JSON.stringify(s.renderer.toJSON()).includes('TEST-BONO'));
    assert.equal(s.live('sales').length, 0, 'voucher redemption does not require loading sales history');
  } finally { await s.cleanup(); }
});

test('re-enabling a historical collection after module navigation starts pending even if an old snapshot was synchronized', async () => {
  const s = await session(); try {
    const previousVisit = s.pos().onRequestData;
    await act(async () => s.header().props.setCurrentView(s.View.INVENTORY));
    assert.equal(s.live('sales').length, 1);
    await act(async () => s.header().props.setCurrentView(s.View.POS));
    assert.equal(s.live('sales').length, 0);
    await act(async () => previousVisit(['sales', 'customers']));
    assert.equal(s.live('sales').length, 0); assert.equal(s.live('customers').length, 0);
    s.control.pause = true;
    await act(async () => s.pos().onRequestData(['sales']));
    assert.equal(s.pos().dataStatus.sales.loading, true);
    const query = s.live('sales')[0];
    await act(async () => query.apply(s.snapshot(query.q)));
    assert.equal(s.pos().dataStatus.sales.loading, false);
  } finally { await s.cleanup(); }
});

test('real POS preserves category and business order across stores and requests only the new store history for an already selected order', async () => {
  const s = await session({ realPos: true }); try {
    const text = node => typeof node === 'string' ? node : (node.children || []).map(text).join('');
    const button = label => s.renderer.root.findAllByType('button').find(node => text(node).includes(label));
    await act(async () => button('Inteligente').props.onClick());
    await act(async () => button('Test').props.onClick());
    assert.equal(s.live('sales').length, 1);
    await act(async () => s.header().props.onRequestStores());
    await act(async () => s.header().props.onSwitchStore('A1'));
    assert.equal(s.live('sales').length, 1);
    assert.equal(s.live('sales')[0].q.filters.find(f => f.field === 'storeId').value, 'A1');
    assert.ok(button('Inteligente').props.className.includes('bg-accent'));
    assert.ok(button('Test').props.className.includes('bg-accent'));
    assert.equal(s.live('inventory').length, 1);
  } finally { await s.cleanup(); }
});
