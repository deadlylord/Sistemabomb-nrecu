import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

const source = await readFile(new URL('../components/App.tsx', import.meta.url), 'utf8');
const handlers = source.slice(source.indexOf('  const handleUpdatePurchase ='), source.indexOf('  const assertCategoryAccess ='));
const { code } = await transform(handlers, { loader: 'ts' });

function fixture(stock) {
  const purchase = { id: 'p', companyId: 'co', storeId: 's', productId: 'i', quantity: 5, productName: 'Blusa' };
  const rows = new Map([['purchases/p', purchase], ['inventory/i', { companyId: 'co', storeId: 's', stock, warehouseUnits: 4 }]]);
  const scope = {
    db: {}, currentUser: { name: 'Administrador' }, operationalCompanyId: 'co', visibleStoreIds: new Set(['s']),
    purchases: [purchase], window: { confirm: () => true }, alert: message => alerts.push(message),
    doc: (_db, collection, id = 'log') => collection + '/' + id,
    collection: (_, name) => name,
    increment: delta => ({ increment: delta }),
    assertTenantData() {},
    ProductChangeType: { PURCHASE_EDIT: 'edit', PURCHASE_DELETE: 'delete' },
    async runTransaction(_db, work) {
      const writes = [];
      await work({
        get: async ref => ({ exists: () => rows.has(ref), data: () => rows.get(ref) }),
        update: (ref, fields) => writes.push(() => {
          const before = rows.get(ref);
          const after = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value?.increment === undefined ? value : before[key] + value.increment]));
          rows.set(ref, { ...before, ...after });
        }),
        delete: ref => writes.push(() => rows.delete(ref)),
        set: (ref, value) => writes.push(() => rows.set(ref, value)),
      });
      for (const write of writes) write();
    },
  };
  const alerts = [];
  const operations = new Function(...Object.keys(scope), code + '\nreturn { handleUpdatePurchase, handleDeletePurchase };')(...Object.values(scope));
  return { ...operations, rows, purchase, alerts };
}

test('correcting a purchase after dispatch cannot subtract unavailable store stock', async () => {
  const f = fixture(1);
  await assert.rejects(f.handleUpdatePurchase({ ...f.purchase, quantity: 2 }, 5, 30), /unidades suficientes/);
  await f.handleDeletePurchase('p');
  assert.match(f.alerts[0], /unidades suficientes/);
  assert.equal(f.rows.get('purchases/p').quantity, 5);
  assert.deepEqual(f.rows.get('inventory/i'), { companyId: 'co', storeId: 's', stock: 1, warehouseUnits: 4 });
  assert.equal(f.rows.has('productHistory/log'), false);
});

test('purchase corrections succeed with store stock available and repeat deletion is safe', async () => {
  const f = fixture(5);
  await f.handleUpdatePurchase({ ...f.purchase, quantity: 3 }, 5, 30);
  assert.equal(f.rows.get('inventory/i').stock, 3);
  assert.equal(f.rows.get('purchases/p').quantity, 3);
  await f.handleDeletePurchase('p');
  await f.handleDeletePurchase('p');
  assert.equal(f.rows.get('inventory/i').stock, 0);
  assert.equal(f.rows.get('inventory/i').warehouseUnits, 4);
  assert.equal(f.rows.has('purchases/p'), false);
  assert.deepEqual(f.alerts, []);
});
