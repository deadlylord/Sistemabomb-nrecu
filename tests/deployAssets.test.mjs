import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { deployAssetBase } from '../services/deployAssets.ts';

const deployUrl = 'https://0123456789abcdef01234567--vestikapos.netlify.app';

test('only Netlify previews and branch deploys pin assets to an immutable deploy', () => {
  for (const context of ['branch-deploy', 'deploy-preview']) {
    assert.equal(deployAssetBase({ NETLIFY: 'true', CONTEXT: context, DEPLOY_URL: deployUrl }), deployUrl + '/');
  }
  assert.equal(deployAssetBase({ NETLIFY: 'true', CONTEXT: 'production', DEPLOY_URL: deployUrl }), '/');
  assert.equal(deployAssetBase({}), '/');
  assert.throws(() => deployAssetBase({ NETLIFY: 'true', CONTEXT: 'branch-deploy', DEPLOY_URL: 'https://staging--vestikapos.netlify.app' }));
});

test('worker caches pinned modules and serves them offline without intercepting other sites or business APIs', async () => {
  const handlers = {};
  let cached, savedUrl;
  const ctx = {
    self: { location: { origin: 'https://staging--vestikapos.netlify.app' }, addEventListener: (name, fn) => handlers[name] = fn },
    caches: { open: async () => ({ put: async (req, res) => { savedUrl = req.url; cached = res; } }), match: async () => cached?.clone() },
    URL, Response, console,
    fetch: async () => new Response('export default 1', { headers: { 'Content-Type': 'application/javascript' } })
  };
  vm.runInNewContext(await readFile('public/sw.js', 'utf8'), ctx);
  const request = { url: deployUrl + '/assets/SettingsView-old.js', method: 'GET', headers: new Headers(), cache: 'default', mode: 'cors' };
  let response, cacheWrite;
  handlers.fetch({ request, respondWith: p => response = p, waitUntil: p => cacheWrite = p });
  assert.equal(await (await response).text(), 'export default 1');
  await cacheWrite;
  assert.equal(savedUrl, request.url);
  ctx.fetch = async () => { throw new Error('offline'); };
  handlers.fetch({ request, respondWith: p => response = p, waitUntil() {} });
  assert.equal(await (await response).text(), 'export default 1');
  for (const url of [deployUrl + '/api/sales', 'https://0123456789abcdef01234567--another.netlify.app/assets/a.js', 'https://firestore.googleapis.com/assets/a.js']) {
    let intercepted = false;
    handlers.fetch({ request: { ...request, url }, respondWith() { intercepted = true; } });
    assert.equal(intercepted, false);
  }
});
