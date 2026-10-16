import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { applicationDefault } from 'firebase-admin/app';
import { stagingRest } from './stagingRest.mjs';
import { hashPassword, verifyPassword, loginIndexId } from '../src/identity.mjs';
import { aliases, publicSeller } from '../src/stagingUsers.mjs';

export async function migrateStagingIdentity(getAccessToken, write = false) {
  const rest = stagingRest(getAccessToken);
  const [sellers, stores, roles, companies, credentials, indexes] = await Promise.all(['sellers','stores','roles','companies','authCredentials','authLoginIndex'].map(c => rest.list(c)));
  const map = rows => new Map(rows.map(r => [r.id, r.data]));
  const storeMap = map(stores), roleMap = map(roles), companyMap = map(companies), credentialMap = map(credentials), indexMap = map(indexes);
  const owners = new Map(), writes = [];
  for (const { id, data: seller, updateTime } of sellers) {
    const store = storeMap.get(seller.storeId), role = roleMap.get(seller.roleId);
    const companyId = store?.companyId || 'default_company';
    if (!store || !role || seller.companyId && seller.companyId !== companyId || (role.companyId || 'default_company') !== companyId || !companyMap.has(companyId)) throw new Error(`Invalid staging identity ownership: ${id}`);
    let passwordHash = credentialMap.get(id)?.passwordHash;
    if (typeof seller.password === 'string' && seller.password.trim()) {
      if (!passwordHash || !await verifyPassword(seller.password, passwordHash)) passwordHash = await hashPassword(seller.password);
    }
    if (!passwordHash?.startsWith('scrypt-v1:')) throw new Error(`Staging identity has no valid credential: ${id}`);
    const normalized = aliases(seller);
    if (!normalized.length) throw new Error(`Staging identity has no login alias: ${id}`);
    for (const alias of normalized) {
      const key = loginIndexId(alias), existingOwner = owners.get(key) || indexMap.get(key)?.sellerId;
      if (existingOwner && existingOwner !== id) throw new Error(`Login alias collision between ${existingOwner} and ${id}; no writes performed.`);
      owners.set(key,id); writes.push(rest.set(`authLoginIndex/${key}`, { sellerId: id }));
    }
    writes.push(rest.set(`authCredentials/${id}`, { passwordHash, disabled: !!seller.isDisabled }));
    writes.push(rest.set(`sellers/${id}`, publicSeller(id, { ...seller, companyId, authVersion: seller.authVersion || 1 }), updateTime));
  }
  if (write) {
    const expected = await readFile(new URL('../../security/firestore.staging.rules', import.meta.url),'utf8');
    if ((await rest.deployedRules()).trim() !== expected.trim()) throw new Error('Deploy the verified staging rules before creating private credentials.');
    await rest.commit(writes);
    const after = await rest.list('sellers');
    if (after.some(s => 'password' in s.data)) throw new Error('A public seller profile still contains a password.');
  }
  const result = { project: 'vestika-staging', users: sellers.length, aliases: owners.size, mode: write ? 'migrated-and-sanitized' : 'read-only-check', passwordsPrinted: false };
  console.log(JSON.stringify(result)); return result;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const credential = applicationDefault();
  await migrateStagingIdentity(() => credential.getAccessToken(), process.argv.includes('--write'));
}
