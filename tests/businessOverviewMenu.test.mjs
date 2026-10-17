import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { create, act } from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
test('mobile summary restores fixed shortcuts, dates and on-demand tools', async () => {
  const dir = await mkdtemp(join(process.cwd(), 'tests/.menu-'));
  let renderer;
  const previousDocument = globalThis.document;
  const scrolled = [], opened = [];
  globalThis.document = { getElementById: id => ({ scrollIntoView: () => scrolled.push(id) }) };
  try {
    const result = await build({
      entryPoints: ['components/BusinessOverview.tsx'], bundle: true, write: false,
      format: 'esm', platform: 'node', external: ['react'],
      plugins: [{ name: 'summary-fixtures', setup(b) {
        b.onResolve({ filter: /services\/(useBusinessSummary|viewFilters)$/ }, a => ({ path: a.path, namespace: 'fixture' }));
        b.onResolve({ filter: /\.\/SalesHistoryChart$/ }, () => ({ path: 'chart', namespace: 'fixture' }));
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents:
          a.path.endsWith('viewFilters') ? "export {useState as useViewFilterState} from 'react';import{useState}from'react';export const useViewFilter=(key,value)=>useState(value);" :
          a.path === 'chart' ? 'export default function Chart(){return null;}' :
          'export const useBusinessSummary=()=>({ready:true,loading:false,days:[],months:[],meta:{},total:()=>({income:0,salesCollected:0,units:0,invoices:0,cogs:0,profit:0,expenses:0,sellers:{},methods:{}})});'
        }));
      } }]
    });
    const file = join(dir, 'menu.mjs'); await writeFile(file, result.outputFiles[0].text);
    const { default: Overview } = await import(pathToFileURL(file).href);
    await act(async () => { renderer = create(React.createElement(Overview, {
      companyId: 'a', store: { id: 'a1', name: 'Sede 1' }, stores: [], scope: 'u:a',
      onOpenDetails: section => opened.push(section), onOpenVerification: () => opened.push('inventory')
    })); });
    const toolbar = renderer.root.findAllByType('div').find(n => n.props.className?.includes('lg:hidden fixed inset-x-0'));
    assert.ok(toolbar.props.className.includes('bottom-[calc(64px+env(safe-area-inset-bottom))]'));
    const button = label => toolbar.findAllByType('button').find(n => n.children.join('') === label);
    for (const label of ['Hoy','Semana','Mes','Pagos','Precios','Historial','Gráficos','Inventario']) assert.ok(button(label), label);
    const from = () => toolbar.findByProps({ 'aria-label': 'Fecha desde' });
    const until = () => toolbar.findByProps({ 'aria-label': 'Fecha hasta' });
    await act(async () => button('Mes').props.onClick());
    assert.ok(from().props.value.endsWith('-01'));
    await act(async () => button('Hoy').props.onClick());
    const today = from().props.value; assert.equal(today, until().props.value);
    assert.equal(toolbar.findByProps({ 'aria-label': 'Día siguiente' }).props.disabled, true);
    await act(async () => toolbar.findByProps({ 'aria-label': 'Día anterior' }).props.onClick());
    assert.ok(from().props.value < today);
    assert.equal(from().props.value, until().props.value);
    await act(async () => toolbar.findByProps({ 'aria-label': 'Día siguiente' }).props.onClick());
    assert.equal(from().props.value, today);
    await act(async () => { button('Pagos').props.onClick(); button('Gráficos').props.onClick(); });
    assert.deepEqual(scrolled, ['payment-report','sales-chart']); assert.deepEqual(opened, []);
    await act(async () => { button('Precios').props.onClick(); button('Historial').props.onClick(); button('Inventario').props.onClick(); });
    assert.deepEqual(opened, ['price-analysis','sales-history','inventory']);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    globalThis.document = previousDocument;
    await rm(dir, { recursive: true, force: true });
  }
});
