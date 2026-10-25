import { IdentityError, OWNER_ID } from './identity.mjs';
import { verifiedActor, identityUid, roleType } from './stagingUsers.mjs';
const views = new Set(['dashboard','pos','inventory','inventory_transfer','layaway','purchases','sellers','stores','customers','stock_take_history','payroll','settings','incidents','role_manager','accounting','financial_reconciliation','gift_vouchers','ceo_center','tag_scanning']);
export async function manageStagingRole(db, auth, input, options = {}) {
  if (auth?.token?.identityVersion !== 1 || auth.uid !== identityUid(auth.token.sellerId || '')) throw new IdentityError('permission-denied');
  if (!input || !['create','update'].includes(input.action) || typeof input.name !== 'string' || !input.name.trim() || input.name.length > 160 || !['admin','seller'].includes(input.userType) || ['developer','desarrollador'].includes(input.name.trim().toLowerCase()) || !Array.isArray(input.permissions) || input.permissions.length > views.size || input.permissions.some(p => !views.has(p))) throw new IdentityError('invalid-argument', 'Revisa el nombre, tipo y permisos del rol.');
  const id = input.action === 'create' ? db.collection('roles').doc().id : input.id;
  if (typeof id !== 'string' || !id || id.includes('/') || id.length > 128) throw new IdentityError('invalid-argument');
  return db.runTransaction(async tx => {
    const read = async (collection,key) => { const s=await tx.get(db.collection(collection).doc(key)); return s.exists?s.data():null; };
    const actor = await verifiedActor(auth, read);
    if (!actor.developer && (roleType(actor.role) !== 'admin' || !actor.role.permissions?.includes('role_manager'))) throw new IdentityError('permission-denied');
    const before = await read('roles',id);
    if (input.action === 'update' && !before) throw new IdentityError('not-found');
    const companyId = before?.companyId || (actor.developer ? input.companyId : actor.seller.companyId);
    if (!actor.developer && companyId !== actor.seller.companyId) throw new IdentityError('permission-denied');
    if (id === actor.seller.roleId && !(options.allowOwnerUpdate && actor.owner)) throw new IdentityError('permission-denied', 'Otro administrador debe cambiar los permisos de tu propio rol.');
    const company = await read('companies', companyId);
    if (!company || company.allowedViews?.length && input.permissions.some(p => !company.allowedViews.includes(p))) throw new IdentityError('permission-denied', 'Los permisos exceden los módulos de la empresa.');
    const users = await tx.get(db.collection('sellers').where('companyId','==',companyId));
    const roleIds = [...new Set(users.docs.filter(d=>!d.data().isDisabled).map(d=>d.data().roleId))];
    const roles = new Map(); for (const key of roleIds) roles.set(key, key===id ? input : await read('roles',key));
    for (const type of ['admin','seller']) {
      const configured = type === 'admin' ? company.maxAdmins : company.maxSellers;
      if (Number.isFinite(configured) && users.docs.filter(d=>!d.data().isDisabled && !(options.excludePlatformUsers && (d.id === OWNER_ID || d.data().platformRole === 'developer')) && roleType(roles.get(d.data().roleId))===type).length>configured) throw new IdentityError('resource-exhausted','El cambio excede las licencias de la empresa.');
    }
    tx.set(db.collection('roles').doc(id), { ...(options.preserveProfile ? before || {} : {}), id, companyId, name: input.name.trim(), userType: roleType(input), permissions: [...new Set(input.permissions)] });
    tx.update(db.collection('companies').doc(companyId), { identityRevision: (company.identityRevision || 0) + 1 });
    return {id};
  });
}
