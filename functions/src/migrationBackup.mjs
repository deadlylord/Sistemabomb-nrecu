// Backup/recovery preparation only: no Firebase SDK, network calls or database writes.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const canonical = value => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
};
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const keyBytes = key => {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('A private 32-byte backup key is required.');
  return key;
};
const prefix = projectId => `projects/${projectId}/databases/(default)/documents/`;
const documentPath = (document, projectId) => {
  if (typeof document?.name !== 'string' || !document.name.startsWith(prefix(projectId))) throw new Error('Document belongs to another project/database.');
  const path = document.name.slice(prefix(projectId).length), parts = path.split('/');
  if (parts.length % 2 || parts.some(part => !part || part === '.' || part === '..')) throw new Error('Invalid document path.');
  if (!document.fields || typeof document.fields !== 'object' || Array.isArray(document.fields)) throw new Error('Firestore wire fields are required.');
  if (typeof document.updateTime !== 'string' || !Number.isFinite(Date.parse(document.updateTime))) throw new Error('Document updateTime is required.');
  return path;
};
// Hash only restorable content; updateTime is retained separately for concurrency checks.
const contentHash = document => digest({ name: document.name, fields: document.fields });
export function prepareBackupSnapshot({ projectId, readTime, collections, documents, complete, deployment }) {
  if (!/^[a-z][a-z0-9-]{4,62}$/.test(projectId || '') || !Number.isFinite(Date.parse(readTime)) || complete !== true) throw new Error('A complete, dated snapshot and explicit project are required.');
  if (!Array.isArray(collections) || !collections.length || collections.some(c => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(c)) || new Set(collections).size !== collections.length) throw new Error('Explicit, unique source collections are required.');
  const names = new Set(), counts = Object.fromEntries(collections.map(c => [c, 0]));
  const items = documents.map(document => {
    const path = documentPath(document, projectId);
    if (names.has(path)) throw new Error('Duplicate backup document.');
    names.add(path);
    // This capture covers direct source collections only. Derived subcollections
    // must be rebuilt/verified separately, rather than silently omitted.
    if (path.split('/').length !== 2 || !(path.split('/')[0] in counts)) throw new Error('Document is outside the declared source collection scope.');
    counts[path.split('/')[0]]++;
    return { path, hash: contentHash(document), document: structuredClone(document) };
  }).sort((a, b) => a.path.localeCompare(b.path));
  if (deployment && Object.keys(deployment).some(key => !['clientCommit', 'ruleset', 'publicConfigFingerprint'].includes(key))) throw new Error('Only deployment references belong in the backup manifest.');
  const manifest = { format: 'vestika-migration-source-backup-v1', projectId, databaseId: '(default)', readTime, collections: [...collections].sort(), counts, documentCount: items.length, documentsHash: digest(items), deployment: deployment || null };
  return { manifest, items };
}
export function sealMigrationBackup(snapshot, key) {
  keyBytes(key);
  verifySnapshot(snapshot);
  const nonce = randomBytes(12), header = { format: 'vestika-encrypted-backup-v1', algorithm: 'AES-256-GCM' };
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(canonical(header)));
  const ciphertext = Buffer.concat([cipher.update(canonical(snapshot), 'utf8'), cipher.final()]);
  return { ...header, nonce: nonce.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
}
export function openMigrationBackup(envelope, key, expectedProjectId) {
  keyBytes(key);
  if (envelope?.format !== 'vestika-encrypted-backup-v1' || envelope.algorithm !== 'AES-256-GCM') throw new Error('Unsupported encrypted backup format.');
  const nonce = Buffer.from(envelope.nonce || '', 'base64'), tag = Buffer.from(envelope.tag || '', 'base64');
  if (nonce.length !== 12 || tag.length !== 16) throw new Error('Invalid encrypted backup metadata.');
  const cipher = createDecipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(canonical({ format: envelope.format, algorithm: envelope.algorithm })));
  cipher.setAuthTag(tag);
  const snapshot = JSON.parse(Buffer.concat([cipher.update(Buffer.from(envelope.ciphertext || '', 'base64')), cipher.final()]).toString('utf8'));
  verifySnapshot(snapshot);
  if (snapshot.manifest.projectId !== expectedProjectId) throw new Error('Backup project does not match recovery target.');
  return snapshot;
}
function verifySnapshot(snapshot) {
  if (!snapshot?.manifest || !Array.isArray(snapshot.items) || snapshot.manifest.format !== 'vestika-migration-source-backup-v1') throw new Error('Invalid backup snapshot.');
  const rebuilt = prepareBackupSnapshot({ ...snapshot.manifest, documents: snapshot.items.map(item => item.document), complete: true });
  if (digest(snapshot.manifest) !== digest(rebuilt.manifest) || digest(snapshot.items) !== digest(rebuilt.items)) throw new Error('Backup integrity/counts do not match.');
}
// expectedAfter contains the exact document content written by a future migration
// (or null if it deleted that path). It must come from that migration's journal.
// This only plans a recovery: actions reference encrypted backup entries, not secrets.
export function planMigrationRecovery({ snapshot, currentDocuments, currentSnapshot, expectedAfter, projectId }) {
  if (currentSnapshot?.complete !== true || !Number.isFinite(Date.parse(currentSnapshot.readTime))) throw new Error('A complete current snapshot is required for recovery planning.');
  verifySnapshot(snapshot);
  if (snapshot.manifest.projectId !== projectId) throw new Error('Recovery project mismatch.');
  const current = new Map();
  for (const document of currentDocuments) {
    const path = documentPath(document, projectId);
    if (current.has(path)) throw new Error('Duplicate current document.');
    current.set(path, document);
  }
  const backup = new Map(snapshot.items.map((item, index) => [item.path, { ...item, index }]));
  const journal = new Map();
  for (const change of expectedAfter) {
    const { path, document } = change;
    if (journal.has(path) || (document !== null && documentPath(document, projectId) !== path)) throw new Error('Invalid or duplicate migration journal entry.');
    if (!path || !snapshot.manifest.collections.includes(path.split('/')[0]) || path.split('/').length !== 2) throw new Error('Migration journal is outside backup scope.');
    journal.set(path, document);
  }
  const actions = [], conflicts = [], unchanged = [];
  for (const path of new Set([...backup.keys(), ...journal.keys()])) {
    const saved = backup.get(path), live = current.get(path), migrated = journal.get(path);
    if (saved && live && contentHash(live) === saved.hash || !saved && !live) { unchanged.push(path); continue; }
    if (!journal.has(path)) { conflicts.push({ path, reason: 'no-migration-journal' }); continue; }
    if (migrated === null ? !!live : !live || contentHash(live) !== contentHash(migrated) || live.updateTime !== migrated.updateTime) { conflicts.push({ path, reason: 'changed-after-migration' }); continue; }
    actions.push(saved ? { kind: 'restore-source', path, backupIndex: saved.index, precondition: live ? { updateTime: live.updateTime } : { exists: false } } : { kind: 'remove-migration-created-document', path, precondition: { updateTime: live.updateTime } });
  }
  return { mode: 'recovery-plan-only', canExecute: false, projectId, actions, conflicts, unchanged };
}
