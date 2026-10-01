import { isPlatformRole } from './developerAccess';
import { doc, getDoc, runTransaction } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { DEFAULT_COMPANY_ID, View, type Role } from '../types';

// Preserve a legacy role's permissions, but assign an independent role ID to each
// company. Existing tenant roles are never replaced by the legacy template.
export async function ensureCompanyRole(db: Firestore, sourceId: string, companyId: string) {
  const source = await getDoc(doc(db, 'roles', sourceId));
  if (!source.exists()) throw new Error('No se encontró el rol del usuario.');
  if (isPlatformRole(source.data() as Role)) throw new Error('Developer no se copia como rol de empresa.');
  const owner = source.data().companyId || DEFAULT_COMPANY_ID;
  if (owner === companyId) return sourceId;
  if (owner !== DEFAULT_COMPANY_ID) throw new Error('El rol pertenece a otra empresa.');
  const targetId = `${companyId}__role__${sourceId}`;
  await runTransaction(db, async transaction => {
    const original = await transaction.get(source.ref);
    const ref = doc(db, 'roles', targetId);
    const existing = await transaction.get(ref);
    if (!original.exists()) throw new Error('El rol original ya no existe.');
    if ((original.data().companyId || DEFAULT_COMPANY_ID) !== DEFAULT_COMPANY_ID) throw new Error('El rol original cambió de empresa.');
    if (existing.exists() && existing.data().companyId !== companyId) throw new Error('El rol destino pertenece a otra empresa.');
    if (isPlatformRole(original.data() as Role)) throw new Error('Developer no se copia como rol de empresa.');
    if (!existing.exists()) transaction.set(ref, { ...original.data(), permissions: (original.data().permissions || []).filter((view: View) => view !== View.DEVELOPER_CENTER), id: targetId, companyId });
  });
  return targetId;
}
