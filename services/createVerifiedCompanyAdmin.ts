import { View, type Company, type Store, type Role } from '../types';
import { isPlatformRole } from './developerAccess';

type AdminData = { name: string; username: string; password: string };
type Manager = (input: Record<string, unknown>) => Promise<unknown>;

// The callable services remain responsible for authorization, password hashing,
// unique login identities and licence limits. No legacy seller write is used.
export async function createVerifiedCompanyAdmin(
  company: Company, store: Store, roles: Role[], data: AdminData,
  manageRole: Manager, manageUser: Manager,
) {
  if (!company?.id || store?.companyId !== company.id) throw new Error('La sede pertenece a otra empresa.');
  const allowed = Object.values(View).filter(view => view !== View.DEVELOPER_CENTER && (!company.allowedViews?.length || company.allowedViews.includes(view)));
  const adminRole = roles.find(role => role.companyId === company.id && !('isDisabled' in role && role.isDisabled) && !isPlatformRole(role) &&
    !role.permissions.includes(View.DEVELOPER_CENTER) && role.permissions.every(view => allowed.includes(view)) &&
    (role.userType === 'admin' || ['administrator', 'administrador', 'admin'].includes(role.name.trim().toLowerCase())));
  let roleId = adminRole?.id;
  if (!roleId) {
    const created = await manageRole({ action: 'create', companyId: company.id, name: 'Administrador', userType: 'admin', permissions: allowed });
    if (!created || typeof created !== 'object' || !('id' in created) || typeof created.id !== 'string' || !created.id) throw new Error('No se pudo crear el rol administrador de la empresa.');
    roleId = created.id;
  }
  await manageUser({ action: 'create', companyId: company.id, storeId: store.id, roleId,
    name: data.name, username: data.username, password: data.password });
}
