import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { create, act } from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { renderToStaticMarkup } from 'react-dom/server';
import { getInventoryCategorySummary } from '../services/inventoryCategories.ts';

const products = [
  { id: 'a', categoryId: 'shirts', stock: 0, storeId: 's1' },
  { id: 'b', categoryId: 'jeans', stock: '5', storeId: 's1' },
  { id: 'c', categoryId: 'jeans', stock: undefined, storeId: 's1' },
  { id: 'd', categoryId: 'lost', stock: -2, storeId: 's1' },
  { id: 'e', categoryId: 'shirts', stock: 100, isDisabled: true, storeId: 's1' },
];
const categories = [{ id: 'shirts', name: 'Camisas' }, { id: 'jeans', name: 'Jeans' }];

test('verification keeps zero stock and orphan categories, handles missing/string stock and excludes disabled products', () => {
  const result = getInventoryCategorySummary(products, categories);
  assert.equal(result.find(c => c.id === 'shirts').totalStock, 0);
  assert.equal(result.find(c => c.id === 'shirts').productCount, 1);
  assert.equal(result.find(c => c.id === 'jeans').totalStock, 5);
  assert.equal(result.find(c => c.id === 'lost').totalStock, -2);
  assert.equal(result.length, 3);
});

test('verification hides zero totals per store, keeps negatives, blocks empty/loading/error saves; zero-total checkout still shows payment methods', async () => {
  const dir = await mkdtemp(fileURLToPath(new URL('./.verification-', import.meta.url)));
  try {
    const bundle = await build({
      bundle: true, write: false, format: 'esm', platform: 'node', external: ['react'],
      stdin: { contents: `export { InventoryVerificationModal } from './components/InventoryVerificationModal'; export { default as PaymentModal } from './components/PaymentModal';`, resolveDir: process.cwd() },
      plugins: [{ name: 'omit-detail-dialog', setup(builder) {
        builder.onResolve({ filter: /DetailedInventoryVerificationModal$/ }, () => ({ path: 'detail', namespace: 'stub' }));
        builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export default function Detail() { return null; }' }));
      } }]
    });
    const path = join(dir, 'components.mjs');
    await writeFile(path, bundle.outputFiles[0].text);
    const { InventoryVerificationModal, PaymentModal } = await import(pathToFileURL(path).href);
    const props = { inventory: [...products, { id: 'other', categoryId: 'foreign', stock: 30, storeId: 's2' }], categories, sellers: [], isOpen: true, isAdmin: true, currentStore: { id: 's1' } };
    const render = overrides => renderToStaticMarkup(React.createElement(InventoryVerificationModal, { ...props, ...overrides }));
    assert.doesNotMatch(render(), /Camisas/);
    assert.match(render(), /Jeans/);
    assert.match(render(), /Categoría no encontrada/);
    assert.doesNotMatch(render(), /foreign/);
    assert.doesNotMatch(render({ inventory: [products[0], { id: 'other-shirt', categoryId: 'shirts', stock: 30, storeId: 's2' }] }), /Camisas/);
    assert.doesNotMatch(render({ inventory: [{ id: 'positive', categoryId: 'shirts', stock: 3, storeId: 's1' }, { id: 'negative', categoryId: 'shirts', stock: -3, storeId: 's1' }] }), /Camisas/);
    assert.match(render({ currentStore: { id: 's2' }, inventory: [{ id: 'own', categoryId: 'shirts', stock: 30, storeId: 's2' }, products[0]] }), /Camisas/);
    for (const overrides of [{ inventory: [] }, { inventory: [products[0]] }, { isLoadingInventory: true }, { inventoryError: 'No se pudo cargar' }]) {
      const markup = render(overrides);
      assert.match(markup, /role="status"/);
      assert.match(markup, /<button[^>]*disabled=""[^>]*>[\s\S]*?Guardar y Aplicar Stock/);
    }
    let saved;
    let renderer;
    await act(async () => { renderer = create(React.createElement(InventoryVerificationModal, {
      ...props, sellers: [{ id: 'seller', name: 'Carlos' }], onClose: () => {},
      onSaveStockTake: async data => { saved = data; }
    })); });
    const buttons = renderer.root.findAllByType('button');
    await act(async () => { buttons.find(button => button.children.includes('Carlos')).props.onClick(); });
    const jeansRow = renderer.root.findAllByType('tr').find(row => row.findAllByType('p').some(p => p.children.includes('Jeans')));
    const countInput = jeansRow.findByType('input');
    await act(async () => { countInput.props.onChange({ target: { value: '0' } }); });
    const save = renderer.root.findAllByType('button').find(button => button.findAllByType('span').some(span => span.children.includes('Guardar y Aplicar Stock')));
    await act(async () => { await save.props.onClick(); });
    assert.equal(saved.verification.length, 1, 'unentered categories must not be recorded as zero');
    assert.equal(saved.verification[0].categoryId, 'jeans');
    assert.equal(saved.verification[0].physicalCount, 0, 'an explicitly entered zero is valid');
    assert.deepEqual(saved.productCounts, {}, 'category review must not overwrite product stocks');
    await act(async () => { renderer.unmount(); });
    for (const total of [0, 10000]) {
      const markup = renderToStaticMarkup(React.createElement(PaymentModal, { isOpen: true, total, sellers: [], customers: [], giftVouchers: [], saleDate: new Date(), initialCustomerInfo: null }));
      assert.match(markup, /Método de Pago/);
      assert.match(markup, /Efectivo/);
      assert.match(markup, /QR/);
      if (total === 0) assert.match(markup, /La venta tiene total cero/);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
