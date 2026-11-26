import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import React from 'react';
import { create, act } from 'react-test-renderer';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const storage = new Map();
globalThis.sessionStorage = {
  getItem: k => storage.get(k) || null,
  setItem: (k, v) => storage.set(k, v),
  removeItem: k => storage.delete(k),
};

const dir = await mkdtemp(process.cwd() + '/tests/.warehouse-consolidated-');
const built = await build({
  stdin: {
    contents: "export { default as WarehousePanel } from './components/WarehousePanel'; export { default as InventoryWarehouseSection } from './components/InventoryWarehouseSection'; export { default as Header } from './components/Header'; export { default as PurchasesView } from './components/PurchasesView'; export { View } from './types';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  external: ['react'],
  plugins: [{
    name: 'warehouse-api-stub',
    setup(plugin) {
      plugin.onResolve({ filter: /services\/warehouse$/ }, () => ({ path: 'warehouse-api', namespace: 'stub' }));
      plugin.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
        contents: 'export const callWarehouse = (...args) => globalThis.__warehouseTestApi(...args); export const warehouseEnabled = globalThis.__warehouseEnabledTest !== false;',
      }));
    },
  }],
});
await writeFile(dir + '/bundle.mjs', built.outputFiles[0].text);
const { WarehousePanel, InventoryWarehouseSection, Header, PurchasesView, View } = await import(pathToFileURL(dir + '/bundle.mjs').href);

const textOf = node => {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return textOf(node.children);
};

test('WarehousePanel purchase mode supports preselected IDs and Select All / Clear buttons', async () => {
  storage.clear();
  const calls = [];
  const api = async (companyId, storeId, data) => {
    calls.push([companyId, storeId, data]);
    return { purchaseIds: data.entries.map(e => e.purchaseId) };
  };
  let moved = [];
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(WarehousePanel, {
      userId: 'u1',
      companyId: 'co',
      store: { id: 'st', companyId: 'co', name: 'Sede Norte' },
      inventory: [
        { id: 'p1', companyId: 'co', storeId: 'st', name: 'Blusa', stock: 10, warehouseUnits: 2 },
        { id: 'p2', companyId: 'co', storeId: 'st', name: 'Jean', stock: 6, warehouseUnits: 0 },
      ],
      categories: [{ id: 'cat', name: 'Ropa' }],
      isAdmin: true,
      mode: 'purchase',
      purchases: [
        { id: 'pur1', productId: 'p1', productName: 'Blusa', quantity: 4, storeId: 'st' },
        { id: 'pur2', productId: 'p2', productName: 'Jean', quantity: 3, storeId: 'st' },
      ],
      initialSelectedIds: ['pur1'],
      onPurchasesMoved: ids => { moved = ids; },
      onClose() {},
      api,
    }));
  });
  try {
    assert.equal(calls.length, 0);
    const checkboxes = () => renderer.root.findAllByProps({ type: 'checkbox' });
    assert.equal(checkboxes()[0].props.checked, true);
    assert.equal(checkboxes()[1].props.checked, false);

    const selectAllBtn = renderer.root.findAllByType('button').find(b => textOf(b).includes('Seleccionar todo'));
    await act(async () => selectAllBtn.props.onClick());
    assert.equal(checkboxes()[0].props.checked, true);
    assert.equal(checkboxes()[1].props.checked, true);

    await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
    assert.deepEqual(calls[0][2].entries, [
      { purchaseId: 'pur1', quantity: 4 },
      { purchaseId: 'pur2', quantity: 3 },
    ]);
    assert.deepEqual(moved, ['pur1', 'pur2']);
  } finally {
    await act(async () => renderer.unmount());
  }
});

test('InventoryWarehouseSection consolidates stock with zero reads and loads history/counts only on demand for admin', async () => {
  storage.clear();
  const calls = [];
  globalThis.__warehouseTestApi = async (companyId, storeId, data) => {
    calls.push([companyId, storeId, data.action]);
    return { rows: [], cursor: null };
  };
  const movedActions = [];
  let countOpened = false;
  let renderer;
  const inventory = [
    { id: 'p1', sku: 'SKU-1', companyId: 'co', storeId: 'st', categoryId: 'c1', name: 'Camisa', supplier: 'Marca A', stock: 5, warehouseUnits: 4, cost: 20000 },
    { id: 'p2', sku: 'SKU-2', companyId: 'co', storeId: 'st', categoryId: 'c1', name: 'Pantalón', supplier: 'Marca B', stock: 3, warehouseUnits: 0, cost: 30000 },
    { id: 'p3', sku: 'SKU-3', companyId: 'other', storeId: 'st', categoryId: 'c1', name: 'Ajeno', supplier: 'X', stock: 9, warehouseUnits: 9, cost: 10000 },
  ];
  await act(async () => {
    renderer = create(React.createElement(InventoryWarehouseSection, {
      config: {
        userId: 'u1',
        companyId: 'co',
        store: { id: 'st', companyId: 'co', name: 'Centro' },
        isAdmin: true,
        canConfigure: true,
        onMoveWarehouse: (product, dir) => movedActions.push([product.id, dir]),
        onOpenCount: () => { countOpened = true; },
      },
      inventory,
      categories: [{ id: 'c1', name: 'Camisas' }],
    }));
  });
  try {
    assert.equal(calls.length, 0);
    const renderedText = JSON.stringify(renderer.toJSON());
    assert.match(renderedText, /Camisa/);
    assert.doesNotMatch(renderedText, /Ajeno/);
    assert.doesNotMatch(renderedText, /Pantalón/);

    const returnBtn = renderer.root.findAllByType('button').find(b => textOf(b).includes('→ Tienda'));
    await act(async () => returnBtn.props.onClick());
    assert.deepEqual(movedActions, [['p1', 'toStore']]);

    const countBtn = renderer.root.findAllByType('button').find(b => textOf(b).includes('Conteo de bodega'));
    await act(async () => countBtn.props.onClick());
    assert.equal(countOpened, true);

    const historyTab = renderer.root.findAllByType('button').find(b => textOf(b).includes('Movimientos (30 días)'));
    await act(async () => historyTab.props.onClick());
    assert.deepEqual(calls, [['co', 'st', 'history']]);

    const countsTab = renderer.root.findAllByType('button').find(b => textOf(b).includes('Conteos guardados'));
    await act(async () => countsTab.props.onClick());
    assert.deepEqual(calls, [['co', 'st', 'history'], ['co', 'st', 'counts']]);
  } finally {
    delete globalThis.__warehouseTestApi;
    await act(async () => renderer.unmount());
  }
});

test('Header hides Bodega in Inventario menu from sellers even with View.WAREHOUSE, and shows it to admins', async () => {
  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  const prevLocal = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  globalThis.document = {
    addEventListener: () => {},
    removeEventListener: () => {},
    documentElement: { style: { setProperty: () => {}, removeProperty: () => {} } },
  };
  globalThis.window = { innerWidth: 390 };

  let navigatedView = null;
  let renderer;
  try {
    // 1. Seller even WITH View.WAREHOUSE must NOT see Bodega in Inventario menu
    await act(async () => {
      renderer = create(React.createElement(Header, {
        currentView: View.INVENTORY,
        setCurrentView: v => { navigatedView = v; },
        theme: 'dark',
        toggleTheme: () => {},
        currentUser: { id: 'u1', name: 'Vendedor', roleId: 'r1', storeId: 'st', companyId: 'co', userType: 'seller' },
        currentStore: { id: 'st', name: 'Metro', companyId: 'co' },
        currentCompany: { id: 'co', name: 'Empresa' },
        userPermissions: [View.POS, View.INVENTORY, View.PURCHASES, View.WAREHOUSE],
        onLogout: () => {},
        stores: [{ id: 'st', name: 'Metro', companyId: 'co' }],
        onSwitchStore: () => {},
        roles: [{ id: 'r1', name: 'Vendedor', companyId: 'co', userType: 'seller', permissions: [View.POS, View.INVENTORY, View.WAREHOUSE] }],
        isGlobalMode: false,
        onToggleGlobalMode: () => {},
        incidents: [],
        onOpenBriefing: () => {},
        isDeveloper: false,
      }));
    });
    assert.equal(renderer.root.findAllByType('button').filter(b => textOf(b).includes('Bodega')).length, 0);
    await act(async () => renderer.unmount());

    // 2. Admin sees Bodega in Inventario menu and navigates to View.WAREHOUSE
    await act(async () => {
      renderer = create(React.createElement(Header, {
        currentView: View.INVENTORY,
        setCurrentView: v => { navigatedView = v; },
        theme: 'dark',
        toggleTheme: () => {},
        currentUser: { id: 'u2', name: 'Admin', roleId: 'r2', storeId: 'st', companyId: 'co', userType: 'admin' },
        currentStore: { id: 'st', name: 'Metro', companyId: 'co' },
        currentCompany: { id: 'co', name: 'Empresa' },
        userPermissions: [View.POS, View.INVENTORY, View.PURCHASES, View.WAREHOUSE],
        onLogout: () => {},
        stores: [{ id: 'st', name: 'Metro', companyId: 'co' }],
        onSwitchStore: () => {},
        roles: [{ id: 'r2', name: 'Administrador', companyId: 'co', userType: 'admin', permissions: [View.POS, View.INVENTORY, View.WAREHOUSE] }],
        isGlobalMode: false,
        onToggleGlobalMode: () => {},
        incidents: [],
        onOpenBriefing: () => {},
        isDeveloper: false,
        isAdmin: true,
      }));
    });
    const bodegaButtons = renderer.root.findAllByType('button').filter(b => textOf(b).includes('Bodega'));
    assert.ok(bodegaButtons.length >= 1, 'Expected Bodega option in Inventario menu for admin');
    await act(async () => bodegaButtons[0].props.onClick());
    assert.equal(navigatedView, View.WAREHOUSE);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
    globalThis.localStorage = prevLocal;
  }
});

test('PurchasesView history shows persistent Bodega, Parcial and En Tienda indicators and disables resend', async () => {
  const prevLocal = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const todayIso = new Date().toISOString();
  let renderer;
  try {
    await act(async () => {
      renderer = create(React.createElement(PurchasesView, {
        warehouseAccess: { userId: 'u1', companyId: 'co', storeIds: new Set(['st']) },
        purchases: [
          {
            id: 'pur-full',
            companyId: 'co',
            productId: 'p1',
            productName: 'Chaqueta Bodega',
            quantity: 4,
            cost: 50000,
            totalCost: 200000,
            supplier: 'Marca A',
            createdAt: todayIso,
            storeId: 'st',
            warehouseUnitsSent: 4,
            warehouseSentAt: todayIso,
          },
          {
            id: 'pur-partial',
            companyId: 'co',
            productId: 'p2',
            productName: 'Jean Mixto',
            quantity: 5,
            cost: 40000,
            totalCost: 200000,
            supplier: 'Marca B',
            createdAt: todayIso,
            storeId: 'st',
            warehouseUnitsSent: 2,
            warehouseSentAt: todayIso,
          },
          {
            id: 'pur-store',
            companyId: 'co',
            productId: 'p3',
            productName: 'Camisa Tienda',
            quantity: 3,
            cost: 30000,
            totalCost: 90000,
            supplier: 'Marca C',
            createdAt: todayIso,
            storeId: 'st',
          },
        ],
        inventory: [
          { id: 'p1', sku: 'S1', companyId: 'co', storeId: 'st', categoryId: 'c1', name: 'Chaqueta Bodega', supplier: 'Marca A', stock: 0, warehouseUnits: 4, cost: 50000, price: 90000 },
          { id: 'p2', sku: 'S2', companyId: 'co', storeId: 'st', categoryId: 'c1', name: 'Jean Mixto', supplier: 'Marca B', stock: 3, warehouseUnits: 2, cost: 40000, price: 80000 },
          { id: 'p3', sku: 'S3', companyId: 'co', storeId: 'st', categoryId: 'c1', name: 'Camisa Tienda', supplier: 'Marca C', stock: 3, warehouseUnits: 0, cost: 30000, price: 60000 },
        ],
        categories: [{ id: 'c1', name: 'Ropa' }],
        stores: [{ id: 'st', companyId: 'co', name: 'Sede Norte', warehouseSendEnabled: true }],
        currentStoreId: 'st',
        onMultiStorePurchase: async () => [],
        onUpdatePurchase: async () => {},
        onDeletePurchase: () => {},
        onUpdateProduct: async () => {},
      }));
    });
    const rendered = textOf(renderer.toJSON());
    assert.match(rendered, /Enviado a Bodega/);
    assert.match(rendered, /A bodega/);
    assert.match(rendered, /2 Bodega · 3 Tienda/);
    assert.match(rendered, /2 bod\. · 3 tda\./);
    assert.match(rendered, /En Tienda/);

    // Only the store-only purchase should have an individual selection checkbox in the history table
    const rowCheckboxes = renderer.root.findAllByProps({ type: 'checkbox' }).filter(cb =>
      typeof cb.props['aria-label'] === 'string' && cb.props['aria-label'].startsWith('Seleccionar compra '),
    );
    assert.equal(rowCheckboxes.length, 1);
    assert.equal(rowCheckboxes[0].props['aria-label'], 'Seleccionar compra Camisa Tienda para bodega');
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    globalThis.localStorage = prevLocal;
  }
});

test.after(async () => rm(dir, { recursive: true, force: true }));
