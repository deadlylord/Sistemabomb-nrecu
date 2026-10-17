import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, stat, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareBackupSnapshot, sealMigrationBackup, openMigrationBackup, planMigrationRecovery } from '../functions/src/migrationBackup.mjs';
import { captureMigrationSources, saveEncryptedMigrationBackup } from '../functions/src/migrationBackupCapture.mjs';
import { rehearseMigrationRecovery } from '../functions/scripts/rehearseMigrationRecovery.mjs';
const projectId = 'demo-vestika-migration', readTime = '2026-10-17T09:00:00Z';
const doc = (path, value, updateTime = readTime) => ({ name: `projects/${projectId}/databases/(default)/documents/${path}`, fields: { value: { stringValue: value }, exactNumber: { integerValue: '9007199254740993' }, when: { timestampValue: '2026-10-17T09:00:00.123456789Z' } }, updateTime });
const original = doc('sellers/u', 'fixture-private-password');
const migrated = doc('sellers/u', 'public-profile', '2026-10-17T09:01:00Z');
const source = documents => prepareBackupSnapshot({ projectId, readTime, collections: ['sellers', 'authCredentials'], documents, complete: true });
const recovery = (changes = {}) => planMigrationRecovery({ snapshot: source([original]), currentSnapshot: { complete: true, readTime: '2026-10-17T09:05:00Z' }, currentDocuments: [migrated], expectedAfter: [{ path: 'sellers/u', document: migrated }], projectId, ...changes });
test('encrypted backup preserves Firestore wire values exactly and exposes no plaintext fields', () => {
  const key = randomBytes(32), snapshot = source([original]), envelope = sealMigrationBackup(snapshot, key);
  assert.equal(JSON.stringify(envelope).includes('fixture-private-password'), false);
  assert.equal(JSON.stringify(envelope).includes('sellers/u'), false);
  assert.deepEqual(openMigrationBackup(envelope, key, projectId), snapshot);
});
test('wrong key, altered payload, tampered header and wrong project cannot open a backup', () => {
  const key = randomBytes(32), envelope = sealMigrationBackup(source([original]), key);
  assert.throws(() => openMigrationBackup(envelope, randomBytes(32), projectId));
  const broken = Buffer.from(envelope.ciphertext, 'base64'); broken[0] ^= 1;
  assert.throws(() => openMigrationBackup({ ...envelope, ciphertext: broken.toString('base64') }, key, projectId));
  assert.throws(() => openMigrationBackup({ ...envelope, algorithm: 'none' }, key, projectId));
  assert.throws(() => openMigrationBackup(envelope, key, 'foreign-project'), /project/);
});
test('incomplete, foreign, duplicate, nested or altered source snapshots are rejected', () => {
  assert.throws(() => prepareBackupSnapshot({ projectId, readTime, collections: ['sellers'], documents: [], complete: false }));
  assert.throws(() => source([original, original]), /Duplicate/);
  assert.throws(() => source([{ ...original, name: original.name.replace(projectId, 'foreign-project') }]), /another project/);
  assert.throws(() => source([doc('sellers/u/private/secret', 'value')]), /scope/);
  const snapshot = source([original]); snapshot.items[0].document.fields.value.stringValue = 'modified';
  assert.throws(() => sealMigrationBackup(snapshot, randomBytes(32)), /integrity/);
});
test('capture exhausts every page including empty collections with the same readTime', async () => {
  const calls = [];
  const snapshot = await captureMigrationSources({ projectId, readTime, collections: ['sellers', 'authCredentials'], readPage: async request => {
    calls.push(request);
    if (request.collection === 'authCredentials') return { documents: [] };
    return request.pageToken ? { documents: [doc('sellers/v', 'fixture')] } : { documents: [original], nextPageToken: 'second' };
  } });
  assert.equal(calls.length, 3); assert.ok(calls.every(r => r.readTime === readTime));
  assert.deepEqual(snapshot.manifest.counts, { sellers: 2, authCredentials: 0 });
});
test('a failed or looping capture never returns a complete snapshot', async () => {
  const args = { projectId, readTime, collections: ['sellers'] };
  await assert.rejects(captureMigrationSources({ ...args, readPage: async () => { throw Error('network'); } }), /network/);
  await assert.rejects(captureMigrationSources({ ...args, readPage: async () => ({ documents: [], nextPageToken: 'same' }) }), /Repeated/);
  await assert.rejects(captureMigrationSources({ ...args, readPage: async () => ({}) }), /incomplete/);
});
test('recovery references originals and requires the observed post-migration version', () => {
  const plan = recovery();
  assert.equal(plan.canExecute, false); assert.equal(plan.actions.length, 1);
  assert.deepEqual(plan.actions[0].precondition, { updateTime: migrated.updateTime });
  assert.equal(JSON.stringify(plan).includes('fixture-private-password'), false);
  const changed = { ...migrated, updateTime: '2026-10-17T09:04:00Z' };
  assert.equal(recovery({ currentDocuments: [changed] }).conflicts[0].reason, 'changed-after-migration');
  assert.equal(recovery({ expectedAfter: [] }).conflicts[0].reason, 'no-migration-journal');
  assert.throws(() => recovery({ currentSnapshot: { complete: false } }), /complete current/);
});
test('deleted originals require absence; only migration-created documents may be removed', () => {
  const deleted = recovery({ currentDocuments: [], expectedAfter: [{ path: 'sellers/u', document: null }] });
  assert.deepEqual(deleted.actions[0].precondition, { exists: false });
  const created = doc('authCredentials/u', 'private-hash', migrated.updateTime);
  const plan = recovery({ currentDocuments: [original, created], expectedAfter: [{ path: 'authCredentials/u', document: created }] });
  assert.equal(plan.actions[0].kind, 'remove-migration-created-document');
  assert.throws(() => recovery({ expectedAfter: [{ path: 'sales/x', document: null }] }), /scope/);
  assert.throws(() => recovery({ projectId: 'foreign-project' }), /mismatch/);
});
test('encrypted file is private and key is not written beside it', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vestika-backup-fixture-'));
  try {
    await chmod(directory, 0o700);
    const key = randomBytes(32), result = await saveEncryptedMigrationBackup({ snapshot: source([original]), key, privateDirectory: directory });
    assert.equal(result.keySaved, false); assert.equal((await stat(result.path)).mode & 0o077, 0);
    const bytes = await readFile(result.path, 'utf8'); assert.equal(bytes.includes('fixture-private-password'), false);
    assert.equal(openMigrationBackup(JSON.parse(bytes), key, projectId).manifest.documentCount, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('end-to-end offline recovery restores the original and protects subsequent edits', () => {
  assert.deepEqual(rehearseMigrationRecovery(), { mode: 'offline-rehearsal', encryptedRoundTrip: true, originalFieldsRecoveredInMemory: true, migrationCreatedCredentialRemovedInMemory: true, subsequentChangeProtected: true, remoteReads: 0, remoteWrites: 0 });
});
test('administrative capture reader permits only GET in the explicit project and keeps credentials out of errors', async () => {
  const { createMigrationBackupReader } = await import('../functions/src/migrationBackupReader.mjs');
  const calls = [], request = { projectId, databaseId: '(default)', collection: 'sellers', readTime, pageSize: 200 };
  const reader = createMigrationBackupReader({ projectId, getAccessToken: async () => ({ access_token: 'fixture-token' }), fetchImpl: async (url, options) => {
    calls.push({ url, options }); return { ok: true, json: async () => ({ documents: [original], nextPageToken: 'next' }) };
  } });
  assert.deepEqual(await reader(request), { documents: [original], nextPageToken: 'next' });
  assert.equal(calls[0].options.method, 'GET'); assert.equal(calls[0].options.body, undefined);
  assert.equal(new URL(calls[0].url).searchParams.get('readTime'), readTime);
  await assert.rejects(reader({ ...request, projectId: 'foreign-project' }), /scope/);
  await assert.rejects(reader({ ...request, collection: '../secrets' }), /scope/);
  assert.equal(calls.length, 1);
  const broken = createMigrationBackupReader({ projectId, getAccessToken: async () => ({ access_token: 'fixture-token' }), fetchImpl: async () => ({ ok: false, status: 403 }) });
  await assert.rejects(broken(request), error => error.message.includes('403') && !error.message.includes('fixture-token'));
});
