import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { build } from 'esbuild';
import React from 'react';
import { create, act } from 'react-test-renderer';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('shared store subscription survives navigation and metadata renders, cleans up on scope change', async () => {
  const temp = await mkdtemp(fileURLToPath(new URL('./.hook-', import.meta.url)));
  let renderer;
  try {
    // Expose the fake through the same bundle instance as the hook.
    const entry = fileURLToPath(new URL('../services/useStoreCollection.ts', import.meta.url));
    const bundle = await build({
      ...{ bundle: true, write: false, format: 'esm', platform: 'node', external: ['react'] },
      stdin: { contents: `export { useStoreCollection } from ${JSON.stringify(entry)}; export { connections } from 'firebase/firestore';`, resolveDir: process.cwd() },
      plugins: [{ name: 'fake-firestore', setup(builder) {
        builder.onResolve({ filter: /^(firebase\/firestore|\.\.\/firebase)$/ }, args => ({ path: args.path, namespace: 'fake' }));
        builder.onLoad({ filter: /.*/, namespace: 'fake' }, args => ({ contents: args.path === '../firebase' ? 'export const db = {};' : `
          export const collection = (_, name) => ({ name });
          export const where = (field, op, value) => ({ field, op, value });
          export const query = (source, filter) => ({ source, filter });
          export const connections = [];
          export function onSnapshot(query, apply) {
            const connection = { query, apply, closed: false };
            connections.push(connection);
            return () => { connection.closed = true; };
          }
        ` }));
      } }]
    });
    const modulePath = join(temp, 'hook.mjs');
    await writeFile(modulePath, bundle.outputFiles[0].text);
    const { useStoreCollection, connections } = await import(pathToFileURL(modulePath).href);
    const values = [];
    const setter = value => values.push(value);
    function Screen({ store = 'Metro', scope = 'Paula:Bombon', enabled = true }) {
      useStoreCollection('inventory', store, scope, enabled, setter);
      return null;
    }
    await act(async () => { renderer = create(React.createElement(Screen)); });
    // Dashboard -> POS and unrelated store metadata updates keep identical hook inputs.
    await act(async () => { renderer.update(React.createElement(Screen)); });
    assert.equal(connections.length, 1);
    assert.equal(connections[0].closed, false);
    connections[0].apply({ docs: [{ id: 'a', data: () => ({ stock: 3 }) }] });
    assert.deepEqual(values.at(-1), [{ id: 'a', stock: 3 }]);
    await act(async () => { renderer.update(React.createElement(Screen, { store: 'Divino' })); });
    assert.equal(connections[0].closed, true);
    assert.equal(connections[1].query.filter.value, 'Divino');
    await act(async () => { renderer.update(React.createElement(Screen, { store: 'Divino', scope: 'other:Mayla' })); });
    assert.equal(connections[1].closed, true);
    assert.equal(connections.length, 3);
    await act(async () => { renderer.update(React.createElement(Screen, { enabled: false })); });
    assert.ok(connections.every(connection => connection.closed));
    await act(async () => { renderer.unmount(); });
    renderer = null;
  } finally {
    if (renderer) await act(async () => { renderer.unmount(); });
    await rm(temp, { recursive: true, force: true });
  }
});
