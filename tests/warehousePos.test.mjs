import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { create, act } from 'react-test-renderer';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('POS warehouse uses existing store products, preserves photos, moves units and cannot sell warehouse stock', async () => {
  const dir = await mkdtemp(process.cwd() + '/tests/.warehouse-pos-');
  const globals = ['window', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement'];
  const previous = Object.fromEntries(globals.map(key => [key, globalThis[key]]));
  const handlers = new Set();
  class Element {}
  class Input extends Element { value = ''; focus() {} }
  Object.assign(globalThis, {
    HTMLElement: Element, HTMLInputElement: Input,
    HTMLTextAreaElement: class extends Element {}, HTMLSelectElement: class extends Element {},
    window: { addEventListener: (_, fn) => handlers.add(fn), removeEventListener: (_, fn) => handlers.delete(fn) }
  });
  let renderer;
  try {
    const bundle = await build({
      stdin: { contents: "export {default} from './components/PosView'; export {ViewFiltersProvider} from './services/viewFilters';", resolveDir: process.cwd() },
      bundle: true, write: false, format: 'esm', platform: 'node', external: ['react'],
      plugins: [{ name: 'unrelated-dialogs', setup(builder) {
        builder.onResolve({ filter: /^\.\/(ProductPerformanceModal|CartPanel|DailySalesReportModal|CreateIncidentModal|EditProductImageModal|SellVoucherModal|CheckVoucherModal|EditProductModal)$/ }, args => ({ path: args.path, namespace: 'stub' }));
        builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export default function Stub() { return null; }' }));
      } }]
    });
    const file = dir + '/pos.mjs';
    await writeFile(file, bundle.outputFiles[0].text);
    const { default: Pos, ViewFiltersProvider } = await import(pathToFileURL(file).href);
    const product = { id: 'p', sku: 'SKU-1', companyId: 'co', storeId: 'st', categoryId: 'cat', name: 'Blusa', supplier: 'Marca', price: 20000, stock: 3, warehouseUnits: 2, imageUrl: 'https://example.com/blusa.jpg' };
    const inventory = [product,
      { ...product, id: 'warehouse-only', name: 'Vestido', sku: 'SKU-2', stock: 0 },
      { ...product, id: 'foreign-company', name: 'Otra empresa', companyId: 'other' },
      { ...product, id: 'foreign-store', name: 'Otra sede', storeId: 'other' },
      { ...product, id: 'empty', name: 'Sin bodega', warehouseUnits: 0 },
      { ...product, id: 'disabled', name: 'Inactivo', isDisabled: true }
    ];
    const added = [], moved = [], input = new Input();
    const props = { inventory, currentStore: { id: 'st', companyId: 'co' }, categories: [], sellers: [], stores: [], sales: [], purchases: [], layaways: [], allCustomers: [], activeCart: [], heldCarts: [], dailyNotes: [], incidents: [], roles: [], giftVouchers: [], ceoNotes: [], verifiedProducts: new Set(), currentUser: { id: 'u', roleId: 'seller' }, onClearVerifications() {}, onAddToCart: p => added.push(p.id), onMoveWarehouse: (p, direction) => moved.push([p.id, direction]) };
    const screen = (updates = {}) => React.createElement(ViewFiltersProvider, null, React.createElement(Pos, { ...props, ...updates }));
    await act(async () => { renderer = create(screen(), { createNodeMock: node => node.type === 'input' ? input : null }); });
    const button = label => renderer.root.findAllByType('button').find(node => node.children.join('') === label);
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Enviar a bodega: Blusa' }).props.onClick({ stopPropagation() {} }));
    assert.deepEqual(moved, [['p', 'toWarehouse']]);
    assert.equal(added.length, 0);
    await act(async () => button('Bodega').props.onClick());
    const grid = renderer.root.findAll(node => node.props.products && node.props.warehouseView === true)[0];
    assert.deepEqual(grid.props.products.map(p => p.id), ['p', 'warehouse-only']);
    assert.equal(renderer.root.findByProps({ alt: 'Vestido' }).props.src, product.imageUrl);
    const warehouseCard = renderer.root.findAll(node => node.type === 'div' && node.props['aria-label'] === 'Vestido')[0];
    await act(async () => {
      warehouseCard.props.onClick({ target: { closest: () => null } });
      warehouseCard.props.onKeyPress({ key: 'Enter', target: { closest: () => null } });
    });
    assert.equal(added.length, 0);
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Devolver a tienda: Vestido' }).props.onClick({ stopPropagation() {} }));
    assert.deepEqual(moved.at(-1), ['warehouse-only', 'toStore']);
    const search = renderer.root.findAllByType('input').find(node => node.props.onKeyDown);
    input.value = 'SKU-1';
    await act(async () => search.props.onKeyDown({ key: 'Enter', currentTarget: input, preventDefault() {}, stopPropagation() {} }));
    await act(async () => {
      for (const key of 'SKU-1') for (const handler of handlers) handler({ key, target: new Element(), repeat: false });
      for (const handler of handlers) handler({ key: 'Enter', target: new Element(), preventDefault() {} });
    });
    assert.equal(added.length, 0);
    await act(async () => button('Todos').props.onClick());
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Agregar Blusa al carrito' }).props.onClick({ target: { closest: () => null } }));
    assert.deepEqual(added, ['p']);
    await act(async () => renderer.update(screen({ onMoveWarehouse: undefined })));
    assert.equal(button('Bodega'), undefined);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    Object.assign(globalThis, previous);
    await rm(dir, { recursive: true, force: true });
  }
});
