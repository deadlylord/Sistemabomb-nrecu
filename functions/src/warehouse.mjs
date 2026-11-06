import { createHash } from 'node:crypto';
import { IdentityError } from './identity.mjs';
import { verifiedActor, roleType } from './stagingUsers.mjs';

const fail = (code, message) => { throw new IdentityError(code, message); };
const key = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const quantity = value => Number.isSafeInteger(value) && value >= 0;
const owns = (row, companyId, storeId) => row && row.companyId === companyId && row.storeId === storeId;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// All access is through the callable. The nested warehouse collections are
// private under the existing deny-all rules, including immutable audit records.
export async function warehouseOperation(db, auth, input) {
  if (!input || !key(input.companyId) || !key(input.storeId)) fail('invalid-argument', 'Empresa o tienda inválida.');
  const { companyId, storeId, action } = input;
  const root = db.collection('warehouseCompanies').doc(companyId).collection('stores').doc(storeId);
  const authorize = async read => {
    const actor = await verifiedActor(auth, read);
    const admin = roleType(actor.role) === 'admin' && actor.role.userType !== 'seller';
    // No developer bypass: warehouse scope is always the actor's own company.
    if (actor.seller.companyId !== companyId || (!admin && actor.seller.storeId !== storeId)) fail('permission-denied', 'Solo puedes gestionar la bodega de tu tienda.');
    const store = await read('stores', storeId);
    if (!store || store.companyId !== companyId || store.isDisabled || store.status === 'inactive') fail('permission-denied', 'Tienda no disponible.');
    if (!actor.role.permissions?.some(p => ['pos', 'inventory'].includes(p)) || actor.company.allowedViews?.length && !actor.company.allowedViews.some(p => ['pos', 'inventory'].includes(p))) fail('permission-denied', 'Tu rol no tiene acceso al inventario de esta empresa.');
    return actor;
  };
  const read = async (collection, id) => { const s = await db.collection(collection).doc(id).get(); return s.exists ? s.data() : null; };
  if (['summary', 'products', 'history', 'counts', 'draft'].includes(action)) {
    const actor = await authorize(read);
    if (action === 'summary') {
      const snapshot = await root.collection('categories').get();
      return { rows: snapshot.docs.map(d => ({ ...d.data(), id: d.id })) };
    }
    if (action === 'draft') {
      if (!key(input.categoryId)) fail('invalid-argument', 'Categoría inválida.');
      const d = await root.collection('drafts').doc(hash([actor.id, input.categoryId])).get();
      return { draft: d.exists ? d.data() : null };
    }
    const collection = action === 'products' ? 'products' : action === 'counts' ? 'counts' : 'movements';
    let query = root.collection(collection);
    if (action === 'products') {
      if (!key(input.categoryId)) fail('invalid-argument', 'Categoría inválida.');
      query = query.where('categoryId', '==', input.categoryId);
    }
    // Default document-ID ordering needs no new composite index. Movement/count
    // IDs begin with a reverse timestamp, so newest records are listed first.
    if (input.cursor !== undefined) {
      if (typeof input.cursor !== 'string' || !key(input.cursor)) fail('invalid-argument', 'Página inválida.');
      const cursor = await root.collection(collection).doc(input.cursor).get();
      if (!cursor.exists || action === 'products' && cursor.data().categoryId !== input.categoryId) fail('invalid-argument', 'Página inválida.');
      query = query.startAfter(cursor);
    }
    const result = await query.limit(51).get();
    return { rows: result.docs.slice(0, 50).map(d => ({ ...d.data(), id: d.id })), cursor: result.docs.length > 50 ? result.docs[49].id : null };
  }
  if (!key(input.operationId)) fail('invalid-argument', 'Identificador de operación inválido.');
  const receiptRef = root.collection('receipts').doc(input.operationId);
  return db.runTransaction(async tx => {
    const actor = await authorize(async (collection, id) => { const s = await tx.get(db.collection(collection).doc(id)); return s.exists ? s.data() : null; });
    const fingerprint = hash({ ...input, actorId: actor.id });
    const receipt = await tx.get(receiptRef);
    if (receipt.exists) {
      if (receipt.data().fingerprint !== fingerprint) fail('already-exists', 'Esta operación ya se guardó con otros datos.');
      return receipt.data().result;
    }
    const now = new Date().toISOString();
    const recordId = `${String(9999999999999 - Date.parse(now)).padStart(13, '0')}_${input.operationId}`;
    let result = { id: recordId };
    if (action === 'move' || action === 'reverse') {
      let movement = input;
      let original, originalRef;
      if (action === 'reverse') {
        if (roleType(actor.role) !== 'admin' || actor.role.userType === 'seller' || !key(input.movementId)) fail('permission-denied', 'Solo un administrador puede revertir un movimiento.');
        originalRef = root.collection('movements').doc(input.movementId);
        original = await tx.get(originalRef);
        if (!original.exists || original.data().reversedBy || original.data().reversalOf) fail('failed-precondition', 'El movimiento no se puede revertir.');
        movement = { ...original.data(), direction: original.data().direction === 'toWarehouse' ? 'toStore' : 'toWarehouse' };
      }
      const { productId, direction } = movement, units = movement.quantity;
      if (!key(productId) || !quantity(units) || units < 1 || !['toWarehouse', 'toStore'].includes(direction) || typeof (input.note || '') !== 'string' || (input.note || '').length > 500) fail('invalid-argument', 'Revisa producto, dirección y cantidad.');
      const localRef = db.collection('inventory').doc(productId), warehouseRef = root.collection('products').doc(productId);
      const [local, warehouse] = await Promise.all([tx.get(localRef), tx.get(warehouseRef)]);
      const p = local.exists ? local.data() : null, w = warehouse.exists ? warehouse.data() : null;
      if (!p || p.storeId !== storeId || (p.companyId || 'default_company') !== companyId || p.isDisabled || !key(p.categoryId)) fail('permission-denied', 'El producto no pertenece al inventario activo de esta tienda.');
      if (w && (!owns(w, companyId, storeId) || w.categoryId !== p.categoryId && w.stock > 0)) fail('failed-precondition', 'La categoría del producto cambió; un administrador debe revisar su ubicación.');
      const localBefore = p.stock, warehouseBefore = w?.stock || 0;
      if ((p.warehouseUnits || 0) !== warehouseBefore) fail('failed-precondition', 'Las existencias enlazadas de bodega requieren revisión.');
      if (!quantity(localBefore) || !quantity(warehouseBefore)) fail('failed-precondition', 'Las existencias actuales requieren revisión.');
      const delta = direction === 'toWarehouse' ? units : -units;
      const localAfter = localBefore - delta, warehouseAfter = warehouseBefore + delta;
      if (!quantity(localAfter) || !quantity(warehouseAfter)) fail('failed-precondition', 'No hay existencias suficientes en el origen.');
      const categoryRef = root.collection('categories').doc(p.categoryId), category = await tx.get(categoryRef);
      const categoryBefore = category.exists ? category.data().stock : 0;
      if (!quantity(categoryBefore) || !quantity(categoryBefore + delta)) fail('failed-precondition', 'El resumen de bodega requiere revisión.');
      const record = { companyId, storeId, productId, productName: p.name, categoryId: p.categoryId, supplier: p.supplier || '', direction, quantity: units, localBefore, localAfter, warehouseBefore, warehouseAfter, createdAt: now, actorId: actor.id, actorName: actor.seller.name, note: input.note || '', ...(original ? { reversalOf: input.movementId } : {}) };
      tx.update(localRef, { companyId, stock: localAfter, warehouseUnits: warehouseAfter });
      tx.set(warehouseRef, { companyId, storeId, productId, name: p.name, supplier: p.supplier || '', categoryId: p.categoryId, stock: warehouseAfter, updatedAt: now });
      tx.set(categoryRef, { companyId, storeId, stock: categoryBefore + delta, revision: (category.data()?.revision || 0) + 1, updatedAt: now });
      tx.create(root.collection('movements').doc(recordId), record);
      tx.create(db.collection('productHistory').doc(`warehouse_${input.operationId}`), { companyId, storeId, productId, productName: p.name, timestamp: now, changedBy: actor.seller.name, changeType: direction === 'toWarehouse' ? 'Enviado a bodega' : 'Regreso de bodega', stockDelta: -delta, details: `${units} unidades · ${record.note}`, warehouseMovementId: recordId });
      if (original) tx.update(originalRef, { reversedBy: recordId });
    } else if (action === 'count' || action === 'draftSave' || action === 'adjust') {
      const entries = input.entries;
      if (!Array.isArray(entries) || !entries.length || entries.length > 100 || new Set(entries.map(e => e.categoryId)).size !== entries.length) fail('invalid-argument', 'Ingresa entre 1 y 100 categorías distintas.');
      const verified = [];
      for (const entry of entries) {
        if (!key(entry.categoryId) || !quantity(entry.physicalCount) || !quantity(entry.revision)) fail('invalid-argument', 'Conteo inválido.');
        const s = await tx.get(root.collection('categories').doc(entry.categoryId));
        const stock = s.exists ? s.data().stock : 0, revision = s.exists ? s.data().revision || 0 : 0;
        if (revision !== entry.revision) fail('aborted', 'Hubo movimientos mientras contabas. Actualiza y revisa las cantidades antes de guardar.');
        verified.push({ categoryId: entry.categoryId, systemStock: stock, physicalCount: entry.physicalCount, difference: entry.physicalCount - stock, revision });
      }
      if (action === 'adjust' && (roleType(actor.role) !== 'admin' || actor.role.userType === 'seller')) fail('permission-denied', 'Solo un administrador puede aplicar ajustes.');
      const adjustments = [];
      const details = input.productCounts || {};
      if (typeof details !== 'object' || Array.isArray(details) || Object.keys(details).length > 300) fail('invalid-argument', 'Demasiados productos en el conteo.');
      for (const [id, value] of Object.entries(details)) {
        if (!key(id) || !quantity(value)) fail('invalid-argument', 'Detalle inválido.');
        const p = await tx.get(root.collection('products').doc(id));
        if (!p.exists || !owns(p.data(),companyId,storeId) || !verified.some(v => v.categoryId === p.data().categoryId)) fail('permission-denied', 'El detalle no pertenece al conteo.');
        if (action === 'adjust') {
          const local = await tx.get(db.collection('inventory').doc(id));
          if (!local.exists || !owns(local.data(),companyId,storeId) || local.data().categoryId !== p.data().categoryId || local.data().warehouseUnits !== p.data().stock) fail('failed-precondition', 'La referencia local cambió; revisa su vínculo con bodega.');
        }
        adjustments.push({ productId: id, categoryId: p.data().categoryId, before: p.data().stock, after: value });
      }
      if (action === 'adjust') {
        for (const category of verified) {
          const delta = adjustments.filter(p => p.categoryId === category.categoryId).reduce((sum,p) => sum + p.after - p.before,0);
          if (category.systemStock + delta !== category.physicalCount) fail('failed-precondition', 'El detalle contado no coincide con el total de la categoría.');
        }
        for (const p of adjustments) {
          tx.update(root.collection('products').doc(p.productId), { stock: p.after, updatedAt: now });
          tx.update(db.collection('inventory').doc(p.productId), { warehouseUnits: p.after });
        }
        for (const category of verified) tx.update(root.collection('categories').doc(category.categoryId), { stock: category.physicalCount, revision: category.revision + 1, updatedAt: now });
      }
      const row = { companyId, storeId, createdAt: now, actorId: actor.id, actorName: actor.seller.name, verification: verified, productCounts: details, productAdjustments: action === 'adjust' ? adjustments : [], isApplied: action === 'adjust' };
      if (action === 'draftSave') {
        if (entries.length !== 1) fail('invalid-argument', 'Guarda una categoría por borrador.');
        tx.set(root.collection('drafts').doc(hash([actor.id, entries[0].categoryId])), row);
      } else tx.create(root.collection('counts').doc(recordId), row);
    } else fail('invalid-argument', 'Acción inválida.');
    tx.create(receiptRef, { fingerprint, result, actorId: actor.id, createdAt: now });
    return result;
  });
}
