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
export function tenantPermissions(user: Seller | null | undefined, roles: Role[], stores: Store[], allowedViews?: View[]): View[] {
  const permissions = resolveTenantRole(user, roles, stores)?.permissions || [];
  return permissions.filter(view => view !== View.DEVELOPER_CENTER && (!allowedViews?.length || allowedViews.includes(view)));
}
