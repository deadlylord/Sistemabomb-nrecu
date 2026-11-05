import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { create, act } from 'react-test-renderer';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.window = { setInterval, clearInterval };
const dir = await mkdtemp(join(process.cwd(), 'tests/.layaway-grid-'));
async function bundle(entry, name, plugins = []) {
  const result = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'node', external: ['react'], plugins });
  const path = join(dir, name + '.mjs');
  await writeFile(path, result.outputFiles[0].text);
  return import(pathToFileURL(path).href);
}
const { getLayawayTiming } = await bundle('services/layawayTiming.ts', 'timing');
const { LayawayView } = await bundle('components/LayawayView.tsx', 'view', [{ name: 'modal-stub', setup(b) {
  b.onResolve({ filter: /EditLayawayModal$/ }, () => ({ path: 'modal', namespace: 'stub' }));
  b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export default () => null;' }));
} }]);
const now = new Date('2026-11-05T05:01:00Z');
const payment = (date, amount = 10000) => ({ date, amount, method: 'Efectivo', seller: 'Ana' });
const record = { id: 'old', customerName: 'Ana', customerPhone: '3001234567', invoiceNumber: 'A-1', companyId: 'test', storeId: 'store', seller: 'Ana', status: 'active', createdAt: '2026-10-01T14:00:00Z', items: [{ id: 'p', name: 'Blusa', price: 100000, quantity: 1 }], payments: [payment('2026-10-01T14:00:00Z')], totalAmount: 100000, paidAmount: 10000 };

test('counts Bogotá calendar days across midnight even when less than 24h elapsed', () => {
  const timing = getLayawayTiming({ createdAt: '2026-11-05T04:59:00Z', payments: [] }, now);
  assert.equal(timing.ageLabel, '1 día');
  assert.equal(getLayawayTiming({ createdAt: '2026-11-05T05:00:00Z', payments: [] }, now).ageLabel, '0 días');
  assert.match(timing.createdLabel, /04/);
});
test('last abono is latest positive valid payment, regardless of array order', () => {
  const timing = getLayawayTiming({ createdAt: record.createdAt, payments: [payment('2026-11-03T14:00:00Z'), payment('bad'), payment('2026-11-04T14:00:00Z', 0), payment('2026-10-01T14:00:00Z')] }, now);
  assert.equal(timing.lastPaymentAgeLabel, '2 días');
  assert.match(timing.lastPaymentLabel, /03/);
});
test('missing and future dates do not invent age or last payment', () => {
  const invalid = getLayawayTiming({ createdAt: '', payments: [] }, now);
  assert.equal(invalid.ageLabel, 'Tiempo no disponible');
  assert.equal(invalid.lastPaymentLabel, 'Sin abonos registrados');
  assert.equal(invalid.lastPaymentAgeLabel, null);
  assert.equal(getLayawayTiming({ createdAt: '2026-12-01T14:00:00Z', payments: [] }, now).ageLabel, 'Fecha futura');
});
function props(overrides = {}) { return { layaways: [record, { ...record, id: 'new', invoiceNumber: 'A-2', customerName: 'Beatriz', status: 'pre-order', createdAt: '2026-11-01T14:00:00Z' }], inventory: [], sellers: [{ id: 'u', name: 'Ana' }], currentUser: { id: 'u', name: 'Ana', roleId: 'admin' }, roles: [{ id: 'admin', name: 'Administrator' }], onAddPayment() {}, onFulfillPreOrder() {}, onDeleteLayaway() {}, onUpdateLayaway() {}, ...overrides }; }
const byLabel = (r, label) => r.root.findAllByType('button').find(b => b.children.join('') === label);

test('grid/list, oldest order and search preserve records and existing payment action', async () => {
  let r, saved;
  await act(async () => { r = create(React.createElement(LayawayView, props({ onAddPayment: (...args) => { saved = args; } }))); });
  try {
    assert.equal(byLabel(r, 'Cuadrícula').props['aria-pressed'], true);
    assert.match(JSON.stringify(r.toJSON()), /Saldo pendiente/);
    const headers = () => r.root.findAllByType('button').filter(b => b.props['aria-label']?.startsWith('Ver detalle del apartado'));
    assert.equal(headers()[0].props['aria-label'], 'Ver detalle del apartado A-2');
    await act(async () => r.root.findByType('select').props.onChange({ target: { value: 'oldest' } }));
    assert.equal(headers()[0].props['aria-label'], 'Ver detalle del apartado A-1');
    await act(async () => headers()[0].props.onClick());
    await act(async () => byLabel(r, 'Lista').props.onClick());
    assert.equal(headers()[0].props['aria-expanded'], true);
    await act(async () => byLabel(r, 'Registrar Abono').props.onClick());
    await act(async () => {
      r.root.findByProps({ id: 'paymentAmount' }).props.onChange({ target: { value: '20000' } });
      r.root.findByProps({ id: 'paymentMethod' }).props.onChange({ target: { value: 'Efectivo' } });
      r.root.findByProps({ id: 'paymentSeller' }).props.onChange({ target: { value: 'Ana' } });
    });
    await act(async () => byLabel(r, 'Confirmar').props.onClick());
    assert.deepEqual(saved, ['old', 20000, 'Efectivo', 'Ana']);
    await act(async () => r.root.findByProps({ placeholder: 'Buscar por cliente, celular o # factura...' }).props.onChange({ target: { value: 'Beatriz' } }));
    assert.equal(headers().length, 1);
    assert.equal(headers()[0].props['aria-label'], 'Ver detalle del apartado A-2');
    await act(async () => byLabel(r, 'Activos').props.onClick());
    assert.equal(headers().length, 0);
  } finally { await act(async () => r.unmount()); }
});
test('read-only cards keep details but expose no writes', async () => {
  let r;
  await act(async () => { r = create(React.createElement(LayawayView, props({ readOnly: true, layaways: [record] }))); });
  try {
    await act(async () => r.root.findByProps({ 'aria-label': 'Ver detalle del apartado A-1' }).props.onClick());
    assert.equal(byLabel(r, 'Registrar Abono'), undefined);
    assert.equal(r.root.findAllByProps({ title: 'Editar Abono' }).length, 0);
    assert.equal(r.root.findAllByProps({ title: 'Eliminar Abono Permanentemente' }).length, 0);
    assert.match(JSON.stringify(r.toJSON()), /Historial de Pagos/);
  } finally { await act(async () => r.unmount()); }
});
test.after(async () => { await rm(dir, { recursive: true, force: true }); });
