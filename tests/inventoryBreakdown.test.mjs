import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { create, act } from 'react-test-renderer';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const dir = await mkdtemp(process.cwd() + '/tests/.inventory-breakdown-');
const built = await build({
  stdin: {
    contents: "export * from './services/inventoryBreakdown'; export { default as DashboardView } from './components/DashboardView';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  external: ['react'],
  plugins: [
    {
      name: 'dashboard-stubs',
      setup(plugin) {
        plugin.onResolve({ filter: /^\.\/(SalesHistoryChart|CategorySalesChart|EditSaleModal|EditLayawayModal|DeleteConfirmationModal)$/ }, args => ({ path: args.path, namespace: 'stub' }));
        plugin.onResolve({ filter: /services\/geminiService$/ }, () => ({ path: 'gemini', namespace: 'stub' }));
        plugin.onResolve({ filter: /firebase$/ }, () => ({ path: 'firebase', namespace: 'stub' }));
        plugin.onResolve({ filter: /measuredFirestore$/ }, () => ({ path: 'measured', namespace: 'stub' }));
        plugin.onLoad({ filter: /.*/, namespace: 'stub' }, args => {
          if (args.path === 'firebase') return { contents: 'export const db = {};' };
          if (args.path === 'measured') return { contents: 'export const collection = () => ({}); export const query = () => ({}); export const where = () => ({}); export const getDocs = async () => ({ docs: [] }); export const doc = () => ({}); export const getDoc = async () => ({ exists: () => false }); export const setDoc = async () => {}; export const updateDoc = async () => {}; export const deleteDoc = async () => {}; export const writeBatch = () => ({ set(){}, update(){}, delete(){}, commit: async () => {} }); export const runTransaction = async () => {};' };
          if (args.path === 'gemini') return { contents: 'export const analyzeSalesData = async () => "";' };
          return { contents: 'export default function Stub() { return null; } export const EditSaleModal = () => null;' };
        });
      },
    },
  ],
});
await writeFile(dir + '/bundle.mjs', built.outputFiles[0].text);
const { buildInventoryBreakdown, classifyCategorySegment, DashboardView } = await import(pathToFileURL(dir + '/bundle.mjs').href);

const textOf = node => {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return textOf(node.children);
};

test('buildInventoryBreakdown groups by category and splits men vs women only when men categories exist', () => {
  assert.equal(classifyCategorySegment('Camisas Hombre'), 'men');
  assert.equal(classifyCategorySegment('Caballero'), 'men');
  assert.equal(classifyCategorySegment('Blusas'), 'women');

  const categories = [
    { id: 'c1', name: 'Blusas' },
    { id: 'c2', name: 'Camisas Hombre' },
    { id: 'c3', name: 'Jeans' },
  ];
  const products = [
    { id: 'p1', categoryId: 'c1', stock: 4, warehouseUnits: 2, cost: 20000 }, // 120,000 (6 uds)
    { id: 'p2', categoryId: 'c2', stock: 3, warehouseUnits: 1, cost: 30000 }, // 120,000 (4 uds)
    { id: 'p3', categoryId: 'c3', stock: 2, warehouseUnits: 0, cost: 50000 }, // 100,000 (2 uds)
    { id: 'p4', categoryId: 'c1', stock: 9, warehouseUnits: 0, cost: 99999, isDisabled: true }, // ignored
  ];

  const withMen = buildInventoryBreakdown(products, categories);
  assert.equal(withMen.totalValue, 340000);
  assert.equal(withMen.totalUnits, 12);
  assert.equal(withMen.hasMenCategories, true);
  assert.equal(withMen.segments.men.value, 120000);
  assert.equal(withMen.segments.men.units, 4);
  assert.equal(withMen.segments.women.value, 220000);
  assert.equal(withMen.segments.women.units, 8);
  assert.equal(withMen.categories[0].name, 'Blusas');
  assert.equal(withMen.categories[0].warehouseUnits, 2);

  const womenOnly = buildInventoryBreakdown([products[0], products[2]], categories);
  assert.equal(womenOnly.hasMenCategories, false);
  assert.equal(womenOnly.segments, null);
});

test('DashboardView loads inventory breakdown only on click and caches per store without extra reads', async () => {
  const prevLocal = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  let loadCalls = 0;
  let renderer;
  try {
    await act(async () => {
      renderer = create(React.createElement(DashboardView, {
        companyId: 'co',
        stores: [{ id: 'st', companyId: 'co', name: 'Centro' }],
        allLayaways: [],
        allIncidents: [],
        currentUser: { id: 'u1', name: 'Admin', roleId: 'r1', storeId: 'st', companyId: 'co' },
        roles: [{ id: 'r1', name: 'Administrador', companyId: 'co', userType: 'admin', permissions: ['dashboard'] }],
        onSwitchStore: () => {},
        onNavigate: () => {},
        onOpenReports: () => {},
        sales: [],
        layaways: [],
        expenses: [],
        inventory: [],
        allSales: [],
        allInventory: [],
        categories: [
          { id: 'c1', name: 'Vestidos' },
          { id: 'c2', name: 'Pantalones Hombre' },
        ],
        sellers: [],
        dailyNotes: [],
        currentStore: { id: 'st', companyId: 'co', name: 'Centro' },
        onUpdateSale: async () => {},
        onUpdateLayaway: async () => {},
        onDeleteSale: async () => {},
        onReprintSale: () => {},
        onOpenVerification: () => {},
        purchases: [],
        inventorySummary: { value: 250000 },
        onInventoryRequest: () => {},
        inventoryStatus: { loading: false, error: '', editReady: false },
        onLoadInventoryBreakdown: async () => {
          loadCalls++;
          return [
            { id: 'p1', storeId: 'st', companyId: 'co', categoryId: 'c1', stock: 3, warehouseUnits: 0, cost: 50000 },
            { id: 'p2', storeId: 'st', companyId: 'co', categoryId: 'c2', stock: 2, warehouseUnits: 0, cost: 50000 },
          ];
        },
      }));
    });

    assert.equal(loadCalls, 0);
    const invBtn = renderer.root.findAllByType('button').find(b => textOf(b).includes('Valor del inventario'));
    await act(async () => invBtn.props.onClick());
    assert.equal(loadCalls, 1);

    const expandedText = textOf(renderer.toJSON());
    assert.match(expandedText, /Categorías Hombre/);
    assert.match(expandedText, /Categorías Mujer/);
    assert.match(expandedText, /Vestidos/);
    assert.match(expandedText, /Pantalones Hombre/);

    // Collapse and reopen: must reuse cached rows without calling onLoadInventoryBreakdown again
    await act(async () => invBtn.props.onClick());
    await act(async () => invBtn.props.onClick());
    assert.equal(loadCalls, 1);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    globalThis.localStorage = prevLocal;
  }
});

test.after(async () => rm(dir, { recursive: true, force: true }));
