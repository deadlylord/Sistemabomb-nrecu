import { IdentityError, DEFAULT_COMPANY } from './identity.mjs';
import { verifiedActor } from './stagingUsers.mjs';
const fail = (code, message) => { throw new IdentityError(code, message); };
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const finite = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
const admin = role => role.userType === 'admin' || !role.userType && (['admin','administrator','administrador'].includes(String(role.name || '').trim().toLowerCase()) || role.permissions?.some(p => ['role_manager','ceo_center'].includes(p)));

// Staging-only adapter uses Admin SDK; every permission/ownership check therefore
// runs here, in the same transaction as the inventory and persisted status.
export async function approveTransferRequest(db, auth, input) {
  if (!input || !id(input.companyId) || !id(input.storeId) || !id(input.incidentId) || Object.keys(input).some(k => !['companyId','storeId','incidentId','diagnostics'].includes(k))) fail('invalid-argument', 'Solicitud de aprobación inválida.');
  const {companyId, storeId, incidentId} = input;
  const started = performance.now(); let attempts = 0, reads = 0;
  const result = await db.runTransaction(async tx => {
    attempts++;
    const cache = new Map();
    const ref = (collection, key) => { if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(key)) fail('invalid-argument','Referencia inválida.'); return db.collection(collection).doc(key); };
    const read = async (collection, key) => {
      const r = ref(collection, key);
      if (!cache.has(r.path)) { reads++; cache.set(r.path, tx.get(r)); }
      const s = await cache.get(r.path); return s.exists ? s.data() : null;
    };
    const actor = await verifiedActor(auth, read);
    if (!actor.developer && (actor.seller.companyId !== companyId || !admin(actor.role) || !actor.role.permissions?.includes('incidents') || actor.company.allowedViews?.length && !actor.company.allowedViews.includes('incidents'))) fail('permission-denied','No tienes permiso para aprobar esta novedad.');
    const company = await read('companies',companyId);
    if (!company || company.isDisabled || ['inactive','suspended'].includes(company.status)) fail('permission-denied','Empresa no disponible.');
    const store = async key => {
      const row = await read('stores', key);
      if (!row || (row.companyId || DEFAULT_COMPANY) !== companyId || row.isDisabled || row.status === 'inactive') fail('permission-denied','La sede no pertenece a la empresa o no está disponible.');
      return row;
    };
    await store(storeId);
    const saved = await read('incidents',incidentId);
    if (!saved || saved.type !== 'Solicitud de Traslado' || saved.storeId !== storeId || saved.companyId && saved.companyId !== companyId) fail('permission-denied','La solicitud no pertenece a esta empresa y sede.');
    const transferId = `request_${incidentId}`;
    const receipt = await read('inventoryTransfers',transferId);
    if (receipt && (receipt.companyId !== companyId || receipt.fromStoreId !== saved.fromStoreId || receipt.toStoreId !== saved.toStoreId || receipt.productId !== saved.productId || receipt.quantity !== saved.quantity)) fail('failed-precondition','El comprobante no coincide con la solicitud.');
    if (saved.status === 'Traslado Completado') return {processed:true, alreadyProcessed:true};
    if (saved.status !== 'Traslado Solicitado') fail('failed-precondition','La solicitud no está pendiente.');
    if (receipt) fail('failed-precondition','Existe un traslado registrado para esta solicitud pendiente. Revisa su estado.');
    if (!id(saved.fromStoreId) || !id(saved.toStoreId) || saved.fromStoreId === saved.toStoreId || !id(saved.productId) || !Number.isSafeInteger(saved.quantity) || saved.quantity <= 0) fail('invalid-argument','Revisa las sedes y cantidad del traslado.');
    const [fromStore,toStore] = await Promise.all([store(saved.fromStoreId),store(saved.toStoreId)]);
    const owns = (row, expectedStore) => {
      if (!row || row.storeId !== expectedStore || row.companyId && row.companyId !== companyId) fail('permission-denied','El producto pertenece a otra empresa o sede.');
    };
    const source = await read('inventory',saved.productId); owns(source,saved.fromStoreId);
    if (!finite(source.stock) || source.stock < saved.quantity || typeof source.name !== 'string' || !source.name || !finite(source.cost) || source.cost < 0 || !finite(source.cost * saved.quantity)) fail('failed-precondition','Revisa el stock y costo del producto de origen.');
    // Admin transactions support queries: destination selection participates in
    // concurrency checks instead of running an unrelated client-side lookup.
    const query = db.collection('inventory').where('storeId','==',saved.toStoreId).where('name','==',source.name).limit(2);
    reads++;
    const matches = await tx.get(query);
    if (matches.docs.length !== 1) fail('failed-precondition', matches.docs.length ? 'Hay varios productos con ese nombre en destino.' : 'El producto debe existir en destino.');
    const destinationDoc = matches.docs[0], destination = destinationDoc.data(); owns(destination,saved.toStoreId);
    if (!finite(destination.stock) || !finite(destination.stock + saved.quantity) || destination.name !== source.name) fail('failed-precondition','Revisa el producto de destino.');
    for (const product of [source,destination]) if (product.categoryId) {
      const category = await read('categories',product.categoryId);
      if (!category || (category.companyId || DEFAULT_COMPANY) !== companyId) fail('permission-denied','La categoría no pertenece a la empresa.');
    }
    // Preserve tenantWriter checks on any historical links retained by a request.
    for (const [field,collection] of [['originalSaleId','sales'],['saleId','sales'],['layawayId','layaways'],['relatedRecordId','financialRecords']]) if (saved[field]) {
      const linked = await read(collection,saved[field]);
      if (linked) {
        if (linked.companyId && linked.companyId !== companyId) fail('permission-denied','La referencia pertenece a otra empresa.');
        if (linked.storeId) await store(linked.storeId);
        else if (linked.companyId !== companyId) fail('permission-denied','La referencia no identifica su empresa.');
        if (field === 'originalSaleId' && linked.storeId !== storeId) fail('permission-denied','La venta pertenece a otra sede.');
      }
    }
    if (saved.returnedItems?.length || saved.takenItems?.length) fail('invalid-argument','La solicitud de traslado contiene prendas de otro tipo de novedad.');
    if (saved.history !== undefined && !Array.isArray(saved.history)) fail('invalid-argument','Historial inválido.');
    const now = new Date().toISOString(), quantity = saved.quantity;
    const sellerName = typeof saved.sellerName === 'string' ? saved.sellerName : actor.seller.name;
    tx.update(ref('inventory',saved.productId),{stock:source.stock - quantity});
    tx.update(destinationDoc.ref,{stock:destination.stock + quantity,...(destination.isDisabled ? {isDisabled:false} : {})});
    tx.create(ref('inventoryTransfers',transferId),{id:transferId,companyId,fromStoreId:saved.fromStoreId,toStoreId:saved.toStoreId,productId:saved.productId,toProductId:destinationDoc.id,productName:source.name,quantity,productCost:source.cost,totalCost:source.cost * quantity,createdAt:now,sellerName,processedByUserId:actor.id,settled:false});
    for (const [suffix,productId,product,type,delta,details] of [
      ['out',saved.productId,source,'Traslado (Salida)',-quantity,`-${quantity} a ${toStore.name || 'sede destino'} (antes: ${source.stock})`],
      ['in',destinationDoc.id,destination,'Traslado (Entrada)',quantity,`+${quantity} desde ${fromStore.name || 'sede origen'} (antes: ${destination.stock})`]
    ]) {
      const logId = `transfer_request_${incidentId}_${suffix}`;
      tx.create(ref('productHistory',logId),{id:logId,companyId,storeId:product.storeId,productId,productName:product.name,changedBy:actor.seller.name || 'Administrador',timestamp:now,changeType:type,stockDelta:delta,details,transferId});
    }
    tx.update(ref('incidents',incidentId),{status:'Traslado Completado',resolutionDate:now,history:[...(saved.history || []),{status:'Traslado Completado',changedBy:actor.seller.name || 'Administrador',timestamp:now,notes:'Novedad aprobada y procesada'}]});
    return {processed:true, alreadyProcessed:false};
  });
  return {...result,...(input.diagnostics === true ? {diagnostics:{version:1,totalMs:performance.now()-started,attempts,reads}} : {})};
}
