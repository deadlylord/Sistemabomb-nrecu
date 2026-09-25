import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionLoader } from '../services/sessionLoader.ts';

test('simultaneous and subsequent requests share one read, including empty results', async () => {
  const loader = createSessionLoader();
  let reads = 0;
  const applied = [];
  const read = async () => { reads++; return []; };
  await Promise.all(Array.from({ length: 10 }, () => loader.load('sales', read, value => applied.push(value))));
  await loader.load('sales', read, value => applied.push(value));
  assert.equal(reads, 1);
  assert.deepEqual(applied, [[]]);
});

test('switching company or user ignores old responses and loads the new scope', async () => {
  const loader = createSessionLoader();
  let finishOld;
  const applied = [];
  const old = loader.load('sales', () => new Promise(resolve => { finishOld = resolve; }), value => applied.push(value));
  await Promise.resolve();
  loader.reset();
  await loader.load('sales', async () => ['new company'], value => applied.push(value));
  finishOld(['old company']);
  await old;
  assert.deepEqual(applied, [['new company']]);
});

test('failed reads can retry without clearing successful collections', async () => {
  const loader = createSessionLoader();
  await loader.load('inventory', async () => [], () => {});
  await assert.rejects(loader.load('sales', async () => { throw Error('offline'); }, () => {}));
  let retried = false;
  await loader.load('sales', async () => ['sale'], () => { retried = true; });
  await loader.load('inventory', () => { throw Error('unnecessary read'); }, () => {});
  assert.equal(retried, true);
});

test('an old scope failure cannot evict a new scope request', async () => {
  const loader = createSessionLoader();
  let failOld;
  const old = loader.load('sales', () => new Promise((_, reject) => { failOld = reject; }), () => {});
  await Promise.resolve();
  loader.reset();
  await loader.load('sales', async () => ['new'], () => {});
  failOld(Error('old network failure'));
  await assert.rejects(old);
  await loader.load('sales', () => { throw Error('new cache was lost'); }, () => {});
});
