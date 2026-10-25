import { createHash } from 'node:crypto';
import { OWNER_ID, IdentityError, hashPassword, loginIndexId, normalizeIdentifier } from './identity.mjs';

const fail = message => { throw new IdentityError('permission-denied', message || 'No tienes permiso para gestionar este usuario.'); };
export const identityUid = sellerId => `vestika:${createHash('sha256').update(sellerId).digest('hex')}`;
export const aliases = seller => [...new Set([seller?.username, seller?.name].filter(x => typeof x === 'string' && x.trim()).map(normalizeIdentifier))];
export const publicSeller = (id, data) => Object.fromEntries(Object.entries({ id, name: data.name, username: data.username || '', companyId: data.companyId, storeId: data.storeId, roleId: data.roleId, isDisabled: !!data.isDisabled, authVersion: data.authVersion || 0, platformRole: data.platformRole || null }).filter(([, v]) => v !== undefined));
export const roleType = role => role?.userType === 'admin' || ['administrator', 'admin', 'administrador'].includes(String(role?.name || '').toLowerCase().trim()) || role?.permissions?.some(p => ['role_manager','ceo_center'].includes(p)) ? 'admin' : 'seller';
export async function verifiedActor(auth, read) {
  const token = auth?.token;
  if (!token || token.identityVersion !== 1 || !token.sellerId || auth.uid !== identityUid(token.sellerId)) fail();
  const seller = await read('sellers', token.sellerId);
  if (!seller || seller.isDisabled || seller.companyId !== token.companyId || seller.roleId !== token.roleId || seller.storeId !== token.storeId || (seller.authVersion || 0) !== token.authVersion) fail('Tu acceso cambió. Ingresa nuevamente.');
  const [store, role, company] = await Promise.all([read('stores', seller.storeId), read('roles', seller.roleId), read('companies', seller.companyId)]);
  if (!store || store.companyId !== seller.companyId || store.isDisabled || store.status === 'inactive' || !role || role.companyId !== seller.companyId || role.isDisabled || !company || company.isDisabled || ['inactive', 'suspended'].includes(company.status)) fail();
  const owner = token.sellerId === OWNER_ID;
  const grant = owner ? null : await read('platformDevelopers', token.sellerId);
  const developer = owner || !!(grant?.active && grant.role === 'developer' && grant.userId === token.sellerId && grant.grantedBy === OWNER_ID);
  return { seller, role, company, owner, developer, id: token.sellerId };
}

// This operation owns both the public seller profile and private credentials /
// aliases. No browser writes these documents directly in verified staging.
export async function manageStagingUser(db, auth, input, options = {}) {
  if (auth?.token?.identityVersion !== 1 || auth.uid !== identityUid(auth.token.sellerId || '')) fail();
  if (!input || !['create', 'update', 'toggle', 'delete'].includes(input.action)) throw new IdentityError('invalid-argument', 'Acción inválida.');
  const id = input.action === 'create' ? db.collection('sellers').doc().id : input.id;
  if (typeof id !== 'string' || !id || id.includes('/') || id.length > 128) throw new IdentityError('invalid-argument', 'Usuario inválido.');
  if (id === OWNER_ID && !(options.allowOwnerUpdate && auth.token.sellerId === OWNER_ID && input.action === 'update')) fail('La cuenta del propietario no se modifica desde esta operación.');
  const password = input.password;
  if (password !== undefined && (typeof password !== 'string' || password.length > 256)) throw new IdentityError('invalid-argument', 'Contraseña inválida.');
  const encoded = password?.trim() ? await hashPassword(password) : null;
  if (input.action === 'create' && !encoded) throw new IdentityError('invalid-argument', 'La contraseña es obligatoria.');
  return db.runTransaction(async tx => {
    const read = async (collection, key) => { const s = await tx.get(db.collection(collection).doc(key)); return s.exists ? s.data() : null; };
    const actor = await verifiedActor(auth, read);
    if (!actor.developer && (roleType(actor.role) !== 'admin' || !(actor.role.permissions || []).some(p => ['sellers', 'role_manager'].includes(p)))) fail();
    if (id === actor.id && ['toggle', 'delete'].includes(input.action)) fail('No puedes desactivar ni eliminar tu propio acceso.');
    const before = await read('sellers', id);
    if (input.action !== 'create' && !before) throw new IdentityError('not-found', 'No se encontró el usuario.');
    const companyId = before?.companyId || (actor.developer ? input.companyId : actor.seller.companyId);
    if (typeof companyId !== 'string' || !companyId || (!actor.developer && companyId !== actor.seller.companyId)) fail();
    if (before?.companyId !== undefined && before.companyId !== companyId) fail();
    const grant = await read('platformDevelopers', id);
    if (grant?.active && !actor.owner) fail('Solo el propietario puede modificar un usuario de plataforma.');
    const next = { ...(before || {}), id, companyId, authVersion: (before?.authVersion || 0) + 1 };
    if (input.action === 'create' || input.action === 'update') {
      for (const field of ['name', 'username', 'storeId', 'roleId']) {
        const value = field === 'username' ? input[field] || '' : input[field];
        if (typeof value !== 'string' || value.length > (['storeId', 'roleId'].includes(field) ? 128 : 160) || field !== 'username' && !value.trim()) throw new IdentityError('invalid-argument', 'Completa nombre, rol y sede válidos.');
        next[field] = value.trim();
      }
    }
    next.isDisabled = input.action === 'toggle' ? !before.isDisabled : !!before?.isDisabled;
    const [store, role, company, credential] = await Promise.all([read('stores', next.storeId), read('roles', next.roleId), read('companies', companyId), read('authCredentials', id)]);
    if (!store || store.companyId !== companyId || !role || role.companyId !== companyId || role.userType === 'developer' || ['developer', 'desarrollador'].includes(String(role.name || '').toLowerCase()) || role.permissions?.includes('developer_center') || !company) fail('La sede o el rol no pertenecen a esta empresa.');
    if (!encoded && input.action !== 'delete' && !credential?.passwordHash) throw new IdentityError('failed-precondition', 'El usuario requiere una contraseña nueva.');
    if (id === actor.id && !(options.allowOwnerUpdate && actor.owner) && (next.roleId !== before.roleId || next.storeId !== before.storeId)) fail('Otro administrador debe cambiar tu rol o sede.');
    const oldAliases = aliases(before), newAliases = input.action === 'delete' ? [] : aliases(next);
    const indexes = new Map();
    for (const alias of new Set([...oldAliases, ...newAliases])) {
      const key = loginIndexId(alias), index = await read('authLoginIndex', key);
      if (newAliases.includes(alias) && index && index.sellerId !== id) throw new IdentityError('already-exists', 'Ese nombre o usuario ya identifica a otra persona.');
      indexes.set(alias, { key, index });
    }
    const companyRef = db.collection('companies').doc(companyId);
    // Updating the company lock serializes concurrent licence assignments.
    if (input.action !== 'delete' && !next.isDisabled) {
      const all = await tx.get(db.collection('sellers').where('companyId', '==', companyId));
      const roleIds = [...new Set(all.docs.filter(d => d.id !== id && !d.data().isDisabled).map(d => d.data().roleId))];
      const roleMap = new Map();
      for (const roleId of roleIds) roleMap.set(roleId, await read('roles', roleId));
      const type = roleType(role), configured = type === 'admin' ? company.maxAdmins : company.maxSellers;
      const count = all.docs.filter(d => d.id !== id && !d.data().isDisabled && !(options.excludePlatformUsers && (d.id === OWNER_ID || d.data().platformRole === 'developer')) && roleType(roleMap.get(d.data().roleId)) === type).length;
      if (Number.isFinite(configured) && count >= configured) throw new IdentityError('resource-exhausted', 'Se alcanzó el límite de usuarios de esta empresa.');
    }
    for (const [alias, { key, index }] of indexes) {
      const ref = db.collection('authLoginIndex').doc(key);
      if (newAliases.includes(alias)) tx.set(ref, { sellerId: id });
      else if (index?.sellerId === id) tx.delete(ref);
    }
    if (input.action === 'delete') {
      tx.delete(db.collection('sellers').doc(id)); tx.delete(db.collection('authCredentials').doc(id));
    } else {
      const profile = options.preserveProfile ? { ...next, ...publicSeller(id, next) } : publicSeller(id, next);
      delete profile.password; delete profile.passwordHash;
      tx.set(db.collection('sellers').doc(id), profile);
      tx.set(db.collection('authCredentials').doc(id), { passwordHash: encoded || credential.passwordHash, disabled: next.isDisabled });
    }
    tx.update(companyRef, { identityRevision: (company.identityRevision || 0) + 1 });
    return { id, deleted: input.action === 'delete' };
  });
}
