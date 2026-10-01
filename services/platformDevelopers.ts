import { doc, runTransaction } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { Seller, View } from '../types';
import { assertPlatformOwnerAction, PLATFORM_OWNER_USER_ID } from './developerAccess';

export async function setPlatformDeveloper(db: Firestore, actor: Seller | null, view: View, userId: string, active: boolean) {
  assertPlatformOwnerAction(actor, view);
  if (userId === PLATFORM_OWNER_USER_ID) throw new Error('El acceso del propietario Carlos no se puede retirar.');
  await runTransaction(db, async transaction => {
    const seller = await transaction.get(doc(db, 'sellers', userId));
    if (!seller.exists()) throw new Error('No se encontró el usuario.');
    if (active && seller.data().isDisabled) throw new Error('Activa el usuario antes de asignarle Developer.');
    transaction.update(seller.ref, { platformRole: active ? 'developer' : null });
    transaction.set(doc(db, 'platformDevelopers', userId), {
      userId, role: 'developer', grantedBy: PLATFORM_OWNER_USER_ID, active, grantedAt: new Date().toISOString()
    });
  });
}
