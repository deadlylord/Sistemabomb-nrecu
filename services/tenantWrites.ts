import { measureDiagnosticPhase } from './readDiagnostics';
import { prepareFinancialOperations, sameFinancialVersion } from './financialMutations';
import { assertCompanyRole, isPlatformRole } from './developerAccess';
import { getDoc, setDoc, updateDoc, deleteDoc, doc, writeBatch, runTransaction } from './measuredFirestore';
import type { Firestore, DocumentReference, WriteBatch } from './measuredFirestore';
import { DEFAULT_COMPANY_ID, IncidentType } from '../types';

export type TenantScope = { companyId: string; storeIds: Set<string> };
export function assertTenantData(collectionName: string, data: any, scope: TenantScope) {
  if (!data) throw new Error('No se encontró el registro.');
  if (data.companyId && data.companyId !== scope.companyId) throw new Error('Operación bloqueada: el registro pertenece a otra empresa.');
  if (['companies', 'platformDevelopers'].includes(collectionName)) throw new Error('La gestión de empresas requiere acceso Developer.');
  if (['stores', 'categories', 'roles'].includes(collectionName)) {
    if ((data.companyId || DEFAULT_COMPANY_ID) !== scope.companyId) throw new Error('El registro pertenece a otra empresa.');
  } else if (data.storeId) {
    if (!scope.storeIds.has(data.storeId)) throw new Error('El registro pertenece a una sede de otra empresa.');
  } else if (collectionName === 'inventoryTransfers') {
    if (!scope.storeIds.has(data.fromStoreId) || !scope.storeIds.has(data.toStoreId)) throw new Error('El traslado incluye otra empresa.');
  } else if (collectionName === 'daily_notes') {
    if (data.tienda !== 'all' && !scope.storeIds.has(data.tienda)) throw new Error('La nota pertenece a otra empresa.');
    if (!data.companyId && data.tienda === 'all' && scope.companyId !== DEFAULT_COMPANY_ID) throw new Error('La nota histórica pertenece a la empresa original.');
  } else if (!data.companyId) throw new Error('El registro no identifica su empresa o sede.');
  for (const key of ['fromStoreId', 'toStoreId', 'debtStoreId', 'physicalStoreId']) {
    if (data[key] && !scope.storeIds.has(data[key])) throw new Error('La operación referencia una sede de otra empresa.');
  }
  if (collectionName === 'financialRecordsHistory') {
    for (const state of [data.previousState, data.newState, data.relatedPreviousState, data.relatedNewState]) {
      if (state) assertTenantData('financialRecords', state, scope);
    }
  }
}

type Operation = { kind: 'set' | 'update' | 'delete'; ref: DocumentReference; data?: any; options?: any };
const collectionName = (ref: DocumentReference) => ref.path.split('/')[0];

// All reads are document reads performed only when writing. Initial lists remain
// store-scoped subscriptions; repeated references share a read within the operation.
export function createTenantWriter(db: Firestore, scope: TenantScope) {
  const generated = new Set<string>();
  const validate = async (operations: Operation[], read: (ref: DocumentReference) => Promise<any>) => {
    const cache = new Map<string, any>();
    const pending = new Map(operations.filter(op => op.kind === 'set').map(op => [op.ref.path, op.data]));
    const load = async (ref: DocumentReference) => {
      if (!cache.has(ref.path)) cache.set(ref.path, generated.has(ref.path) ? { exists: () => false } : await read(ref));
      return cache.get(ref.path);
    };
    for (const op of operations) {
      const snapshot = await load(op.ref);
      const name = collectionName(op.ref);
      if (snapshot.exists()) {
        assertTenantData(name, snapshot.data(), scope);
        if (name === 'roles' && isPlatformRole(snapshot.data())) throw new Error('Este rol de plataforma no se modifica desde roles de empresa.');
      }
      if (op.kind === 'update' && !snapshot.exists()) throw new Error('No se encontró el registro a modificar.');
      if (op.kind === 'delete') continue;
      if (name === 'sellers' && op.data?.platformRole !== undefined) throw new Error('El rol de plataforma solo se asigna desde Developer Center por Carlos.');
      const data = { ...(snapshot.exists() ? snapshot.data() : {}), ...op.data, companyId: op.data?.companyId || scope.companyId };
      assertTenantData(name, data, scope);
      if (name === 'roles') assertCompanyRole(data);
      op.data = { ...op.data, companyId: scope.companyId };
      const references: DocumentReference[] = [];
      if (data.categoryId) references.push(doc(db, 'categories', data.categoryId));
      if (['sellers', 'customers'].includes(name) && data.storeId) references.push(doc(db, 'stores', data.storeId));
      if (data.roleId) references.push(doc(db, 'roles', data.roleId));
      if (data.productId && !data.productId.startsWith('voucher-')) references.push(doc(db, 'inventory', data.productId));
      for (const item of [...Object.values(data.items || {}), ...(name === 'incidents' ? [...(data.returnedItems || []), ...(data.takenItems || [])] : [])] as any[]) {
        const id = item?.productId || item?.id;
        if (id && !id.startsWith('voucher-')) references.push(doc(db, 'inventory', id));
      }
      for (const key of ['counts', 'productCounts', 'systemSnapshot', 'scannedCounts']) {
        const values = name === 'tagScanningSessions' && op.kind === 'update' ? op.data?.[key] : data[key];
        for (const id of Object.keys(values || {})) references.push(doc(db, 'inventory', id));
      }
      if (name === 'tagScanningSessions') {
        const previousScans = new Set(op.kind === 'update' && snapshot.exists() ? (snapshot.data().scanHistory || []).map((scan: any) => JSON.stringify([scan.id, scan.productId])) : []);
        for (const scan of op.data?.scanHistory || []) {
          if (scan.productId && !previousScans.has(JSON.stringify([scan.id, scan.productId]))) references.push(doc(db, 'inventory', scan.productId));
        }
        for (const key of Object.keys(op.data || {})) {
          if (key.startsWith('scannedCounts.')) references.push(doc(db, 'inventory', key.slice('scannedCounts.'.length)));
        }
      }
      // Historical links may outlive their source document. Existing targets,
      // however, must always belong to this company, including staged mirrors.
      const historicalReferences: DocumentReference[] = [];
      if (data.originalSaleId) historicalReferences.push(doc(db, 'sales', data.originalSaleId));
      if (data.saleId) historicalReferences.push(doc(db, 'sales', data.saleId));
      if (data.layawayId) historicalReferences.push(doc(db, 'layaways', data.layawayId));
      if (data.relatedRecordId) historicalReferences.push(doc(db, 'financialRecords', data.relatedRecordId));
      if (name === 'financialRecordsHistory' && data.recordId) historicalReferences.push(doc(db, 'financialRecords', data.recordId));
      for (const payment of Object.values(data.payments || {}) as any[]) {
        if (payment?.voucherId) historicalReferences.push(doc(db, 'giftVouchers', payment.voucherId));
      }
      for (const entry of data.verification || []) if (entry.categoryId) historicalReferences.push(doc(db, 'categories', entry.categoryId));
      for (const ref of historicalReferences) {
        const staged = pending.get(ref.path);
        const linked = staged ? null : await load(ref);
        const linkedData = staged ? { ...staged, companyId: staged.companyId || scope.companyId } : linked?.exists() ? linked.data() : null;
        if (linkedData) {
          assertTenantData(collectionName(ref), linkedData, scope);
          if (name === 'incidents' && collectionName(ref) === 'sales' && ref.id === data.originalSaleId && linkedData.storeId !== data.storeId) throw new Error('La venta original pertenece a otra sede.');
        }
      }
      let draftProductsLoaded = false;
      for (const ref of references) {
        // Keep the existing validation order and ownership checks. Once category
        // checks pass, fetch independent count references in bounded groups.
        // Reuse the per-commit cache across counts, snapshot and history.
        if (!draftProductsLoaded && collectionName(ref) === 'inventory' &&
            ['pendingDetailedVerifications', 'detailedVerificationHistory'].includes(name)) {
          draftProductsLoaded = true;
          const products = [...new Map(references.filter(item => collectionName(item) === 'inventory' && !pending.has(item.path) && !cache.has(item.path)).map(item => [item.path, item])).values()];
          if (products.length) await measureDiagnosticPhase('Borrador: comprobar productos', async () => {
            for (let offset = 0; offset < products.length; offset += 12) {
              await Promise.all(products.slice(offset, offset + 12).map(load));
            }
          });
        }
        const staged = pending.get(ref.path);
        const linked = staged ? null : await load(ref);
        if (!staged && !linked.exists()) throw new Error('No se encontró un registro vinculado.');
        const linkedData = staged ? { ...staged, companyId: staged.companyId || scope.companyId } : linked.data();
        assertTenantData(collectionName(ref), linkedData, scope);
        if (collectionName(ref) === 'roles') assertCompanyRole(linkedData);
        const expectedStore = name === 'inventoryTransfers' || (name === 'incidents' && data.type === IncidentType.INVENTORY_TRANSFER_REQUEST) ? data.fromStoreId : data.storeId;
        if (collectionName(ref) === 'inventory' && ['purchases', 'productHistory', 'stockTakes', 'pendingDetailedVerifications', 'detailedVerificationHistory', 'tagScanningSessions', 'inventoryTransfers', 'incidents'].includes(name)) {
          if (linkedData.storeId !== expectedStore) throw new Error('El producto vinculado pertenece a otra sede.');
          if (['pendingDetailedVerifications', 'detailedVerificationHistory'].includes(name) && linkedData.categoryId !== data.categoryId) throw new Error('El producto no pertenece a la categoría del conteo.');
        }
      }
    }
  };
  const apply = (target: any, op: Operation) => {
    if (op.kind === 'delete') target.delete(op.ref);
    else if (op.kind === 'update') target.update(op.ref, op.data);
    else if (op.options) target.set(op.ref, op.data, op.options);
    else target.set(op.ref, op.data);
  };
  const hasFinancialChanges = (operations: Operation[]) => operations.some(op => collectionName(op.ref) === 'financialRecords');
  const commitFinancial = async (operations: Operation[]) => {
    const startedAt = performance.now();
    let reads = 0, attempts = 0;
    await runTransaction(db, async transaction => {
      attempts++;
      const cache = new Map<string, Promise<any>>();
      const read = (ref: DocumentReference) => {
        if (!cache.has(ref.path)) { reads++; cache.set(ref.path, transaction.get(ref)); }
        return cache.get(ref.path)!;
      };
      // A stable audit ID is the receipt for a batch. Retrying the same draft
      // after a lost acknowledgement must not apply that batch twice.
      const receipt = operations.find(op => op.kind === 'set' && collectionName(op.ref) === 'financialRecordsHistory' && op.data?.recordId);
      if (receipt) {
        const saved = await measureDiagnosticPhase('Comprobar registro previo', () => read(receipt.ref));
        if (saved.exists()) {
          assertTenantData('financialRecordsHistory', saved.data(), scope);
          for (const audit of operations.filter(op => op.kind === 'set' && collectionName(op.ref) === 'financialRecordsHistory')) {
            const existing = await read(audit.ref);
            if (!existing.exists() || existing.data().recordId !== audit.data.recordId || existing.data().action !== audit.data.action ||
              !sameFinancialVersion(existing.data().newState, audit.data.newState)) throw new Error('Este lote ya fue registrado con otros datos. Revisa el libro y crea un movimiento nuevo.');
          }
          return;
        }
      }
      // Independent point reads share one in-flight promise per path. A long
      // manual batch must not wait for a network round trip for each row.
      await measureDiagnosticPhase('Lecturas de documentos', () => Promise.all(operations.filter(op => collectionName(op.ref) === 'financialRecords' ||
        collectionName(op.ref) === 'financialRecordsHistory' && !generated.has(op.ref.path)).map(op => read(op.ref))));
      const prepared = await measureDiagnosticPhase('Preparar movimientos', () => prepareFinancialOperations(db, operations, scope, read, assertTenantData));
      await measureDiagnosticPhase('Validar empresa y referencias', () => validate(prepared, read));
      for (const op of prepared) apply(transaction, op);
    });
    operations.forEach(op => generated.delete(op.ref.path));
    console.info('[Conciliación] Guardado confirmado', { totalMs: Math.round(performance.now() - startedAt), attempts, reads, movements: operations.filter(op => collectionName(op.ref) === 'financialRecords').length });
  };
  const makeQueue = (operations: Operation[], get?: any) => {
    const queue: any = { get,
      set(ref: DocumentReference, data: any, options?: any) { operations.push({ kind: 'set', ref, data, options }); return queue; },
      update(ref: DocumentReference, data: any) { operations.push({ kind: 'update', ref, data }); return queue; },
      delete(ref: DocumentReference) { operations.push({ kind: 'delete', ref }); return queue; }
    }; return queue;
  };
  return {
    registerNew(ref: DocumentReference) { generated.add(ref.path); },
    async setDoc(ref: DocumentReference, data: any, options?: any) {
      const operations: Operation[] = [{ kind: 'set', ref, data, options }]; if (hasFinancialChanges(operations)) return commitFinancial(operations); await validate(operations, getDoc);
      const result = options ? await setDoc(ref, operations[0].data, options) : await setDoc(ref, operations[0].data); generated.delete(ref.path); return result;
    },
    async updateDoc(ref: DocumentReference, data: any) {
      const operations: Operation[] = [{ kind: 'update', ref, data }]; if (hasFinancialChanges(operations)) return commitFinancial(operations); await validate(operations, getDoc); return updateDoc(ref, operations[0].data);
    },
    async deleteDoc(ref: DocumentReference) { if (collectionName(ref) === 'financialRecords') return commitFinancial([{ kind: 'delete', ref }]); await validate([{ kind: 'delete', ref }], getDoc); return deleteDoc(ref); },
    async addDoc(collection: any, data: any) { const ref = doc(collection); generated.add(ref.path); const operations: Operation[] = [{ kind: 'set', ref, data }]; if (hasFinancialChanges(operations)) await commitFinancial(operations); else { await validate(operations, getDoc); await setDoc(ref, operations[0].data); } generated.delete(ref.path); return ref; },
    writeBatch() {
      const operations: Operation[] = []; const queue = makeQueue(operations);
      queue.commit = async () => { if (hasFinancialChanges(operations)) return commitFinancial(operations); await validate(operations, getDoc); const batch = writeBatch(db); for (const op of operations) apply(batch, op); const result = await batch.commit(); operations.forEach(op => generated.delete(op.ref.path)); return result; };
      return queue as WriteBatch;
    },
    async runTransaction<T>(_: Firestore, callback: (transaction: any) => Promise<T>) {
      let committedPaths: string[] = [];
      const value = await runTransaction(db, async transaction => {
        const operations: Operation[] = [];
        const cache = new Map<string, any>();
        const read = async (ref: DocumentReference) => {
          if (!cache.has(ref.path)) cache.set(ref.path, await transaction.get(ref));
          return cache.get(ref.path);
        };
        const queue = makeQueue(operations, async (ref: DocumentReference) => {
          const snapshot = await read(ref);
          if (snapshot.exists()) assertTenantData(collectionName(ref), snapshot.data(), scope);
          return snapshot;
        });
        const result = await callback(queue);
        const prepared = hasFinancialChanges(operations) ? await prepareFinancialOperations(db, operations, scope, read, assertTenantData) : operations;
        await validate(prepared, read);
        for (const op of prepared) apply(transaction, op);
        committedPaths = operations.map(op => op.ref.path);
        return result;
      });
      committedPaths.forEach(path => generated.delete(path));
      return value;
    }
  };
}
