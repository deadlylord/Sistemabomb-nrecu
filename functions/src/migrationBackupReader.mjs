// Administrative reader for a future capture. The sole remote operation is GET
// on one fixed Firestore project/database; credentials are injected, never saved.
const validProject = value => typeof value === 'string' && /^[a-z][a-z0-9-]{4,62}$/.test(value);
export function createMigrationBackupReader({ projectId, getAccessToken, fetchImpl = fetch }) {
  if (!validProject(projectId) || typeof getAccessToken !== 'function') throw new Error('Explicit project and authorized token provider are required.');
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/`;
  return async function readPage(request) {
    if (request.projectId !== projectId || request.databaseId !== '(default)' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(request.collection || '')) throw new Error('Backup request is outside the authorized project/database scope.');
    if (!Number.isFinite(Date.parse(request.readTime)) || !Number.isInteger(request.pageSize) || request.pageSize < 1 || request.pageSize > 500) throw new Error('A consistent read time and bounded page size are required.');
    const query = new URLSearchParams({ readTime: request.readTime, pageSize: String(request.pageSize) });
    if (request.pageToken) query.set('pageToken', request.pageToken);
    const token = await getAccessToken();
    if (typeof token?.access_token !== 'string' || !token.access_token) throw new Error('Administrative Firebase connection is unavailable.');
    const response = await fetchImpl(base + request.collection + '?' + query, { method: 'GET', signal: AbortSignal.timeout(45000), headers: { Authorization: 'Bearer ' + token.access_token } });
    if (!response.ok) throw new Error(`Read-only backup request failed (${response.status}).`);
    const body = await response.json();
    if (body.documents !== undefined && !Array.isArray(body.documents)) throw new Error('Invalid Firestore backup response.');
    return { documents: body.documents || [], ...(body.nextPageToken ? { nextPageToken: body.nextPageToken } : {}) };
  };
}
