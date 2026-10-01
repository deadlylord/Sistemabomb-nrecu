import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { build } from 'esbuild';
import React from 'react';
import { create, act } from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('company role/user forms cannot assign Developer, even when opened by the owner', async () => {
  const dir = await mkdtemp(fileURLToPath(new URL('./.developer-', import.meta.url)));
  let renderer;
  try {
    const bundle = await build({ bundle: true, write: false, format: 'esm', platform: 'node', external: ['react'], stdin: {
      contents: `export {default as RoleManager} from './components/RoleManagerView'; export {default as SellerModal} from './components/SellerModal'; export {View} from './types';`, resolveDir: process.cwd()
    }});
    const path = join(dir, 'forms.mjs'); await writeFile(path, bundle.outputFiles[0].text);
    const { RoleManager, SellerModal, View } = await import(pathToFileURL(path).href);
    const admin = { id: '1', name: 'Administrator', userType: 'admin', permissions: [View.POS] };
    const legacyDev = { id: 'dev', name: 'Developer', userType: 'developer', permissions: [View.DEVELOPER_CENTER] };
    let savedRole;
    await act(async () => { renderer = create(React.createElement(RoleManager, { roles: [admin, legacyDev], isDeveloper: true, onAddRole() {}, onUpdateRole: value => { savedRole = value; } })); });
    assert.equal(renderer.root.findAllByType('option').some(option => option.props.value === 'developer'), false);
    const all = renderer.root.findAllByType('button').find(button => button.children.includes('Seleccionar Todos'));
    await act(async () => { all.props.onClick(); });
    assert.ok(savedRole.permissions.includes(View.POS));
    assert.equal(savedRole.permissions.includes(View.DEVELOPER_CENTER), false);
    assert.equal(JSON.stringify(renderer.toJSON()).includes('Crear Rol Developer'), false);
    await act(async () => { renderer.unmount(); });
    await act(async () => { renderer = create(React.createElement(SellerModal, { isOpen: true, roles: [admin, legacyDev], stores: [{id:'store',name:'Sede'}], isDeveloperUser: true, onSave() {}, onClose() {} })); });
    assert.equal(renderer.root.findAllByType('option').some(option => option.props.value === 'dev'), false);
    assert.equal(renderer.root.findAllByType('input').some(input => input.props.type === 'checkbox'), false);
    await act(async () => { renderer.unmount(); }); renderer = null;
  } finally {
    if (renderer) await act(async () => { renderer.unmount(); });
    await rm(dir, { recursive: true, force: true });
  }
});
