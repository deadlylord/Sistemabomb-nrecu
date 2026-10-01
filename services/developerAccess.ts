import { Role, Seller, View } from '../types';

// Immutable owner account, verified against the existing Carlos account.
// Names, company roles and the legacy isDeveloper flag never grant access.
export const PLATFORM_OWNER_USER_ID = '-OYqLOlA2gyy_TrUtzf2';
export interface PlatformDeveloperGrant {
  userId: string;
  role: 'developer';
  grantedBy: string;
  active: boolean;
  grantedAt?: string;
}
export const isPlatformOwner = (user?: Seller | null) => !!user && !user.isDisabled && user.id === PLATFORM_OWNER_USER_ID;
export const hasPlatformDeveloperAccess = (user?: Seller | null, grant?: PlatformDeveloperGrant | null) =>
  isPlatformOwner(user) || (!!user && !user.isDisabled && grant?.userId === user.id && grant.role === 'developer' && grant.active === true && grant.grantedBy === PLATFORM_OWNER_USER_ID);
export const isPlatformRole = (role?: Role) => !!role && (role.userType === 'developer' || ['developer', 'desarrollador'].includes((role.name || '').trim().toLowerCase()));
export function assertCompanyRole(role?: Role) {
  if (!role) throw new Error('No se encontró el rol.');
  if (isPlatformRole(role) || role.permissions?.includes(View.DEVELOPER_CENTER)) throw new Error('Developer se asigna únicamente desde Developer Center por el propietario Carlos.');
}
export function assertPlatformOwnerAction(user: Seller | null | undefined, view: View) {
  if (!isPlatformOwner(user) || view !== View.DEVELOPER_CENTER) throw new Error('Solo Carlos puede gestionar developers desde Developer Center.');
}
