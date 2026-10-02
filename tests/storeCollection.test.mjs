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
      stdin: { contents: `export { useStoreCollection } from ${JSON.stringify(entry)}; export { subscribeStoreRows } from './services/storeSubscriptions'; export { connections } from 'firebase/firestore';`, resolveDir: process.cwd() },
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
    const { useStoreCollection, subscribeStoreRows, connections } = await import(pathToFileURL(modulePath).href);
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
    const left = [], right = [];
    const stopLeft = subscribeStoreRows('financialRecords', 'Mayla1', 'Carlos:Mayla', rows => left.push(rows));
    const stopRight = subscribeStoreRows('financialRecords', 'Mayla1', 'Carlos:Mayla', rows => right.push(rows));
    assert.equal(connections.length, 4, 'two consumers share one database listener');
    const finance = connections[3];
    finance.apply({ docs: [{ id: 'own', data: () => ({ companyId: 'Mayla', amount: 10 }) }, { id: 'foreign', data: () => ({ companyId: 'Bombon', amount: 99 }) }] });
    finance.apply({ docs: [{ id: 'own', data: () => ({ companyId: 'Mayla', amount: 25 }) }] });
    assert.equal(left.at(-1)[0].amount, 25);
    assert.deepEqual(left, right, 'changes reach both consumers without reload');
    assert.equal(left[0].length, 1, 'foreign company row is excluded');
    stopLeft(); assert.equal(finance.closed, false);
    stopRight(); assert.equal(finance.closed, true);
    finance.apply({ docs: [] });
    assert.equal(right.length, 2, 'late callbacks from old scope are ignored');
    const incidentRows=[];
    const stopIncidents=subscribeStoreRows('incidents','Mayla1','Carlos:Mayla',rows=>incidentRows.push(rows));
    const incidentConnections=connections.filter(c=>c.query.source.name==='incidents');
    assert.deepEqual(incidentConnections.map(c=>c.query.filter.field),['storeId','fromStoreId','toStoreId']);
    const row={id:'transfer',companyId:'Mayla',type:'Solicitud de Traslado',storeId:'Mayla2',fromStoreId:'Mayla2',toStoreId:'Mayla1'};
    const snapshot=rows=>({docs:rows.map(r=>({id:r.id,data:()=>r}))});
    incidentConnections[2].apply(snapshot([row,{...row,id:'foreign',companyId:'Other'}]));
    assert.deepEqual(incidentRows.at(-1).map(r=>r.id),['transfer']);
    incidentConnections[0].apply(snapshot([row]));
    assert.equal(incidentRows.at(-1).length,1,'duplicate document appears only once');
    stopIncidents();assert.ok(incidentConnections.every(c=>c.closed));
    const before=incidentRows.length;incidentConnections[2].apply(snapshot([]));
    assert.equal(incidentRows.length,before,'old destination callbacks are ignored');
    await act(async () => { renderer.unmount(); });
    renderer = null;
  } finally {
    if (renderer) await act(async () => { renderer.unmount(); });
    await rm(temp, { recursive: true, force: true });
  }
});
