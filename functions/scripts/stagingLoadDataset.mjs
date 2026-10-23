// Deterministic synthetic fixtures. This module has no network or credentials.
export const LOAD_PROJECT = 'vestika-staging';
export const LOAD_ID = 'load_reads_20261023';
export const LOAD_COMPANY = LOAD_ID + '_company';
export const LOAD_SIZES = [
  { name: 'Pequeña', products: 100, financial: 500, sales: 100, layaways: 20, expenses: 20 },
  { name: 'Mediana', products: 500, financial: 2000, sales: 500, layaways: 80, expenses: 50 },
  { name: 'Grande', products: 1500, financial: 4000, sales: 1500, layaways: 200, expenses: 100 },
];
const views = ['dashboard','pos','inventory','inventory_transfer','layaway','purchases','sellers','stores','customers','stock_take_history','payroll','settings','incidents','role_manager','accounting','financial_reconciliation','gift_vouchers','ceo_center','tag_scanning'];
const start = Date.parse('2025-11-01T12:00:00-05:00'), end = Date.parse('2026-10-22T18:00:00-05:00');
const dateFor = (i, count) => new Date(start + Math.floor((end - start) * i / Math.max(1, count - 1))).toISOString();
const seller = 'Asesor ficticio de carga';
const pad = n => String(n).padStart(5, '0');
export function buildStagingLoadDataset(projectId) {
  if (projectId !== LOAD_PROJECT) throw Error('This fixture is restricted to vestika-staging');
  const docs = [];
  const add = (collection, id, data) => docs.push({ path: `${collection}/${id}`, data: { ...data, id } });
  const company = { companyId: LOAD_COMPANY, name: 'PRUEBAS DE CARGA · 23 OCT', status: 'active', maxStores: 3,
    maxAdmins: 5, maxSellers: 15, createdAt: '2026-10-23T12:00:00-05:00', allowedViews: views,
    primaryColor: '#7c3aed', primaryColorHover: '#6d28d9', secondaryColor: '#ec4899', diagnosticDataset: LOAD_ID };
  add('companies', LOAD_COMPANY, company);
  const storeIds = LOAD_SIZES.map((_, i) => `${LOAD_ID}_store_${i + 1}`);
  LOAD_SIZES.forEach((size, i) => add('stores', storeIds[i], { companyId: LOAD_COMPANY, name: `PRUEBA ${i + 1} · ${size.name}`,
    logo: null, contactInfo: 'DATOS SINTÉTICOS', footerText: 'Solo pruebas', whatsappFooterText: '', addiLink: '', sistecreditoLink: '',
    autoPrint: false, autoSendWhatsApp: false, accentColor: '#7c3aed', accentColorHover: '#6d28d9', accentColorsUpdated: true,
    nextInvoiceNumber: 100000 + size.sales + size.layaways + 1, initialBalances: { cash: 0, qr: 0 }, paymentCommissions: {} }));
  const categories = Array.from({ length: 10 }, (_, i) => `${LOAD_ID}_category_${i + 1}`);
  categories.forEach((id, i) => add('categories', id, { companyId: LOAD_COMPANY, name: `Prueba categoría ${i + 1}` }));
  for (let s = 0; s < LOAD_SIZES.length; s++) {
    const size = LOAD_SIZES[s], storeId = storeIds[s], common = { companyId: LOAD_COMPANY, storeId };
    const finance = [], products = [];
    const history = (product, id, timestamp, changeType, delta, details) => add('productHistory', `${LOAD_ID}_h_${s}_${id}`, {
      ...common, productId: product.id, productName: product.name, changedBy: seller, timestamp, changeType, details, stockDelta: delta });
    const financial = (suffix, data) => finance.push({ ...common, id: `${LOAD_ID}_f_${s}_${suffix}`, registeredBy: seller, isConfirmed: true, ...data });
    for (let i = 0; i < size.products; i++) {
      const product = { ...common, id: `${LOAD_ID}_p_${s}_${pad(i)}`, sku: `PRUEBA-${pad(i)}`, name: `Prenda ficticia ${pad(i)}`,
        description: 'Producto sintético para medir cargas', price: 30000 + i % 20 * 5000, cost: 15000 + i % 20 * 2500,
        stock: 30 + i % 20, imageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23fce4ec"/%3E%3C/svg%3E',
        categoryId: categories[i % categories.length], supplier: 'Proveedor ficticio', isDisabled: false };
      products.push(product);
      history(product, `create_${i}`, '2025-10-30T12:00:00-05:00', 'Producto Creado', product.stock, `Stock inicial de prueba: ${product.stock}`);
      const quantity = 1 + i % 4;
      product.stock += quantity;
      add('purchases', `${LOAD_ID}_purchase_${s}_${pad(i)}`, { ...common, productId: product.id, productName: product.name,
        quantity, cost: product.cost, totalCost: product.cost * quantity, supplier: 'Proveedor ficticio', createdAt: '2025-10-31T12:00:00-05:00' });
      history(product, `purchase_${i}`, '2025-10-31T12:00:00-05:00', 'Compra', quantity, `Compra ficticia de ${quantity} unidades`);
    }
    const methods = ['Efectivo', 'QR', 'Addi', 'Sistecredito'], accounts = ['cash', 'qr', 'addi', 'sistecredito'];
    for (let i = 0; i < size.sales; i++) {
      const createdAt = dateFor(i, size.sales), selected = [products[i % products.length], products[(i + 13) % products.length]];
      const items = selected.map(p => { if (p.stock < 1) throw Error('Synthetic stock exhausted'); p.stock--; return { ...p, quantity: 1 }; });
      const totalAmount = items.reduce((total, p) => total + p.price, 0);
      add('sales', `${LOAD_ID}_sale_${s}_${pad(i)}`, { ...common, invoiceNumber: i + 1, customerName: `Cliente ficticio ${i + 1}`, customerPhone: '',
        items, totalAmount, paymentMethod: methods[i % 4], payments: [{ date: createdAt, amount: totalAmount, method: methods[i % 4], seller }], seller, createdAt });
      selected.forEach((p, n) => history(p, `sale_${i}_${n}`, createdAt, 'Venta', -1, `Venta ficticia ${i + 1}: 1 unidad`));
      financial(`sale_${i}`, { date: createdAt, accountType: accounts[i % 4], amount: totalAmount, type: 'income_sales', description: `Venta de prueba ${i + 1}`, subCategory: 'Carga de Ventas' });
    }
    for (let i = 0; i < size.layaways; i++) {
      const product = products[i % products.length], status = i % 4 === 0 ? 'pre-order' : 'active';
      const createdAt = '2026-08-23T12:00:00-05:00', recent = '2026-10-22T15:00:00-05:00';
      const payments = [{ date: createdAt, amount: product.price * .2, method: 'Efectivo', seller }, { date: recent, amount: product.price * .3, method: 'QR', seller }];
      add('layaways', `${LOAD_ID}_layaway_${s}_${pad(i)}`, { ...common, invoiceNumber: `PRUEBA-A-${i + 1}`, customerName: `Apartado ficticio ${i + 1}`, customerPhone: '',
        items: [{ ...product, quantity: 1 }], totalAmount: product.price, paidAmount: payments.reduce((a, p) => a + p.amount, 0), payments, status, createdAt, seller });
      if (status === 'active') { product.stock--; history(product, `layaway_${i}`, createdAt, 'Reservado (Abono)', -1, 'Reserva ficticia: 1 unidad'); }
      payments.forEach((p, n) => financial(`layaway_${i}_${n}`, { date: p.date, accountType: n ? 'qr' : 'cash', amount: p.amount, type: 'income_sales', description: `Abono de prueba ${i + 1}`, subCategory: 'Carga de Abonos' }));
    }
    for (let i = 0; i < size.expenses; i++) {
      const date = dateFor(i, size.expenses), amount = 10000 + i % 30 * 1000, category = ['Arriendo', 'Servicios', 'Publicidad'][i % 3];
      add('expenses', `${LOAD_ID}_expense_${s}_${pad(i)}`, { ...common, date, description: `Gasto ficticio ${i + 1}`, amount, type: 'variable', category, registeredBy: seller, isRecurring: false });
      financial(`expense_${i}`, { date, accountType: 'cash', amount: -amount, type: 'expense', description: `Gasto ficticio ${i + 1}`, subCategory: category });
    }
    const remaining = size.financial - 20 - finance.length;
    if (remaining < 0) throw Error('Fixture size is too small for its linked financial records');
    for (let i = 0; i < remaining; i++) {
      const amount = (10000 + i % 40 * 1000) * (i % 3 ? 1 : -1);
      financial(`manual_${i}`, { date: dateFor(i, remaining), accountType: accounts[i % 4], amount, type: amount > 0 ? 'income_manual' : 'expense',
        description: `Movimiento manual ficticio ${i + 1}`, subCategory: amount > 0 ? 'Ingreso de prueba' : 'Gasto de prueba', isConfirmed: i % 5 !== 0 });
    }
    for (const row of finance) add('financialRecords', row.id, row);
    products.forEach((p, i) => {
      if (i % 15 === 0) { history(p, `zero_${i}`, '2026-10-22T20:00:00-05:00', 'Ajuste Manual', -p.stock, 'Ajuste de prueba a stock cero'); p.stock = 0; }
      if (p.stock < 0) throw Error('Negative synthetic stock');
      add('inventory', p.id, p);
    });
  }
  // Ten paired crossings per store: every store receives ten and sends ten.
  for (let s = 0; s < storeIds.length; s++) for (let i = 0; i < 10; i++) {
    const a = `${LOAD_ID}_cross_${s}_${i}_a`, b = `${LOAD_ID}_cross_${s}_${i}_b`, next = (s + 1) % 3;
    const common = { companyId: LOAD_COMPANY, date: dateFor(i, 10), accountType: 'cash', type: 'transfer', subCategory: 'Cruce Sedes', registeredBy: seller, isConfirmed: true };
    add('financialRecords', a, { ...common, storeId: storeIds[s], debtStoreId: storeIds[next], relatedRecordId: b, amount: -20000, description: 'Cruce ficticio: salida' });
    add('financialRecords', b, { ...common, storeId: storeIds[next], debtStoreId: storeIds[s], relatedRecordId: a, amount: 20000, description: 'Cruce ficticio: entrada' });
  }
  const allowed = new Set(['companies','stores','categories','inventory','purchases','sales','layaways','expenses','productHistory','financialRecords']);
  const paths = new Set();
  for (const doc of docs) {
    const [collection, id] = doc.path.split('/');
    if (!allowed.has(collection) || !id.startsWith(LOAD_ID + '_') || doc.data.companyId !== LOAD_COMPANY || paths.has(doc.path)) throw Error('Unsafe or duplicate synthetic path');
    if (doc.data.storeId && !storeIds.includes(doc.data.storeId)) throw Error('Foreign store in fixture');
    paths.add(doc.path);
  }
  // Parent metadata and final inventory exist before history/sales can trigger.
  const priority = ['companies','stores','categories','inventory','purchases','sales','layaways','expenses','productHistory','financialRecords'];
  docs.sort((a, b) => priority.indexOf(a.path.split('/')[0]) - priority.indexOf(b.path.split('/')[0]) || a.path.localeCompare(b.path));
  const counts = Object.fromEntries(priority.map(c => [c, docs.filter(d => d.path.startsWith(c + '/')).length]));
  return { projectId, datasetId: LOAD_ID, companyId: LOAD_COMPANY, stores: LOAD_SIZES.map((size, i) => ({ ...size, id: storeIds[i] })), counts, documents: docs };
}
