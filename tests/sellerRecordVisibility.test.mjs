import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

test('seller month window uses Bogota dates, retains only previous-month active records and handles January', async () => {
  const result = await build({entryPoints:['services/sellerRecordVisibility.ts'],bundle:true,write:false,format:'esm',platform:'node'});
  const {sellerRecordVisible: visible,incidentIsActive: active} = await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
  const now = new Date('2026-10-01T17:00:00Z');
  assert.ok(visible('2026-10-01T05:00:00Z', false, now));
  assert.ok(visible('2026-09-15T17:00:00Z', true, now));
  assert.ok(!visible('2026-09-15T17:00:00Z', false, now));
  assert.ok(!visible('2026-08-31T17:00:00Z', true, now));
  assert.ok(!visible('2026-10-01T04:59:59Z', false, now));
  assert.ok(!visible('invalid', true, now));
  assert.ok(visible('2025-12-15T17:00:00Z', true, new Date('2026-01-01T17:00:00Z')));
  for (const status of ['Devuelto y Resuelto','Cambio Procesado','Traslado Completado','Garantía Devuelta']) assert.ok(!active(status));
  for (const status of ['Registrado','Pendiente de Aprobación','En Arreglo/Cambio','Garantía Activa']) assert.ok(active(status));
});
