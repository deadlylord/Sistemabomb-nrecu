// Carlos explicitly authorizes this synthetic account in the staging project only.
// Project validation is repeated here before any database read or write.
import { assertStagingConfig, STAGING_COMPANY } from './stagingSecondStore.mjs';
export const DEVELOPER_ID = 'staging_developer';
export const DEVELOPER_USERNAME = 'stagingdeveloper';

export async function seedStagingDeveloper(db, { doc, runTransaction }, config, password) {
  assertStagingConfig(config);
  if (typeof password !== 'string' || password.trim() !== password || password.length < 12) {
    throw new Error('Define STAGING_DEVELOPER_PASSWORD con al menos 12 caracteres y sin espacios al inicio/final');
  }
  return runTransaction(db, async transaction => {
    const refs = [
      doc(db, 'companies', STAGING_COMPANY), doc(db, 'stores', 'staging_store_01'),
      doc(db, 'roles', 'staging_admin_role'), doc(db, 'sellers', DEVELOPER_ID),
      doc(db, 'platformDevelopers', DEVELOPER_ID),
    ];
    const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
    const [company, store, role, seller, grant] = snapshots.map(snapshot => snapshot.exists() ? snapshot.data() : undefined);
    if (!company || store?.companyId !== STAGING_COMPANY || role?.companyId !== STAGING_COMPANY ||
        role.userType !== 'admin' || !['pos', 'inventory'].every(view => role.permissions?.includes(view))) {
      throw new Error('SAFETY STOP: faltan empresa, tienda o rol administrador válidos de staging');
    }
    // Never repair/overwrite a conflicting or revoked identity silently.
    if (seller || grant) {
      if (seller?.companyId !== STAGING_COMPANY || seller.storeId !== 'staging_store_01' ||
          seller.roleId !== 'staging_admin_role' || seller.username !== DEVELOPER_USERNAME || seller.isDisabled ||
          grant?.userId !== DEVELOPER_ID || grant.role !== 'developer' || grant.active !== true ||
          grant.grantedBy !== '-OYqLOlA2gyy_TrUtzf2') {
        throw new Error('SAFETY STOP: cuenta o autorización existente incompatible; no se sobrescribe ni reactiva');
      }
      return 0;
    }
    transaction.set(refs[3], {
      id: DEVELOPER_ID, companyId: STAGING_COMPANY, storeId: 'staging_store_01', roleId: 'staging_admin_role',
      name: 'Developer Staging', username: DEVELOPER_USERNAME, password, platformRole: 'developer', isDisabled: false,
    });
    transaction.set(refs[4], {
      userId: DEVELOPER_ID, role: 'developer', active: true,
      grantedBy: '-OYqLOlA2gyy_TrUtzf2', grantedAt: new Date().toISOString(),
    });
    return 2;
  });
}
