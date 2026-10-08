export const STAGING_COMPANY = 'staging_company';
export const SECOND_STORE = 'staging_store_02';

export function assertStagingConfig(config) {
  if (config.projectId !== 'vestika-staging' ||
      config.authDomain !== 'vestika-staging.firebaseapp.com' ||
      config.storageBucket !== 'vestika-staging.firebasestorage.app') {
    throw new Error('SAFETY STOP: proyecto, authDomain y storageBucket deben corresponder exclusivamente a vestika-staging');
  }
  for (const [key, value] of Object.entries(config)) {
    if (!value) throw new Error(`Falta configuración: ${key}`);
  }
}

// All reads precede writes. Existing documents are validated and never overwritten.
// No sale, first-store inventory, identity or permission document is written.
export async function seedSecondStore(db, { doc, runTransaction }) {
  return runTransaction(db, async transaction => {
    const read = async (collection, id) => {
      const snapshot = await transaction.get(doc(db, collection, id));
      return snapshot.exists() ? snapshot.data() : undefined;
    };
    const [company, firstStore, seller, category] = await Promise.all([
      read('companies', STAGING_COMPANY), read('stores', 'staging_store_01'),
      read('sellers', 'staging_admin'), read('categories', 'staging_category_01'),
    ]);
    if (!company || !firstStore || !seller || !category ||
        [firstStore, seller, category].some(row => row.companyId !== STAGING_COMPANY) ||
        seller.username !== 'stagingadmin' || seller.isDisabled || seller.storeId !== 'staging_store_01' || !seller.roleId) {
      throw new Error('SAFETY STOP: faltan datos iniciales de staging o stagingadmin no corresponde a la empresa y sede esperadas');
    }
    const role = await read('roles', seller.roleId);
    if (!role || role.companyId !== STAGING_COMPANY || role.userType !== 'admin' ||
        !['pos', 'inventory'].every(view => role.permissions?.includes(view) && (!company.allowedViews?.length || company.allowedViews.includes(view)))) {
      throw new Error('SAFETY STOP: stagingadmin necesita su rol administrador de staging con acceso a POS e Inventario; no se alteran permisos automáticamente');
    }
    const store = {
      id: SECOND_STORE, companyId: STAGING_COMPANY, name: 'Tienda Pruebas 2',
      receiptName: 'VESTIKA STAGING 2', logo: null, contactInfo: 'Ambiente de pruebas',
      footerText: 'Documento de prueba - sin valor comercial', whatsappFooterText: 'Prueba Vestika',
      addiLink: '', sistecreditoLink: '', accentColor: '#7c3aed', accentColorHover: '#6d28d9',
      secondaryColor: '#ec4899', nextInvoiceNumber: 1, initialBalances: { cash: 0, qr: 0 },
      accountNames: { cash: 'Efectivo', qr: 'QR' }, paymentCommissions: {}, paymentSurcharges: {},
    };
    const products = [
      { id: 'staging_store_02_product_01', sku: 'TEST2-001', name: 'TEST Tienda 2 Camiseta', price: 45000, cost: 20000, stock: 12 },
      { id: 'staging_store_02_product_02', sku: 'TEST2-002', name: 'TEST Tienda 2 Pantalón', price: 90000, cost: 45000, stock: 7 },
      { id: 'staging_store_02_product_03', sku: 'TEST2-003', name: 'TEST Tienda 2 Chaqueta', price: 120000, cost: 60000, stock: 3 },
    ].map(product => ({ ...product, companyId: STAGING_COMPANY, storeId: SECOND_STORE,
      categoryId: 'staging_category_01', description: 'Dato sintético exclusivo de staging tienda 2',
      imageUrl: '', supplier: 'Proveedor Prueba 2', isDisabled: false }));
    const targets = [['stores', store], ...products.map(product => ['inventory', product])];
    const existing = await Promise.all(targets.map(([collection, row]) => read(collection, row.id)));
    targets.forEach(([collection, row], index) => {
      const old = existing[index];
      if (old && (old.companyId !== STAGING_COMPANY ||
          (collection === 'stores' ? old.name !== store.name : old.storeId !== SECOND_STORE))) {
        throw new Error(`SAFETY STOP: conflicto de tenant o documento en ${collection}/${row.id}`);
      }
    });
    let created = 0;
    targets.forEach(([collection, row], index) => {
      if (!existing[index]) { transaction.set(doc(db, collection, row.id), row); created++; }
    });
    return created;
  });
}
