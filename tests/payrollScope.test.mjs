import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { inPayrollScope, payrollDate, payrollLogins, payrollShiftUnits } from '../services/payrollScope.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const scope = { storeId: 'metro', companyId: 'bombon' };
const transaction = (id, time, quantity, extras = {}) => ({ id, storeId: 'metro', companyId: 'bombon', seller: 'Carlos', createdAt: `2026-09-30T${time}:00-05:00`, items: [{ price: 10000, quantity }], ...extras });
const sales = [transaction('morning', '11:00', 2), transaction('afternoon', '18:00', 5), transaction('foreign-store', '11:00', 300, { storeId: 'divino' }), transaction('foreign-company', '11:00', 400, { companyId: 'mayla' }), transaction('other-seller', '11:00', 500, { seller: 'Paula' }), transaction('settled-layaway', '11:00', 30, { layawayId: 'layaway' }), transaction('gift', '11:00', 1, { items: [{ price: 0, quantity: 100 }] })];

test('payroll scope isolates company and store, preserves legacy records by store and uses Colombia dates', () => {
  assert.equal(inPayrollScope({ storeId: 'metro' }, scope), true);
  assert.equal(inPayrollScope({ storeId: 'metro', companyId: 'mayla' }, scope), false);
  assert.equal(inPayrollScope({ storeId: 'divino', companyId: 'bombon' }, scope), false);
  assert.equal(inPayrollScope({}, scope), false);
  assert.equal(payrollDate('2026-10-01T02:00:00Z'), '2026-09-30');
  assert.equal(payrollDate('bad-date'), '');
});

test('logins use seller identity, period and store; commissions exclude other shifts and settled/cancelled layaways', () => {
  const login = { sellerId: 'carlos', sellerName: 'Carlos', date: '2026-09-30T09:00:00-05:00', ...scope };
  assert.equal(payrollLogins([login, {...login, storeId: 'divino'}, {...login, companyId: 'mayla'}, {...login, sellerId: 'other-carlos'}, {...login, date: '2026-09-29T09:00:00-05:00'}], scope, 'carlos', 'Carlos', '2026-09-30', '2026-09-30').length, 1);
  const all = [...sales, transaction('active-layaway', '12:00', 1, { status: 'active' }), transaction('cancelled', '12:00', 30, { status: 'cancelled' }), transaction('pre-order', '12:00', 30, { status: 'pre-order' })];
  assert.equal(payrollShiftUnits(all, scope, 'Carlos', '2026-09-30', '10:30', '14:00'), 3);
  assert.equal(payrollShiftUnits(all, scope, 'Carlos', '2026-09-30', '14:01', '20:30'), 5);
  assert.equal(payrollShiftUnits(all, scope, 'Carlos', '2026-09-29', '10:30', '20:30'), 0);
  assert.equal(payrollShiftUnits(all, scope, 'Carlos', '2026-09-30', '20:30', '10:30'), 0);
  const boundary = [transaction('shift-boundary', '14:00', 4)];
  assert.equal(payrollShiftUnits(boundary, scope, 'Carlos', '2026-09-30', '10:30', '14:00'), 0);
  assert.equal(payrollShiftUnits(boundary, scope, 'Carlos', '2026-09-30', '14:00', '20:30'), 4, 'adjacent shifts must not share a sale at their boundary');
});

test('payroll UI excludes foreign payments, recalculates shift commission and saves explicit company/store', async () => {
  const dir = await mkdtemp(fileURLToPath(new URL('./.payroll-', import.meta.url)));
  const oldStorage = globalThis.localStorage, oldWindow = globalThis.window, oldAlert = globalThis.alert;
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };
  globalThis.window = { confirm: () => true }; globalThis.alert = () => {};
  try {
    const result = await build({ bundle: true, write: false, format: 'esm', platform: 'node', external: ['react'], entryPoints: ['components/PayrollView.tsx'] });
    const path = join(dir, 'payroll.mjs'); await writeFile(path, result.outputFiles[0].text);
    const { default: PayrollView } = await import(pathToFileURL(path).href);
    let saved, renderer;
    const props = { companyId: 'bombon', currentStore: { id: 'metro', name: 'Metro' }, currentUser: { id: 'admin', name: 'Admin' }, sellers: [{ id: 'carlos', name: 'Carlos' }], sales, layaways: [], loginHistory: [{ id: 'login', sellerId: 'carlos', sellerName: 'Carlos', date: '2026-09-30T09:00:00-05:00', ...scope }], payrollHistory: [{id:'foreign', sellerName:'Foreign payment', storeId:'divino', companyId:'bombon', paidAt:'2026-09-30T12:00:00Z'}], onSavePayroll: async data => { saved = data; }, onDeletePayroll: async () => {} };
    await act(async () => { renderer = create(React.createElement(PayrollView, props)); });
    assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /Foreign payment/);
    await act(async () => { renderer.root.findByProps({ id: 'seller' }).props.onChange({ target: { value: 'carlos' } }); });
    const dates = renderer.root.findAllByType('input').filter(input => input.props.type === 'date');
    await act(async () => { dates[0].props.onChange({ target: { value: '2026-09-30' } }); dates[1].props.onChange({ target: { value: '2026-09-30' } }); });
    const button = label => renderer.root.findAllByType('button').find(button => button.children.some(child => typeof child === 'string' && child.includes(label)));
    await act(async () => { button('Cargar Datos Automáticos').props.onClick(); });
    const times = renderer.root.findAllByType('input').filter(input => input.props.type === 'time');
    await act(async () => { times[1].props.onChange({ target: { value: '14:00' } }); });
    await act(async () => { button('GENERAR PRE-NÓMINA').props.onClick(); });
    await act(async () => { await button('REGISTRAR PAGO EN SISTEMA').props.onClick(); });
    assert.equal(saved.storeId, 'metro'); assert.equal(saved.companyId, 'bombon');
    assert.equal(saved.totalUnitsSold, 2); assert.equal(saved.commissionAmount, 2000);
    assert.equal(saved.loginAccesses.length, 1);
    assert.ok(storage.has('payrollBaseSalary:bombon:metro'));
    await act(async () => { renderer.unmount(); });
  } finally { globalThis.localStorage = oldStorage; globalThis.window = oldWindow; globalThis.alert = oldAlert; await rm(dir, { recursive: true, force: true }); }
});
