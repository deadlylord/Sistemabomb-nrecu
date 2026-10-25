import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { transform } from 'esbuild';
import { readFile } from 'node:fs/promises';

const bundled = await build({
  stdin: { contents: "export { calculateProductHistoryBalances, getProductHistoryStockDelta } from './services/productHistoryBalance'; export { ProductChangeType } from './types';", resolveDir: process.cwd() },
  bundle: true, format: 'esm', platform: 'node', write: false,
});
const { calculateProductHistoryBalances, getProductHistoryStockDelta, ProductChangeType: T } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const log = (changeType, details, timestamp, stockDelta) => ({ id: `${changeType}-${timestamp}`, productId: 'p', productName: 'Blusa', storeId: 's', changedBy: 'Test', changeType, details, timestamp, ...(stockDelta === undefined ? {} : { stockDelta }) });

test('reconstructs stock through damaged returns, purchase deletion, transfer reversals, and layaway cancellation', () => {
  const logs = [
    log(T.CREATED, 'Creación de producto. Stock inicial: 5', '2026-01-01T00:00:00Z'),
    log(T.SALE, 'Venta #4. Cantidad: -2.', '2026-01-02T00:00:00Z'),
    log(T.DAMAGED, 'Prenda reportada como dañada. Stock rebajado: -1.', '2026-01-03T00:00:00Z'),
    log(T.DAMAGED_RETURNED, 'Recibida la misma prenda. Stock: +1.', '2026-01-04T00:00:00Z'),
    log(T.PURCHASE_DELETE, 'Compra eliminada. Se restaron 2 unidades.', '2026-01-05T00:00:00Z'),
    log(T.TRANSFER_DELETED, '+1 devuelta por reversión.', '2026-01-06T00:00:00Z'),
    log(T.LAYAWAY_DELETED, 'Abono eliminado. Stock devuelto: +1', '2026-01-07T00:00:00Z'),
  ];
  const balances = calculateProductHistoryBalances(logs, 3);
  assert.deepEqual(balances.map(row => row.balanceAfter), [3, 2, 1, 3, 2, 3, 5]);
});

test('sale edits carry a per-product delta and legacy entries without quantities stop claiming exact balances', () => {
  assert.equal(getProductHistoryStockDelta(log(T.RETURN, 'Factura #2 editada. Ajuste de stock: -1.', '2026-01-02T00:00:00Z')), -1);
  const balances = calculateProductHistoryBalances([
    log(T.CREATED, 'Stock inicial: 4', '2026-01-01T00:00:00Z'),
    log(T.RETURN, 'Factura #2 editada. Inventario ajustado.', '2026-01-02T00:00:00Z'),
  ], 5);
  assert.deepEqual(balances.map(row => row.balanceAfter), [5, null]);
});

test('editing a sale records one signed stock movement per changed product', async () => {
  const source = await readFile('components/App.tsx', 'utf8');
  const section = source.slice(source.indexOf('  const handleUpdateSale ='), source.indexOf('  const handleDeleteSale ='));
  const { code } = await transform(section, { loader: 'ts' });
  const writes = [];
  let nextId = 0;
  const scope = {
    summaryInventoryMode: false, currentUser: { name: 'Admin' }, inventory: [{ id: 'p' }, { id: 'q' }], globalInventoryForSearch: [], giftVouchers: [],
    ProductChangeType: T, PaymentMethod: {}, cleanObject: value => value, increment: value => ({ increment: value }),
    db: {}, collection: (_, name) => name,
    doc: (...args) => args.length === 1 ? { path: `${args[0]}/log-${++nextId}`, id: `log-${nextId}` } : { path: `${args[1]}/${args[2]}`, id: args[2] },
    writeBatch: () => ({ update: (ref, data) => writes.push({ op: 'update', path: ref.path, data }), set: (ref, data) => writes.push({ op: 'set', path: ref.path, data }), commit: async () => {} }),
  };
  const handleUpdateSale = new Function('scope', `with (scope) { ${code}; return handleUpdateSale; }`)(scope);
  const item = (id, quantity) => ({ id, name: `Producto ${id}`, quantity, price: 10 });
  await handleUpdateSale({ id: 'sale', invoiceNumber: 7, storeId: 's', items: [item('p', 2), item('q', 1)] }, { id: 'sale', invoiceNumber: 7, storeId: 's', items: [item('p', 1), item('q', 2)] });
  const logs = writes.filter(write => write.op === 'set' && write.path.startsWith('productHistory/')).map(write => write.data);
  assert.deepEqual(logs.map(entry => [entry.productId, entry.stockDelta]).sort(), [['p', -1], ['q', 1]]);
});
