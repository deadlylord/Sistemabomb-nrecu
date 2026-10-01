import { createHash, scrypt as scryptCallback, timingSafeEqual, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export const OWNER_ID = '-OYqLOlA2gyy_TrUtzf2';
export const DEFAULT_COMPANY = 'default_company';
export class IdentityError extends Error {
  constructor(code, message = 'No se pudo verificar el acceso.') { super(message); this.code = code; }
}
const reject = () => { throw new IdentityError('unauthenticated', 'Usuario o contraseña incorrecta.'); };
export function normalizeIdentifier(value) {
  if (typeof value !== 'string') reject();
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length > 160) reject();
  return normalized;
}
export const loginIndexId = identifier => createHash('sha256').update(normalizeIdentifier(identifier)).digest('hex');
export async function hashPassword(password) {
  if (typeof password !== 'string' || !password.trim() || password.length > 256) reject();
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password.trim(), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt-v1:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || !password.trim() || password.length > 256 || typeof encoded !== 'string') return false;
  const parts = encoded.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt-v1' || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{128}$/.test(parts[2])) return false;
  const candidate = await scrypt(password.trim(), parts[1], 64, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(candidate, Buffer.from(parts[2], 'hex'));
}
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 128 && !value.includes('/');
// All identity fields come from trusted server reads. Client-provided company,
// role, sellerId and Developer flags are deliberately never consumed.
export async function authenticateIdentity(input, dependencies) {
  if (!dependencies.enabled) throw new IdentityError('failed-precondition', 'La autenticación verificada todavía no está activada.');
  const identifier = normalizeIdentifier(input?.identifier);
  const password = input?.password;
  if (typeof password !== 'string' || !password.trim() || password.length > 256) reject();
  await dependencies.consumeAttempt(identifier);
  const index = await dependencies.read('authLoginIndex', loginIndexId(identifier));
  if (!index || !validId(index.sellerId)) reject();
  const credential = await dependencies.read('authCredentials', index.sellerId);
  if (!credential || credential.disabled === true || !(await verifyPassword(password, credential.passwordHash))) reject();
  const seller = await dependencies.read('sellers', index.sellerId);
  if (!seller || seller.isDisabled || !validId(seller.storeId) || !validId(seller.roleId)) reject();
  const aliases = [seller.username, seller.name].filter(value => typeof value === 'string' && value.trim()).map(normalizeIdentifier);
  if (!aliases.includes(identifier)) reject(); // Renaming invalidates a stale login index.
  const store = await dependencies.read('stores', seller.storeId);
  if (!store || store.isDisabled || store.status === 'inactive') reject();
  const companyId = store.companyId || DEFAULT_COMPANY;
  if (!validId(companyId) || seller.companyId && seller.companyId !== companyId) reject();
  const company = await dependencies.read('companies', companyId);
  if (!company || company.isDisabled || ['inactive', 'suspended'].includes(company.status)) reject();
  const role = await dependencies.read('roles', seller.roleId);
  if (!role || role.isDisabled || (role.companyId || DEFAULT_COMPANY) !== companyId) reject();
  const roleName = String(role.name || '').trim().toLowerCase();
  if (role.userType === 'developer' || ['developer', 'desarrollador'].includes(roleName)) reject();
  const platformOwner = index.sellerId === OWNER_ID;
  const grant = platformOwner ? null : await dependencies.read('platformDevelopers', index.sellerId);
  const platformDeveloper = platformOwner || !!(grant && grant.userId === index.sellerId && grant.role === 'developer' && grant.active === true && grant.grantedBy === OWNER_ID);
  const claims = { identityVersion: 1, sellerId: index.sellerId, companyId, storeId: seller.storeId, roleId: seller.roleId, platformOwner, platformDeveloper };
  const uid = `vestika:${createHash('sha256').update(index.sellerId).digest('hex')}`;
  const customToken = await dependencies.createCustomToken(uid, claims);
  // Whitelist rather than returning the seller document (which currently has a password).
  return { customToken, user: { id: index.sellerId, name: seller.name || '', username: seller.username || '', companyId, storeId: seller.storeId, roleId: seller.roleId }, claims };
}
export function nextAttempt(state, now, limit) {
  const current = state && Number.isFinite(state.windowStart) && now >= state.windowStart && now - state.windowStart < 600000 ? state : { windowStart: now, count: 0 };
  if (!Number.isInteger(current.count) || current.count < 0 || current.count >= limit) throw new IdentityError('resource-exhausted', 'Demasiados intentos. Espera unos minutos.');
  return { windowStart: current.windowStart, count: current.count + 1 };
}
