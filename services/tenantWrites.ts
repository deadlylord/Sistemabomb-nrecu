import { getDoc, setDoc, updateDoc, deleteDoc, doc, writeBatch, runTransaction } from 'firebase/firestore';
import type { Firestore, DocumentReference, WriteBatch } from 'firebase/firestore';
import { DEFAULT_COMPANY_ID } from '../types';

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
      if (snapshot.exists()) assertTenantData(name, snapshot.data(), scope);
      if (op.kind === 'update' && !snapshot.exists()) throw new Error('No se encontró el registro a modificar.');
      if (op.kind === 'delete') continue;
      if (name === 'sellers' && op.data?.platformRole !== undefined) throw new Error('El rol de plataforma solo se asigna desde Developer Center por Carlos.');
      const data = { ...(snapshot.exists() ? snapshot.data() : {}), ...op.data, companyId: op.data?.companyId || scope.companyId };
      assertTenantData(name, data, scope);
      op.data = { ...op.data, companyId: scope.companyId };
      const references: DocumentReference[] = [];
      if (data.categoryId) references.push(doc(db, 'categories', data.categoryId));
      if (data.roleId) references.push(doc(db, 'roles', data.roleId));
      if (data.productId && !data.productId.startsWith('voucher-')) references.push(doc(db, 'inventory', data.productId));
      for (const item of Object.values(data.items || {}) as any[]) {
        const id = item?.productId || item?.id;
        if (id && !id.startsWith('voucher-')) references.push(doc(db, 'inventory', id));
      }
      for (const key of ['counts', 'productCounts', 'systemSnapshot']) {
        for (const id of Object.keys(data[key] || {})) references.push(doc(db, 'inventory', id));
      }
      for (const ref of references) {
        const staged = pending.get(ref.path);
        if (staged) assertTenantData(collectionName(ref), { ...staged, companyId: staged.companyId || scope.companyId }, scope);
        else {
          const linked = await load(ref);
          if (!linked.exists()) throw new Error('No se encontró un registro vinculado.');
          assertTenantData(collectionName(ref), linked.data(), scope);
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
      const operations: Operation[] = [{ kind: 'set', ref, data, options }]; await validate(operations, getDoc);
      const result = options ? await setDoc(ref, operations[0].data, options) : await setDoc(ref, operations[0].data); generated.delete(ref.path); return result;
    },
    async updateDoc(ref: DocumentReference, data: any) {
      const operations: Operation[] = [{ kind: 'update', ref, data }]; await validate(operations, getDoc); return updateDoc(ref, operations[0].data);
    },
    async deleteDoc(ref: DocumentReference) { await validate([{ kind: 'delete', ref }], getDoc); return deleteDoc(ref); },
    async addDoc(collection: any, data: any) { const ref = doc(collection); generated.add(ref.path); const operations: Operation[] = [{ kind: 'set', ref, data }]; await validate(operations, getDoc); await setDoc(ref, operations[0].data); generated.delete(ref.path); return ref; },
    writeBatch() {
      const operations: Operation[] = []; const queue = makeQueue(operations);
      queue.commit = async () => { await validate(operations, getDoc); const batch = writeBatch(db); for (const op of operations) apply(batch, op); const result = await batch.commit(); operations.forEach(op => generated.delete(op.ref.path)); return result; };
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
        await validate(operations, read);
        for (const op of operations) apply(transaction, op);
        committedPaths = operations.map(op => op.ref.path);
        return result;
      });
      committedPaths.forEach(path => generated.delete(path));
      return value;
    }
  };
}
