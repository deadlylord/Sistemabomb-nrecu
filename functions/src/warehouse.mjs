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
    const views = action === 'purchaseMove' ? ['purchases'] : ['pos', 'inventory'];
    if (action === 'settings') views.push('purchases');
    if (!views.some(view => actor.role.permissions?.includes(view) && (!actor.company.allowedViews?.length || actor.company.allowedViews.includes(view)))) fail('permission-denied', 'Tu rol no tiene acceso a esta operación.');
    return { ...actor, store, admin };
  };
  const read = async (collection, id) => { const s = await db.collection(collection).doc(id).get(); return s.exists ? s.data() : null; };
  if (['summary', 'products', 'history', 'counts', 'draft'].includes(action)) {
    const actor = await authorize(read);
    if (['history', 'counts'].includes(action) && (roleType(actor.role) !== 'admin' || actor.role.userType === 'seller')) fail('permission-denied', 'Solo un administrador puede consultar el historial de bodega.');
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
    const cutoff = action === 'history' ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() : null;
    const pageSize = cutoff ? 25 : 50;
    if (cutoff) query = query.where('createdAt', '>=', cutoff).orderBy('createdAt', 'desc');
    if (input.cursor !== undefined) {
      if (typeof input.cursor !== 'string' || !key(input.cursor)) fail('invalid-argument', 'Página inválida.');
      const cursor = await root.collection(collection).doc(input.cursor).get();
      if (!cursor.exists || action === 'products' && cursor.data().categoryId !== input.categoryId || cutoff && cursor.data().createdAt < cutoff) fail('invalid-argument', 'Página inválida.');
      query = query.startAfter(cursor);
    }
    const result = await query.limit(pageSize + 1).get();
    return { rows: result.docs.slice(0, pageSize).map(d => ({ ...d.data(), id: d.id })), cursor: result.docs.length > pageSize ? result.docs[pageSize - 1].id : null };
  }
  if (action === 'settings') {
    const { sendEnabled, categoryVisible } = input;
    if ((sendEnabled === undefined && categoryVisible === undefined) ||
        (sendEnabled !== undefined && typeof sendEnabled !== 'boolean') ||
        (categoryVisible !== undefined && typeof categoryVisible !== 'boolean')) {
      fail('invalid-argument', 'Configuración de bodega inválida.');
    }
    return db.runTransaction(async tx => {
      const actor = await authorize(async (collection, id) => {
        const doc = await tx.get(db.collection(collection).doc(id));
        return doc.exists ? doc.data() : null;
      });
      if (!actor.admin) fail('permission-denied', 'Solo un administrador puede configurar la bodega.');
      tx.update(db.collection('stores').doc(storeId), {
        ...(sendEnabled !== undefined ? { warehouseSendEnabled: sendEnabled } : {}),
        ...(categoryVisible !== undefined ? { warehouseCategoryVisible: categoryVisible } : {}),
      });
      return { saved: true };
    });
  }
  if (!key(input.operationId) || action === 'purchaseMove' && input.operationId.length > 100) fail('invalid-argument', 'Identificador de operación inválido.');
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
    if (action === 'move' || action === 'reverse' || action === 'purchaseMove') {
      let movement = input;
      let original, originalRef;
      if (action === 'reverse') {
        if (roleType(actor.role) !== 'admin' || actor.role.userType === 'seller' || !key(input.movementId)) fail('permission-denied', 'Solo un administrador puede revertir un movimiento.');
        originalRef = root.collection('movements').doc(input.movementId);
        original = await tx.get(originalRef);
        if (!original.exists || original.data().reversedBy || original.data().reversalOf) fail('failed-precondition', 'El movimiento no se puede revertir.');
        movement = { ...original.data(), direction: original.data().direction === 'toWarehouse' ? 'toStore' : 'toWarehouse' };
      }
      const direction = action === 'purchaseMove' ? 'toWarehouse' : movement.direction;
      if (!['toWarehouse', 'toStore'].includes(direction) || typeof (input.note || '') !== 'string' || (input.note || '').length > 500) fail('invalid-argument', 'Revisa dirección y nota.');
      if (direction === 'toWarehouse' && action !== 'reverse' && actor.store.warehouseSendEnabled === false) fail('failed-precondition', 'El envío a bodega está desactivado en esta sede.');

      const items = new Map();
      const dispatchRefs = [];
      if (action === 'purchaseMove') {
        const entries = input.entries;
        if (!Array.isArray(entries) || !entries.length || entries.length > 25 ||
          entries.some(entry => !key(entry?.purchaseId) || !quantity(entry.quantity) || entry.quantity < 1) ||
          new Set(entries.map(entry => entry.purchaseId)).size !== entries.length) fail('invalid-argument', 'Selecciona entre 1 y 25 compras distintas y cantidades válidas.');
        for (const { purchaseId, quantity: units } of entries) {
          const dispatchRef = root.collection('purchaseDispatches').doc(purchaseId);
          const [purchase, dispatch] = await Promise.all([tx.get(db.collection('purchases').doc(purchaseId)), tx.get(dispatchRef)]);
          const row = purchase.data();
          if (!owns(row, companyId, storeId) || !key(row.productId)) fail('permission-denied', 'La compra no pertenece a esta sede.');
          if (dispatch.exists) fail('already-exists', 'La compra ya fue enviada a bodega.');
          if (!quantity(row.quantity) || units > row.quantity) fail('failed-precondition', 'La cantidad supera las unidades registradas en la compra.');
          const item = items.get(row.productId) || { units: 0, purchaseIds: [] };
          item.units += units;
          item.purchaseIds.push(purchaseId);
          items.set(row.productId, item);
          dispatchRefs.push({ ref: dispatchRef, quantity: units });
        }
      } else {
        items.set(movement.productId, { units: movement.quantity });
      }

      const categories = new Map();
      const moves = [];
      for (const [productId, { units, purchaseIds }] of items) {
        if (!key(productId) || !quantity(units) || units < 1) fail('invalid-argument', 'Revisa producto y cantidad.');
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
        let category = categories.get(p.categoryId);
        if (!category) {
          const ref = root.collection('categories').doc(p.categoryId);
          const snapshot = await tx.get(ref);
          category = { ref, stock: snapshot.exists ? snapshot.data().stock : 0, revision: snapshot.data()?.revision || 0 };
          categories.set(p.categoryId, category);
        }
        if (!quantity(category.stock) || !quantity(category.stock + delta)) fail('failed-precondition', 'El resumen de bodega requiere revisión.');
        category.stock += delta;
        const suffix = action === 'purchaseMove' ? `_${moves.length}` : '';
        const id = recordId + suffix;
        const record = { companyId, storeId, productId, productName: p.name, categoryId: p.categoryId, supplier: p.supplier || '', direction, quantity: units, localBefore, localAfter, warehouseBefore, warehouseAfter, createdAt: now, actorId: actor.id, actorName: actor.seller.name, note: input.note || '', ...(original ? { reversalOf: input.movementId } : {}), ...(purchaseIds ? { purchaseIds } : {}) };
        moves.push({ id, suffix, localRef, warehouseRef, record, delta });
      }

      for (const { ref, stock, revision } of categories.values()) {
        tx.set(ref, { companyId, storeId, stock, revision: revision + 1, updatedAt: now });
      }
      for (const { id, suffix, localRef, warehouseRef, record, delta } of moves) {
        const { productId, productName, categoryId, supplier, warehouseAfter, localAfter } = record;
        tx.update(localRef, { companyId, stock: localAfter, warehouseUnits: warehouseAfter });
        tx.set(warehouseRef, { companyId, storeId, productId, name: productName, supplier, categoryId, stock: warehouseAfter, updatedAt: now });
        tx.create(root.collection('movements').doc(id), record);
        // Preserve stock balances while keeping the audit private.
        tx.create(db.collection('productHistory').doc(`warehouse_${input.operationId}${suffix}`), {
          companyId, storeId, productId, productName, timestamp: now,
          changedBy: 'Sistema', changeType: 'Cambio de ubicación',
          stockDelta: -delta, details: 'Actualización de existencias disponibles.'
        });
      }
      for (const { ref, quantity } of dispatchRefs) tx.create(ref, { operationId: input.operationId, quantity, createdAt: now });
      if (original) tx.update(originalRef, { reversedBy: recordId });
      if (action === 'purchaseMove') result = { id: recordId, purchaseIds: input.entries.map(entry => entry.purchaseId) };
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
