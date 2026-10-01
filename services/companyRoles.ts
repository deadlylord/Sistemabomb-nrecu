import { doc, getDoc, runTransaction } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { DEFAULT_COMPANY_ID } from '../types';

// Preserve a legacy role's permissions, but assign an independent role ID to each
// company. Existing tenant roles are never replaced by the legacy template.
export async function ensureCompanyRole(db: Firestore, sourceId: string, companyId: string) {
  const source = await getDoc(doc(db, 'roles', sourceId));
  if (!source.exists()) throw new Error('No se encontró el rol del usuario.');
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
    if (!existing.exists()) transaction.set(ref, { ...original.data(), id: targetId, companyId });
  });
  return targetId;
}
