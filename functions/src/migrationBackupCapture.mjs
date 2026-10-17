// Inject a read-only transport later. No Firebase SDK and no remote writes.
import { randomBytes } from 'node:crypto';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { prepareBackupSnapshot, sealMigrationBackup, openMigrationBackup } from './migrationBackup.mjs';
export async function captureMigrationSources({ projectId, readTime, collections, deployment, readPage }) {
  if (typeof readPage !== 'function') throw new Error('A read-only page reader is required.');
  // Validate the capture request before invoking the reader.
  prepareBackupSnapshot({ projectId, readTime, collections, deployment, documents: [], complete: true });
  const documents = [];
  for (const collection of collections) {
    let pageToken; const visited = new Set();
    do {
      const page = await readPage({ projectId, databaseId: '(default)', collection, readTime, pageToken, pageSize: 200 });
      if (!Array.isArray(page?.documents) || page.nextPageToken !== undefined && typeof page.nextPageToken !== 'string') throw new Error('Invalid backup page; snapshot is incomplete.');
      documents.push(...page.documents);
      pageToken = page.nextPageToken || undefined;
      if (pageToken && visited.has(pageToken)) throw new Error('Repeated page cursor; snapshot is incomplete.');
      if (pageToken) visited.add(pageToken);
    } while (pageToken);
  }
  return prepareBackupSnapshot({ projectId, readTime, collections, deployment, documents, complete: true });
}
export async function saveEncryptedMigrationBackup({ snapshot, key, privateDirectory }) {
  if (!privateDirectory) throw new Error('An explicit private backup directory is required.');
  const directory = resolve(privateDirectory);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await stat(directory);
  if (!info.isDirectory() || info.mode & 0o077) throw new Error('Backup directory must be private (0700).');
  const envelope = sealMigrationBackup(snapshot, key);
  // Verify the key, manifest and contents before saving the encrypted bytes.
  openMigrationBackup(envelope, key, snapshot.manifest.projectId);
  const path = join(directory, 'vestika-migration-' + randomBytes(12).toString('hex') + '.encrypted.json');
  await writeFile(path, JSON.stringify(envelope), { flag: 'wx', mode: 0o600 });
  return { path, projectId: snapshot.manifest.projectId, documentCount: snapshot.manifest.documentCount, keySaved: false };
}
