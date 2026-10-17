// Self-contained offline rehearsal. No Firebase/Admin SDK or network access.
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { prepareBackupSnapshot, sealMigrationBackup, openMigrationBackup, planMigrationRecovery } from '../src/migrationBackup.mjs';
export function rehearseMigrationRecovery() {
  const projectId = 'demo-vestika-migration', name = path => `projects/${projectId}/databases/(default)/documents/${path}`;
  const doc = (path, fields, time = '2026-10-17T09:00:00Z') => ({ name: name(path), fields, updateTime: time });
  const original = doc('sellers/user1', { username: { stringValue: 'fixture' }, password: { stringValue: 'fixture-secret' }, authVersion: { integerValue: '0' } });
  const migrated = doc('sellers/user1', { username: { stringValue: 'fixture' }, authVersion: { integerValue: '1' } }, '2026-10-17T09:01:00Z');
  const credential = doc('authCredentials/user1', { passwordHash: { stringValue: 'fixture-private-hash' } }, migrated.updateTime);
  const key = randomBytes(32);
  const source = prepareBackupSnapshot({ projectId, readTime: original.updateTime, collections: ['sellers', 'authCredentials'], documents: [original], complete: true, deployment: { clientCommit: 'fixture-before', ruleset: 'fixture-rules' } });
  const envelope = sealMigrationBackup(source, key);
  assert.equal(JSON.stringify(envelope).includes('fixture-secret'), false);
  const snapshot = openMigrationBackup(envelope, key, projectId);
  const expectedAfter = [{ path: 'sellers/user1', document: migrated }, { path: 'authCredentials/user1', document: credential }];
  const plan = planMigrationRecovery({ snapshot, projectId, currentSnapshot: { complete: true, readTime: '2026-10-17T09:03:00Z' }, currentDocuments: [migrated, credential], expectedAfter });
  assert.equal(plan.conflicts.length, 0); assert.equal(plan.actions.length, 2); assert.equal(plan.canExecute, false);
  const memory = new Map([migrated, credential].map(d => [d.name.slice(name('').length), d]));
  for (const action of plan.actions) {
    assert.equal(memory.get(action.path)?.updateTime, action.precondition.updateTime);
    if (action.kind === 'restore-source') memory.set(action.path, snapshot.items[action.backupIndex].document);
    else memory.delete(action.path);
  }
  assert.deepEqual([...memory.values()], [original]);
  const changed = doc('sellers/user1', { username: { stringValue: 'subsequent-change' } }, '2026-10-17T09:02:00Z');
  const conflict = planMigrationRecovery({ snapshot, projectId, currentSnapshot: { complete: true, readTime: '2026-10-17T09:03:00Z' }, currentDocuments: [changed, credential], expectedAfter });
  assert.equal(conflict.conflicts.length, 1);
  key.fill(0);
  return { mode: 'offline-rehearsal', encryptedRoundTrip: true, originalFieldsRecoveredInMemory: true, migrationCreatedCredentialRemovedInMemory: true, subsequentChangeProtected: true, remoteReads: 0, remoteWrites: 0 };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(rehearseMigrationRecovery()));
