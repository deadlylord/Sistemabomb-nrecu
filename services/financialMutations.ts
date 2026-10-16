import { doc } from 'firebase/firestore';
import type { DocumentReference, Firestore } from 'firebase/firestore';
import type { FinancialRecord } from '../types';

export type FinancialOperation = { kind: 'set' | 'update' | 'delete'; ref: DocumentReference; data?: any; options?: any };
type Scope = { companyId: string; storeIds: Set<string> };
const collectionName = (ref: DocumentReference) => ref.path.split('/')[0];
const economicFields = ['amount', 'date', 'storeId', 'accountType', 'description', 'subCategory', 'debtStoreId', 'relatedRecordId', 'affectsCashBalance'];
export const sameFinancialVersion = (a: any, b: any) => economicFields.every(key => (a?.[key] ?? null) === (b?.[key] ?? null));
const plain = (data: any) => Object.fromEntries(Object.entries(data).filter(([key, value]) => value !== undefined && !['saldo', 'netImpact', 'runningBalance', 'ledgerTime', 'balanceAmount'].includes(key)));

export function linkedFinancialUpdate(before: FinancialRecord, after: FinancialRecord, mirror: FinancialRecord): FinancialRecord {
  // The historic pair determines whether this was a loan (opposite signs) or an
  // expense paid for another store (same sign). Do not infer this from a label.
  const sign = before.amount && mirror.amount ? Math.sign(before.amount * mirror.amount) :
    /^(cruce|préstamo)/i.test(before.subCategory || '') && /^(cruce|préstamo)/i.test(mirror.subCategory || '') ? -1 : 1;
  const amount = after.amount * sign;
  const detail = after.description.replace(/^Cruce [^:]+:\s*/i, '');
  const prefix = mirror.description.match(/^Cruce [^:]+:\s*/i)?.[0] || '';
  return { ...mirror, amount, date: after.date, accountType: after.accountType,
    type: amount < 0 ? 'expense' : 'income_manual', description: `${prefix}${detail}`,
    ...(!/^(cruce|préstamo)/i.test(before.subCategory || '') && after.subCategory !== before.subCategory ? { subCategory: after.subCategory } : {}) };
}

// Called inside the tenant writer's transaction, before ANY writes. Every read
// uses that transaction; stale screens cannot overwrite a newer financial edit.
export async function prepareFinancialOperations(
  db: Firestore, operations: FinancialOperation[], scope: Scope,
  read: (ref: DocumentReference) => Promise<any>, assertData: (name: string, data: any, scope: Scope) => void
): Promise<FinancialOperation[]> {
  const changes = operations.filter(op => collectionName(op.ref) === 'financialRecords');
  if (!changes.length) return operations;
  const result: FinancialOperation[] = operations.map(op => ({ ...op, data: op.data && { ...op.data } }));
  const byPath = new Map(changes.map(op => [op.ref.path, op]));
  if (byPath.size !== changes.length) throw new Error('Un movimiento no puede modificarse dos veces en el mismo lote.');
  const histories = result.filter(op => collectionName(op.ref) === 'financialRecordsHistory');
  const timestamp = new Date().toISOString();
  for (const change of changes) {
    const sourceSnapshot = await read(change.ref);
    const before = sourceSnapshot.exists() ? { ...sourceSnapshot.data(), id: change.ref.id } as FinancialRecord : null;
    if (before) assertData('financialRecords', before, scope);
    const history = histories.find(op => op.data?.recordId === change.ref.id);
    if (before && history?.data?.previousState && !sameFinancialVersion(before, history.data.previousState)) {
      throw new Error('Este movimiento cambió en otra ventana. Actualiza el libro antes de volver a editarlo.');
    }
    if (!before && history?.data?.previousState && history.data.action !== 'restore') throw new Error('El movimiento ya no existe. Actualiza el libro.');
    if (change.kind === 'update' && !before) throw new Error('El movimiento ya no existe. Actualiza el libro.');
    const after = change.kind === 'delete' ? null : plain({ ...((change.kind === 'update' || change.options?.merge) ? before || {} : {}), ...change.data, id: change.ref.id, companyId: scope.companyId }) as unknown as FinancialRecord;
    if (after) {
      assertData('financialRecords', after, scope);
      if (!Number.isFinite(after.amount) || !after.date || !Number.isFinite(new Date(after.date).getTime())) throw new Error('Revisa el monto y la fecha del movimiento.');
      if (before && (before.storeId !== after.storeId || before.relatedRecordId !== after.relatedRecordId || before.debtStoreId !== after.debtStoreId)) throw new Error('Para cambiar las sedes de un cruce, elimina el cruce y crea uno nuevo.');
      if (before && after.amount !== before.amount && after.type !== 'income_sales') after.type = after.amount < 0 ? 'expense' : 'income_manual';
      const target = result.find(op => op.ref.path === change.ref.path)!;
      target.kind = 'set'; target.data = after; target.options = undefined;
    }
    const relatedId = before?.relatedRecordId || after?.relatedRecordId;
    let mirrorBefore: FinancialRecord | null = null, mirrorAfter: FinancialRecord | null = null;
    if (relatedId) {
      const mirrorRef = doc(db, 'financialRecords', relatedId);
      const mirrorSnapshot = await read(mirrorRef);
      mirrorBefore = mirrorSnapshot.exists() ? { ...mirrorSnapshot.data(), id: relatedId } as FinancialRecord : null;
      if (mirrorBefore) assertData('financialRecords', mirrorBefore, scope);
      const explicit = byPath.get(mirrorRef.path);
      const restored = history?.data?.relatedPreviousState;
      if (explicit) {
        mirrorAfter = explicit.kind === 'delete' ? null : { ...(explicit.options?.merge || explicit.kind === 'update' ? mirrorBefore || {} : {}), ...explicit.data };
      } else if (history?.data?.action === 'restore' && restored) {
        mirrorAfter = plain({ ...restored, companyId: scope.companyId }) as unknown as FinancialRecord;
        result.push({ kind: 'set', ref: mirrorRef, data: mirrorAfter });
      } else if (before && mirrorBefore) {
        mirrorAfter = after ? linkedFinancialUpdate(before, after, mirrorBefore) : null;
        result.push(mirrorAfter ? { kind: 'set', ref: mirrorRef, data: plain(mirrorAfter) } : { kind: 'delete', ref: mirrorRef });
      } else {
        throw new Error('No se encontró la contraparte de este cruce. Revisa ambas sedes antes de modificarlo.');
      }
      const mate = mirrorAfter || mirrorBefore;
      const owner = after || before;
      if (!mate || !owner || mate.relatedRecordId !== change.ref.id || mate.debtStoreId !== owner.storeId || owner.debtStoreId !== mate.storeId || mate.storeId === owner.storeId) {
        throw new Error('El vínculo entre las dos sedes no coincide. No se guardó ningún cambio.');
      }
      assertData('financialRecords', mate, scope);
      if (after && mirrorAfter && (Math.abs(Math.abs(after.amount) - Math.abs(mirrorAfter.amount)) > 0.005 || after.accountType !== mirrorAfter.accountType || after.date !== mirrorAfter.date)) throw new Error('El monto, la fecha y la cuenta deben coincidir en las dos contrapartes.');
      if (!explicit) {
        const logRef = doc(db, 'financialRecordsHistory', crypto.randomUUID());
        result.push({ kind: 'set', ref: logRef, data: plain({ id: logRef.id, companyId: scope.companyId, recordId: relatedId,
          storeId: mate.storeId, accountType: mate.accountType, action: history?.data?.action || (after ? 'update' : 'delete'),
          timestamp, changedBy: history?.data?.changedBy || after?.registeredBy || before?.registeredBy || 'Sistema',
          previousState: mirrorBefore, newState: mirrorAfter, relatedPreviousState: before, relatedNewState: after }) });
      }
    }
    if (history) history.data = plain({ ...history.data, previousState: before, newState: after,
      ...(relatedId ? { relatedPreviousState: mirrorBefore, relatedNewState: mirrorAfter } : {}) });
  }
  return result;
}
