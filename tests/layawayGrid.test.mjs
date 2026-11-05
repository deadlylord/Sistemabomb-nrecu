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
const { colombiaBusinessDaysSince } = await bundle('services/colombiaBusinessDays.ts', 'business-days');
const { LayawayView } = await bundle('components/LayawayView.tsx', 'view', [{ name: 'modal-stub', setup(b) {
  b.onResolve({ filter: /EditLayawayModal$/ }, () => ({ path: 'modal', namespace: 'stub' }));
  b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: "import React from 'react'; export default props => React.createElement('div', { 'data-testid': 'edit-layaway-stub', modalProps: props });" }));
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
test('missing and future dates do not invent elapsed days', () => {
  const invalid = getLayawayTiming({ createdAt: '', payments: [] }, now);
  assert.equal(invalid.ageLabel, 'Tiempo no disponible');
  assert.equal(invalid.ageDays, null);
  assert.equal(getLayawayTiming({ createdAt: '2026-12-01T14:00:00Z', payments: [] }, now).ageLabel, 'Fecha futura');
});
function props(overrides = {}) { return { layaways: [record, { ...record, id: 'new', invoiceNumber: 'A-2', customerName: 'Beatriz', status: 'pre-order', createdAt: '2026-11-01T14:00:00Z' }], inventory: [], sellers: [{ id: 'u', name: 'Ana' }], currentUser: { id: 'u', name: 'Ana', roleId: 'admin', companyId: 'test', storeId: 'store' }, stores: [{ id: 'store', companyId: 'test' }], roles: [{ id: 'admin', name: 'Administrator', companyId: 'test' }], onAddPayment() {}, onFulfillPreOrder() {}, onDeleteLayaway() {}, onUpdateLayaway() {}, ...overrides }; }
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
test('compact cards show only age and one balance; red starts at 31 days', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
  const make = (id, createdAt) => ({ ...record, id, createdAt });
  let r;
  await act(async () => { r = create(React.createElement(LayawayView, props({ layaways: [
    make('30', '2026-10-06T05:00:00Z'),
    make('31', '2026-10-05T05:00:00Z'),
    make('future', '2026-12-01T05:00:00Z'),
    make('invalid', ''),
  ] }))); });
  try {
    const badges = r.root.findAllByProps({ 'data-testid': 'layaway-age' });
    const badge = label => badges.find(b => b.children.join('') === label);
    assert.doesNotMatch(badge('30 días').props.className, /text-red/);
    assert.match(badge('31 días').props.className, /text-red-600/);
    assert.doesNotMatch(badge('Fecha futura').props.className, /text-red/);
    assert.doesNotMatch(badge('Tiempo no disponible').props.className, /text-red/);
    const collapsed = JSON.stringify(r.toJSON());
    assert.doesNotMatch(collapsed, /Último abono|desde el último abono|Apartado el|Abonado:|Total:/);
    assert.equal((collapsed.match(/Saldo pendiente/g) || []).length, 4);
    await act(async () => byLabel(r, 'Lista').props.onClick());
    assert.equal((JSON.stringify(r.toJSON()).match(/Saldo pendiente/g) || []).length, 4);
  } finally { await act(async () => r.unmount()); }
});

test('edit and delete stay visible in collapsed grid/list and route the original record once', async () => {
  let r, deleted = [], updates = [];
  await act(async () => { r = create(React.createElement(LayawayView, props({ layaways: [record], onDeleteLayaway: id => deleted.push(id), onUpdateLayaway: (...args) => updates.push(args) }))); });
  try {
    for (const layout of ['Cuadrícula', 'Lista']) {
      await act(async () => byLabel(r, layout).props.onClick());
      assert.equal(r.root.findByProps({ 'aria-label': 'Ver detalle del apartado A-1' }).props['aria-expanded'], false);
      const edit = () => r.root.findByProps({ 'aria-label': 'Editar apartado' });
      const remove = () => r.root.findByProps({ 'aria-label': 'Eliminar apartado' });
      await act(async () => edit().props.onClick());
      const modal = r.root.findByProps({ 'data-testid': 'edit-layaway-stub' }).props.modalProps;
      assert.equal(modal.layaway.id, record.id);
      assert.equal(modal.isOpen, true);
      const updated = { ...record, customerName: 'Editado' };
      await act(async () => modal.onUpdateLayaway(updated, record));
      assert.deepEqual(updates.at(-1), [updated, record]);
      await act(async () => modal.onClose());
      assert.equal(r.root.findAllByProps({ 'data-testid': 'edit-layaway-stub' }).length, 0);
      await act(async () => remove().props.onClick());
      assert.equal(deleted.at(-1), record.id);
      await act(async () => r.root.findByProps({ 'aria-label': 'Ver detalle del apartado A-1' }).props.onClick());
      assert.equal(r.root.findAllByProps({ 'aria-label': 'Editar apartado' }).length, 1);
      assert.equal(r.root.findAllByProps({ 'aria-label': 'Eliminar apartado' }).length, 1);
      await act(async () => r.root.findByProps({ 'aria-label': 'Ver detalle del apartado A-1' }).props.onClick());
    }
    assert.equal(deleted.length, 2);
    assert.equal(updates.length, 2);
  } finally { await act(async () => r.unmount()); }
});
test('seller cannot gain edit or delete controls by changing layout or opening details', async () => {
  let r;
  await act(async () => { r = create(React.createElement(LayawayView, props({ layaways: [record], currentUser: { id: 'seller', roleId: 'seller' } }))); });
  try {
    for (const layout of ['Cuadrícula', 'Lista']) {
      await act(async () => byLabel(r, layout).props.onClick());
      for (const expanded of [false, true]) {
        assert.equal(r.root.findAllByProps({ 'aria-label': 'Editar apartado' }).length, 0);
        assert.equal(r.root.findAllByProps({ 'aria-label': 'Eliminar apartado' }).length, 0);
        await act(async () => r.root.findByProps({ 'aria-label': 'Ver detalle del apartado A-1' }).props.onClick());
      }
    }
  } finally { await act(async () => r.unmount()); }
});

test('tenant administrator roles with localized or custom names expose actions; foreign/disabled roles do not', async () => {
  const cases = [
    { role: { name: 'Administrador Staging', userType: 'admin' }, allowed: true },
    { role: { name: 'Administrador' }, allowed: true },
    { role: { name: 'Administrator' }, allowed: true },
    { role: { name: 'Asesor', userType: 'seller' }, allowed: false },
    { role: { name: 'Administrator', userType: 'seller' }, allowed: false },
    { role: { name: 'Administrador Staging', userType: 'admin', companyId: 'other' }, allowed: false },
    { role: { name: 'Administrador Staging', userType: 'admin' }, user: { isDisabled: true }, allowed: false },
    { role: { name: 'Administrador Staging', userType: 'admin' }, user: { storeId: 'missing' }, allowed: false },
    { role: { name: 'Administrador Staging', userType: 'admin' }, readOnly: true, allowed: false },
  ];
  for (const scenario of cases) {
    const defaults = props();
    let r;
    await act(async () => { r = create(React.createElement(LayawayView, props({ layaways: [record], roles: [{ id: 'other-admin', name: 'Administrator', companyId: 'other' }, { id: 'admin', companyId: 'test', ...scenario.role }], currentUser: { ...defaults.currentUser, ...scenario.user }, readOnly: scenario.readOnly || false }))); });
    try {
      assert.equal(r.root.findAllByProps({ 'aria-label': 'Editar apartado' }).length, scenario.allowed ? 1 : 0, JSON.stringify(scenario));
      assert.equal(r.root.findAllByProps({ 'aria-label': 'Eliminar apartado' }).length, scenario.allowed ? 1 : 0, JSON.stringify(scenario));
    } finally { await act(async () => r.unmount()); }
  }
});

test('Colombian business dates exclude all 2026 national holidays and weekends', () => {
  const excluded = new Set(['2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03', '2026-05-01', '2026-05-18', '2026-06-08', '2026-06-15', '2026-06-29', '2026-07-20', '2026-08-07', '2026-08-17', '2026-10-12', '2026-11-02', '2026-11-16', '2026-12-08', '2026-12-25']);
  for (let date = new Date('2026-01-01T12:00:00Z'); date.getUTCFullYear() === 2026; date = new Date(+date + 86400000)) {
    const key = date.toISOString().slice(0, 10);
    const expected = date.getUTCDay() === 0 || date.getUTCDay() === 6 || excluded.has(key) ? 0 : 1;
    assert.equal(colombiaBusinessDaysSince(new Date(+date - 86400000).toISOString(), date), expected, key);
  }
});
test('elapsed business days handle Bogotá midnight, year changes, duplicate holidays and invalid dates', () => {
  assert.equal(colombiaBusinessDaysSince('2026-10-30T14:00:00Z', new Date('2026-11-03T14:00:00Z')), 1);
  assert.equal(colombiaBusinessDaysSince('2026-12-24T14:00:00Z', new Date('2027-01-04T14:00:00Z')), 5);
  assert.equal(colombiaBusinessDaysSince('2025-06-27T14:00:00Z', new Date('2025-07-01T14:00:00Z')), 1);
  assert.equal(colombiaBusinessDaysSince('2026-11-05T04:59:00Z', new Date('2026-11-05T05:01:00Z')), 1);
  assert.equal(colombiaBusinessDaysSince('2026-11-05T05:00:00Z', new Date('2026-11-05T05:01:00Z')), 0);
  assert.equal(colombiaBusinessDaysSince('', now), null);
  assert.equal(colombiaBusinessDaysSince('2027-01-01T12:00:00Z', now), null);
});
test('Por Traer retains grid/list actions; 7 business days stay normal and 8 turn red without resetting after payments', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-05T17:00:00Z').getTime() });
  const seven = { ...record, status: 'pre-order', id: 'seven', invoiceNumber: 'P-7', createdAt: '2026-10-26T14:00:00Z' };
  const eight = { ...record, status: 'pre-order', id: 'eight', invoiceNumber: 'P-8', createdAt: '2026-10-23T14:00:00Z', payments: [payment('2026-11-05T14:00:00Z')] };
  let r;
  await act(async () => { r = create(React.createElement(LayawayView, props({ layaways: [seven, eight] }))); });
  try {
    await act(async () => byLabel(r, 'Por Traer').props.onClick());
    for (const layout of ['Cuadrícula', 'Lista']) {
      await act(async () => byLabel(r, layout).props.onClick());
      const badges = r.root.findAllByProps({ 'data-testid': 'layaway-age' });
      assert.equal(badges.length, 2);
      assert.doesNotMatch(badges.find(b => b.children.join('') === '7 días hábiles').props.className, /text-red/);
      assert.match(badges.find(b => b.children.join('') === '8 días hábiles').props.className, /text-red-600/);
      assert.equal(r.root.findAllByProps({ 'aria-label': 'Editar apartado' }).length, 2);
      assert.equal(r.root.findAllByProps({ 'aria-label': 'Eliminar apartado' }).length, 2);
      const header = r.root.findByProps({ 'aria-label': 'Ver detalle del apartado P-7' });
      await act(async () => header.props.onClick());
      assert.ok(byLabel(r, 'Registrar Abono'));
      assert.ok(byLabel(r, 'Marcar Recibido'));
      await act(async () => header.props.onClick());
    }
    assert.equal(getLayawayTiming(record, new Date('2026-11-05T17:00:00Z')).ageLabel, '35 días');
  } finally { await act(async () => r.unmount()); }
});

test.after(async () => { await rm(dir, { recursive: true, force: true }); });
