// Administrative REST transport for staging scripts. Credentials stay in memory.
export function stagingRest(getAccessToken) {
  const project = 'vestika-staging';
  const name = path => `projects/${project}/databases/(default)/documents/${path}`;
  const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
  const decode = v => 'stringValue' in v ? v.stringValue : 'booleanValue' in v ? v.booleanValue : 'integerValue' in v ? Number(v.integerValue) : 'doubleValue' in v ? v.doubleValue : 'nullValue' in v ? null : 'timestampValue' in v ? v.timestampValue : 'arrayValue' in v ? (v.arrayValue.values || []).map(decode) : Object.fromEntries(Object.entries(v.mapValue?.fields || {}).map(([k,v]) => [k,decode(v)]));
  const encode = v => v === null ? { nullValue: null } : typeof v === 'string' ? { stringValue: v } : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(encode) } } : { mapValue: { fields: fields(v) } };
  const fields = value => Object.fromEntries(Object.entries(value).filter(([,v]) => v !== undefined).map(([k,v]) => [k,encode(v)]));
  const document = value => ({ id: value.name.split('/').at(-1), path: value.name.split('/documents/')[1], data: Object.fromEntries(Object.entries(value.fields || {}).map(([k,v]) => [k,decode(v)])), updateTime: value.updateTime });
  async function request(url, options = {}) {
    const token = await getAccessToken();
    const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json', ...options.headers } });
    const result = await response.json();
    if (!response.ok) { const error = new Error(`Staging administrative request failed (${response.status}).`); error.status = response.status; throw error; }
    return result;
  }
  return {
    request,
    decodeDocument: document,
    async list(collection) {
      const result = []; let pageToken;
      do {
        const page = await request(`${base}/${collection}?pageSize=200${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`);
        result.push(...(page.documents || []).map(document)); pageToken = page.nextPageToken;
      } while (pageToken);
      return result;
    },
    async get(path) { try { return document(await request(base + '/' + path)); } catch (error) { if (error.status === 404) return null; throw error; } },
    set(path, data, updateTime) { return { update: { name: name(path), fields: fields(data) }, ...(updateTime ? { currentDocument: { updateTime } } : {}) }; },
    remove(path) { return { delete: name(path) }; },
    async commit(writes) { if (writes.length > 450) throw new Error('Staging batch exceeds the explicit limit.'); return request(base + ':commit', { method: 'POST', body: JSON.stringify({ writes }) }); },
    async deployedRules() {
      const release = await request(`https://firebaserules.googleapis.com/v1/projects/${project}/releases/cloud.firestore`);
      const ruleset = await request('https://firebaserules.googleapis.com/v1/' + release.rulesetName);
      return ruleset.source.files.find(f => f.name.endsWith('.rules'))?.content || ruleset.source.files[0].content;
    }
  };
}
