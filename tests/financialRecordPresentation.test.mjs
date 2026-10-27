import test from 'node:test';
import assert from 'node:assert/strict';
import { financialRecordPresentation as present } from '../services/financialRecordPresentation.ts';

const stores = [{ id: 'center', name: 'Tienda Centro' }];
const payment = { debtStoreId: 'center', amount: -100, subCategory: 'Cruce Sedes', description: 'Cruce Tienda Centro: Pago deuda ref. 01/10/2026, 02/10/2026' };

test('outgoing settlement shows its destination and preserves every original reference without mutating the record', () => {
  const before = structuredClone(payment);
  const view = present(payment, stores);
  assert.equal(view.label, 'Pago a Tienda Centro');
  assert.equal(view.description, view.label);
  assert.equal(view.detail, payment.description);
  assert.deepEqual(payment, before);
});
test('incoming settlement identifies its origin', () => {
  const view = present({ ...payment, amount: 100, description: 'Cruce Tienda Centro: Recibo pago deuda ref. saldo consolidado' }, stores);
  assert.equal(view.label, 'Pago recibido de Tienda Centro');
  assert.match(view.detail, /saldo consolidado/);
});
test('explicit loans distinguish lender and recipient without inferring loans from a generic crossing', () => {
  for (const amount of [-100, 100]) {
    assert.equal(present({ ...payment, amount, description: 'Préstamo', subCategory: 'Préstamo a Sede' }, stores).label,
      amount < 0 ? 'Préstamo a Tienda Centro' : 'Préstamo recibido de Tienda Centro');
  }
  assert.equal(present({ ...payment, description: 'Cruce Tienda Centro: Servicios' }, stores).label, 'Cruce con Tienda Centro');
});
test('unrelated concepts and handwritten notes remain intact, even when long', () => {
  const description = 'Servicios y observaciones: ' + 'detalle '.repeat(100);
  assert.deepEqual(present({ ...payment, debtStoreId: undefined, description }, stores), { label: '', description, detail: '' });
  assert.equal(present({ ...payment, description }, stores).description, description);
});
test('a store missing from the authorized directory never gets its name from a historical free-text concept', () => {
  const view = present(payment, []);
  assert.equal(view.label, 'Pago a sede no disponible');
  assert.equal(view.detail, payment.description);
});
