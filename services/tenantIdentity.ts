import { DEFAULT_COMPANY_ID, type Role, type Seller, type Store, View } from '../types';
import { isPlatformRole } from './developerAccess';

// Permission decisions require both the user's actual store and their own role.
// A matching role ID alone never establishes company ownership.
export function resolveTenantRole(user: Seller | null | undefined, roles: Role[], stores: Store[]): Role | undefined {
  if (!user || user.isDisabled) return;
  const store = stores.find(store => store.id === user.storeId);
  if (!store) return;
  const companyId = user.companyId || store.companyId || DEFAULT_COMPANY_ID;
  if ((store.companyId || DEFAULT_COMPANY_ID) !== companyId) return;
  return roles.find(role => role.id === user.roleId && (role.companyId || DEFAULT_COMPANY_ID) === companyId && !isPlatformRole(role));
}
export const SHARED_RECORD_VIEWS = [View.INCIDENTS, View.LAYAWAY];
export function isTenantAdministrator(role: Role | undefined): boolean {
  if (!role || role.userType === 'seller') return false;
  return role.userType === 'admin' || ['admin', 'administrator', 'administrador'].includes(role.name?.trim().toLowerCase()) ||
    role.permissions?.includes(View.ROLE_MANAGER) || role.permissions?.includes(View.CEO_CENTER) || false;
}
export function tenantOperationPermissions(user: Seller | null | undefined, roles: Role[], stores: Store[], allowedViews?: View[]): View[] {
  const role = resolveTenantRole(user, roles, stores);
  const permissions = role?.permissions || [];
  return permissions.filter(view => view !== View.DEVELOPER_CENTER && (view !== View.INVENTORY_TRANSFER || isTenantAdministrator(role)) && (!allowedViews?.length || allowedViews.includes(view)));
}
export function tenantPermissions(user: Seller | null | undefined, roles: Role[], stores: Store[], allowedViews?: View[]): View[] {
  const role = resolveTenantRole(user, roles, stores);
  if (!role) return [];
  return [...new Set([...tenantOperationPermissions(user, roles, stores, allowedViews), ...SHARED_RECORD_VIEWS, ...(isTenantAdministrator(role) ? [View.INVENTORY_TRANSFER] : [])])];
}
