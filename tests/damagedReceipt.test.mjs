import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { transform } from 'esbuild';
import { readFile } from 'node:fs/promises';
const bundled = await build({ stdin: { contents: "export { planDamagedReceipt } from './services/damagedReceipt'; export { IncidentType, IncidentStatus } from './types';", resolveDir: process.cwd() }, bundle: true, format: 'esm', platform: 'node', write: false });
const { planDamagedReceipt, IncidentType, IncidentStatus } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));

const incident = { id: 'incident', companyId: 'company', storeId: 'store', productId: 'old', productName: 'Blusa original', type: IncidentType.DAMAGED, status: IncidentStatus.EN_ARREGLO_CAMBIO, history: [{ notes: 'Enviada', status: IncidentStatus.EN_ARREGLO_CAMBIO }] };
const product = { id: 'new', name: 'Prenda recibida', companyId: 'company', storeId: 'store', stock: 3 };
const plan = (record = incident, item = product, admin = true) => planDamagedReceipt(record, item, 'company', 'store', admin, 'Admin', '2026-10-10T22:00:00Z');

test('replacement credits only the received product and preserves the original identity and history', () => {
  const result = plan();
  assert.equal(result.productId, 'new');
  assert.equal(result.update.damagedReceipt.productId, 'new');
  assert.equal(result.update.status, IncidentStatus.DEVUELTO_Y_RESUELTO);
  assert.equal(result.update.history.length, 2);
  assert.equal(incident.productId, 'old');
  assert.equal(result.update.productId, undefined);
  assert.match(result.notes, /original permanece descontada/);
});

test('same garment works for a seller; replacement requires administrator access', () => {
  assert.equal(plan(incident, { ...product, id: 'old' }, false).productId, 'old');
  assert.throws(() => plan(incident, product, false), /administrador/);
});

test('repeated reception is idempotent, a second different product cannot be credited', () => {
  const result = plan();
  const saved = { ...incident, ...result.update };
  assert.equal(plan(saved), null);
  assert.throws(() => plan(saved, { ...product, id: 'third' }), /ya fue recibida/);
});

test('other companies, other stores, disabled products and invalid statuses cannot modify stock', () => {
  assert.throws(() => plan(incident, { ...product, companyId: 'other' }), /empresa y sede/);
  assert.throws(() => plan(incident, { ...product, storeId: 'other' }), /empresa y sede/);
  assert.throws(() => plan({ ...incident, companyId: 'other' }), /empresa y sede/);
  assert.throws(() => plan(incident, { ...product, isDisabled: true }), /desactivada/);
  assert.throws(() => plan({ ...incident, status: IncidentStatus.DAÑADO_REPORTADO }), /no está en arreglo/);
});

test('actual reception handler commits stock, receipt and audit together and repeat submission changes nothing', async () => {
  const source = await readFile('components/App.tsx', 'utf8');
  const section = source.slice(source.indexOf('  const handleResolveIncident ='), source.indexOf('  const handleUpdateIncident ='));
  const { code } = await transform(section, { loader: 'ts' });
  const rows = new Map([
    ['incidents/incident', structuredClone(incident)],
    ['inventory/old', { ...product, id: 'old', stock: 0 }],
    ['inventory/new', structuredClone(product)]
  ]);
  let id = 0, commits = 0;
  const scope = {
    incidents: [incident], currentUser: { name: 'Admin' }, currentStoreId: 'store',
    recordReadOnly: false, operationContextRef: { current: 'scope' }, contextAtRender: 'scope',
    operationalCompanyId: 'company', isAdmin: true, isDeveloper: false,
    planDamagedReceipt, IncidentType, IncidentStatus, ProductChangeType: { DAMAGED_RETURNED: 'Devolución' },
    db: {}, collection: (_, name) => name,
    doc: (...args) => args.length === 1 ? { path: `productHistory/log${++id}`, id: `log${id}` } : { path: `${args[1]}/${args[2]}`, id: args[2] },
    increment: value => ({ increment: value }),
    runTransaction: async (_, fn) => {
      const writes = [];
      await fn({
        get: async ref => ({ exists: () => rows.has(ref.path), data: () => structuredClone(rows.get(ref.path)) }),
        update: (ref, data) => writes.push([ref.path, data]),
        set: (ref, data) => writes.push([ref.path, data])
      });
      if (writes.length) {
        assert.equal(writes.length, 3);
        for (const [path, data] of writes) {
          const previous = rows.get(path) || {};
          rows.set(path, { ...previous, ...data, ...(data.stock?.increment ? { stock: previous.stock + data.stock.increment } : {}) });
        }
        commits++;
      }
    }
  };
  const handler = new Function('scope', `with (scope) { ${code}; return handleResolveIncident; }`)(scope);
  await handler('incident', 'new');
  await handler('incident', 'new');
  assert.equal(rows.get('inventory/old').stock, 0);
  assert.equal(rows.get('inventory/new').stock, 4);
  assert.equal(rows.get('incidents/incident').productId, 'old');
  assert.equal(rows.get('incidents/incident').damagedReceipt.productId, 'new');
  assert.equal(commits, 1);
  scope.operationContextRef.current = 'other-store';
  await assert.rejects(handler('incident', 'new'), /sede cambió/);
});
