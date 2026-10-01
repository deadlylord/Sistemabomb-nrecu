import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('sellers see previous-month incidents only within their company and active store', async () => {
  const dir = await mkdtemp(fileURLToPath(new URL('./.incidents-', import.meta.url)));
  try {
    const result = await build({ entryPoints: ['components/IncidentsView.tsx'], bundle: true, write: false, format: 'esm', platform: 'node', external: ['react', 'firebase/firestore'] });
    const path = join(dir, 'view.mjs');
    await writeFile(path, result.outputFiles[0].text);
    const { default: IncidentsView } = await import(pathToFileURL(path).href);
    const previousMonth = new Date();
    previousMonth.setDate(1);
    previousMonth.setMonth(previousMonth.getMonth() - 1);
    const incident = (id, companyId, storeId, status = 'Registrado') => ({ id, companyId, storeId, status, type: 'Otro', description: id, sellerName: 'Seller', createdAt: previousMonth.toISOString() });
    const props = {
      companyId: 'mayla', activeStoreId: 'm1',
      stores: [{ id: 'm1', companyId: 'mayla' }, { id: 'm2', companyId: 'mayla' }, { id: 'b1', companyId: 'other' }],
      roles: [{ id: 'admin', name: 'Administrator' }, { id: 'seller', name: 'Seller' }],
      inventory: [], sales: [], customers: [],
      incidents: [incident('PendingLastMonth', 'mayla', 'm1', 'Pendiente de Aprobación'), incident('ResolvedLastMonth', 'mayla', 'm1', 'Devuelto y Resuelto'), incident('OtherCompanySecret', 'other', 'm1'), incident('OtherStoreSecret', 'mayla', 'm2')],
    };
    for (const roleId of ['seller', 'admin']) {
      const html = renderToStaticMarkup(React.createElement(IncidentsView, { ...props, currentUser: { id: roleId, roleId, companyId: 'mayla', storeId: 'm1' } }));
      assert.ok(html.includes('PendingLastMonth'), roleId);
      assert.equal(html.includes('ResolvedLastMonth'), roleId === 'admin', roleId);
      assert.ok(!html.includes('OtherCompanySecret'), roleId);
      assert.ok(!html.includes('OtherStoreSecret'), roleId);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
