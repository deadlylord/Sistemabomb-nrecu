import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('all roles see incidents of any age and status only within their company and active store', async () => {
  const dir = await mkdtemp(fileURLToPath(new URL('./.incidents-', import.meta.url)));
  try {
    const result = await build({ entryPoints: ['components/IncidentsView.tsx'], bundle: true, write: false, format: 'esm', platform: 'node', external: ['react', 'firebase/firestore'] });
    const path = join(dir, 'view.mjs');
    await writeFile(path, result.outputFiles[0].text);
    const { default: IncidentsView } = await import(pathToFileURL(path).href);
    const previousMonth = new Date();
    previousMonth.setDate(1);
    previousMonth.setMonth(previousMonth.getMonth() - 8);
    const incident = (id, companyId, storeId, status = 'Registrado') => ({ id, companyId, storeId, status, type: 'Otro', description: id, sellerName: 'Seller', createdAt: previousMonth.toISOString() });
    const props = {
      companyId: 'mayla', activeStoreId: 'm1',
      stores: [{ id: 'm1', companyId: 'mayla' }, { id: 'm2', companyId: 'mayla' }, { id: 'b1', companyId: 'other' }],
      roles: [{ id: 'admin', name: 'Administrator' }, { id: 'seller', name: 'Seller' }],
      inventory: [], sales: [], customers: [],
      incidents: [{...incident('OldCompletedTransfer', 'mayla', 'm1', 'Traslado Completado'), type: 'Solicitud de Traslado', fromStoreId: 'm1', toStoreId: 'm2'}, incident('PendingLastMonth', 'mayla', 'm1', 'Pendiente de Aprobación'), incident('ResolvedLastMonth', 'mayla', 'm1', 'Devuelto y Resuelto'), {...incident('CrossCompanyTransfer', 'mayla', 'm1'),type:'Solicitud de Traslado',fromStoreId:'m1',toStoreId:'b1'}, incident('OtherCompanySecret', 'other', 'm1'), incident('OtherStoreSecret', 'mayla', 'm2')],
    };
    for (const roleId of ['seller', 'admin']) {
      const html = renderToStaticMarkup(React.createElement(IncidentsView, { ...props, currentUser: { id: roleId, roleId, companyId: 'mayla', storeId: 'm1' } }));
      assert.ok(html.includes('PendingLastMonth'), roleId);
      assert.ok(html.includes('OldCompletedTransfer'), roleId);
      const destination = renderToStaticMarkup(React.createElement(IncidentsView, {...props, activeStoreId:'m2', currentUser:{id:roleId,roleId,storeId:'m2',companyId:'mayla'}}));
      assert.ok(!destination.includes('OldCompletedTransfer'), roleId);
      assert.ok(!destination.includes('PendingLastMonth'), roleId);
      assert.equal(html.includes('ResolvedLastMonth'), true, roleId);
      assert.ok(!html.includes('OtherCompanySecret'), roleId);
      assert.ok(!html.includes('CrossCompanyTransfer'), roleId);
      assert.ok(!html.includes('OtherStoreSecret'), roleId);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
