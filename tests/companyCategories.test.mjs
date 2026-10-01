import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { build } from 'esbuild';

test('companies have independent category lists; old scope, legacy and other company names do not appear in Mayla', async () => {
  const dir = await mkdtemp(fileURLToPath(new URL('./.categories-', import.meta.url)));
  try {
    const output = await build({ bundle: true, write: false, format: 'esm', platform: 'node',
      stdin: { contents: `export * from './services/companyCategories'; export * from './services/legacyCategoryIsolation'; export { records } from 'firebase/firestore';`, resolveDir: process.cwd() },
      plugins: [{ name: 'fake-firestore', setup(builder) {
        builder.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: 'firestore', namespace: 'fake' }));
        builder.onLoad({ filter: /.*/, namespace: 'fake' }, () => ({ contents: `
          export const records = new Map();
          export const doc = (_, collection, id) => ({ key: collection + '/' + id, id });
          const snapshot = ref => ({ id: ref.id, ref, exists: () => records.has(ref.key), data: () => records.get(ref.key) });
          export const getDoc = async ref => snapshot(ref);
          export const runTransaction = async (_, callback) => callback({ get: getDoc, set: (ref, data) => records.set(ref.key, data), update: (ref, data) => records.set(ref.key, {...records.get(ref.key), ...data}) });
        ` }));
      } }]
    });
    const path = join(dir, 'categories.mjs'); await writeFile(path, output.outputFiles[0].text);
    const { selectCompanyCategories, isolateLegacyCategoryForStore, records } = await import(pathToFileURL(path).href);
    const legacy = { id: 'blouses', name: 'Blusas' };
    const own = { id: 'mayla-blouses', name: 'Blusas', companyId: 'mayla' };
    assert.deepEqual(selectCompanyCategories({ companyId: 'default_company', items: [legacy] }, 'mayla'), []);
    assert.deepEqual(selectCompanyCategories({ companyId: 'mayla', items: [legacy, own, { id: 'other', name: 'Jeans', companyId: 'other' }] }, 'mayla'), [own]);
    assert.deepEqual(selectCompanyCategories({ companyId: 'default_company', items: [legacy, own] }, 'default_company'), [legacy]);
    records.set('categories/blouses', legacy);
    records.set('inventory/p1', { storeId: 'mayla-store', categoryId: 'blouses', stock: 12 });
    records.set('inventory/p2', { storeId: 'bombon-store', categoryId: 'blouses', stock: 40 });
    records.set('inventory/p3', { storeId: 'mayla-store', categoryId: 'already-edited', stock: 8 });
    await isolateLegacyCategoryForStore({}, 'mayla', 'mayla-store', 'blouses', ['p1', 'p2', 'p3']);
    assert.deepEqual(records.get('categories/blouses'), legacy, 'original category unchanged');
    assert.deepEqual(records.get('categories/mayla__legacy__blouses'), { id: 'mayla__legacy__blouses', name: 'Blusas', companyId: 'mayla' });
    assert.equal(records.get('inventory/p1').stock, 12);
    assert.equal(records.get('inventory/p1').categoryId, 'mayla__legacy__blouses');
    assert.equal(records.get('inventory/p2').categoryId, 'blouses', 'another company product must not be relinked');
    assert.equal(records.get('inventory/p3').categoryId, 'already-edited', 'a concurrently edited reference must remain');
    records.get('categories/mayla__legacy__blouses').name = 'Nombre propio';
    await isolateLegacyCategoryForStore({}, 'mayla', 'mayla-store', 'blouses', ['p1']);
    assert.equal(records.get('categories/mayla__legacy__blouses').name, 'Nombre propio');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
