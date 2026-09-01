
export const DEFAULT_COMPANY_ID = 'default_company';

export interface ColorPalettePreset {
  id: string;
  name: string;
  primary: string;
  primaryHover: string;
  secondary: string;
  description: string;
  badgeBg: string;
  previewGradient: string;
}

export const COMPANY_COLOR_PRESETS: ColorPalettePreset[] = [
  {
    id: 'fuchsia-glam',
    name: 'Rosa Fucsia Glamour',
    primary: '#ff007f',
    primaryHover: '#d9006c',
    secondary: '#8b5cf6',
    description: 'Vibrante, moderno y llamativo para moda y boutiques',
    badgeBg: '#fdf2f8',
    previewGradient: 'from-pink-500 via-fuchsia-500 to-rose-600'
  },
  {
    id: 'indigo-tech',
    name: 'Azul Índigo Corporativo',
    primary: '#4f46e5',
    primaryHover: '#4338ca',
    secondary: '#06b6d4',
    description: 'Elegante, tecnológico, seguro y profesional',
    badgeBg: '#eef2ff',
    previewGradient: 'from-indigo-600 via-blue-600 to-indigo-800'
  },
  {
    id: 'emerald-pro',
    name: 'Verde Esmeralda Fresh',
    primary: '#059669',
    primaryHover: '#047857',
    secondary: '#10b981',
    description: 'Fresco, natural, financiero y de alto contraste',
    badgeBg: '#ecfdf5',
    previewGradient: 'from-emerald-500 via-teal-600 to-green-700'
  },
  {
    id: 'coral-energy',
    name: 'Naranja Coral & Ámbar',
    primary: '#ea580c',
    primaryHover: '#c2410c',
    secondary: '#f59e0b',
    description: 'Cálido, comercial, dinámico y energético',
    badgeBg: '#fff7ed',
    previewGradient: 'from-orange-500 via-amber-500 to-red-600'
  },
  {
    id: 'purple-royal',
    name: 'Púrpura Imperial & Violeta',
    primary: '#7c3aed',
    primaryHover: '#6d28d9',
    secondary: '#ec4899',
    description: 'Sofisticado, premium, creativo y exclusivo',
    badgeBg: '#f5f3ff',
    previewGradient: 'from-purple-600 via-violet-600 to-pink-600'
  },
  {
    id: 'blue-cobalt',
    name: 'Azul Cobalto & Zafiro',
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    secondary: '#38bdf8',
    description: 'Clásico, confiable y de máxima legibilidad',
    badgeBg: '#eff6ff',
    previewGradient: 'from-blue-600 via-sky-600 to-indigo-700'
  },
  {
    id: 'rose-gold',
    name: 'Rose Gold & Rubí',
    primary: '#e11d48',
    primaryHover: '#be123c',
    secondary: '#fb7185',
    description: 'Lujo sutil, joyería, cosmética y estilo premium',
    badgeBg: '#fff1f2',
    previewGradient: 'from-rose-500 via-pink-600 to-red-600'
  },
  {
    id: 'cyan-aqua',
    name: 'Turquesa Aqua & Océano',
    primary: '#0891b2',
    primaryHover: '#0e7490',
    secondary: '#14b8a6',
    description: 'Innovador, limpio, relajante y nítido',
    badgeBg: '#ecfeff',
    previewGradient: 'from-cyan-500 via-teal-500 to-blue-600'
  },
  {
    id: 'amber-gold',
    name: 'Dorado Ámbar & Oro',
    primary: '#d97706',
    primaryHover: '#b45309',
    secondary: '#f59e0b',
    description: 'Prestigio, calidez y riqueza visual',
    badgeBg: '#fffbeb',
    previewGradient: 'from-amber-500 via-yellow-500 to-orange-600'
  },
  {
    id: 'slate-minimal',
    name: 'Grafito Minimalista',
    primary: '#334155',
    primaryHover: '#1e293b',
    secondary: '#64748b',
    description: 'Sobrio, minimalista, atemporal y ultra limpio',
    badgeBg: '#f8fafc',
    previewGradient: 'from-slate-700 via-gray-800 to-zinc-900'
  }
];

export interface Company {
  id: string;
  name: string;
  nit?: string;
  phone?: string;
  email?: string;
  address?: string;
  status: 'active' | 'suspended';
  maxStores: number; // Límite de sedes contratadas
  createdAt: string;
  updatedAt?: string;
  logoUrl?: string | null;
  allowedViews?: string[]; // Módulos / vistas autorizados para la empresa
  // Brand & Color Customization
  primaryColor?: string;
  primaryColorHover?: string;
  secondaryColor?: string;
  palettePresetId?: string;
  brandingTagline?: string;
  receiptHeaderColor?: string;
  accentColorsUpdated?: boolean;
}

export enum ProductChangeType {
  SALE = 'Venta',
  RETURN = 'Devolución (Venta Editada)',
  SALE_DELETED = 'Venta Eliminada',
  PURCHASE = 'Compra',
  PURCHASE_EDIT = 'Edición de Compra',
  PURCHASE_DELETE = 'Compra Eliminada',
  TRANSFER_OUT = 'Traslado (Salida)',
  TRANSFER_IN = 'Traslado (Entrada)',
  TRANSFER_DELETED = 'Traslado Eliminado (Reversión)',
  MANUAL_EDIT = 'Ajuste Manual',
  DAMAGED = 'Baja por Daño',
  DAMAGED_RETURNED = 'Devolución de Daño (Arreglo)',
  EXCHANGE_OUT = 'Salida por Cambio',
  EXCHANGE_IN = 'Entrada por Cambio',
  CREATED = 'Producto Creado',
  LAYAWAY_RESERVED = 'Reservado (Abono)',
  LAYAWAY_DELETED = 'Abono Eliminado (Stock Devuelto)',
  PRE_ORDER_FULFILLED = 'Abono Recibido (Pre-orden)',
  INCONSISTENCY_FIX = 'Corrección de Inconsistencia',
  DELETED = 'Producto Eliminado',
  STOCK_TAKE_APPLIED = 'Conteo Físico Aplicado',
  DETAILED_VERIFICATION = 'Verificación Detallada Aplicada',
}

export interface VersionLog {
  version: string;
  date: string;
  description: string;
  changes: string[];
  isCurrent?: boolean;
}

export interface FinancialRecord {
  id: string;
  date: string; // ISO String
  storeId: string;
  accountType: 'cash' | 'qr' | 'addi' | 'sistecredito';
  amount: number; // Positivo para ingresos, negativo para egresos
  type: 'income_sales' | 'income_manual' | 'expense' | 'transfer' | 'adjustment';
  description: string;
  category?: string;
  subCategory?: string;
  registeredBy: string;
  relatedRecordId?: string; 
  isConfirmed?: boolean;
  debtStoreId?: string; // ID del local que debe este dinero o al que pertenece el movimiento
  affectsCashBalance?: boolean; // Si es false, el registro existe para deuda y stats pero no resta/suma al saldo de caja
  excludeFromAccounting?: boolean; // Si es true, el registro no se suma en los cálculos de contabilidad
}

export interface PendingDetailedVerification {
  id: string; // categoryId_storeId
  categoryId: string;
  storeId: string;
  counts: Record<string, number>; // productId -> physicalCount
  systemSnapshot?: Record<string, number>; // productId -> systemCount at time of save
  lastUpdatedBy: string;
  updatedAt: string;
}

export interface ProductHistoryLog {
  id: string;
  productId: string;
  productName: string;
  storeId: string;
  changedBy: string;
  timestamp: string;
  changeType: ProductChangeType;
  details: string;
}

export interface LabelConfig {
  width: number; // mm
  height: number; // mm
  columns: number;
  columnGap: number; // mm
  orientation: 'portrait' | 'landscape';
  fontSize: number;
  showPrice: boolean;
  showName: boolean;
  showSku: boolean;
  showSupplier: boolean;
  barcodeWidth: number;
  barcodeHeight: number;
  horizontalOffset?: number;
  centerOffset?: number;
}

export interface Store {
  id: string;
  name: string;
  companyId?: string; // ID de la empresa a la que pertenece
  receiptName?: string;
  logo: string | null;
  contactInfo: string;
  footerText: string;
  whatsappFooterText: string;
  addiLink: string;
  sistecreditoLink: string;
  autoPrint?: boolean;
  autoSendWhatsApp?: boolean;
  accentColor: string;
  accentColorHover: string;
  nextInvoiceNumber: number;
  loginBackgroundUrl?: string | null;
  imageCompressionQuality?: 'high' | 'medium' | 'low';
  accentColorsUpdated?: boolean;
  hideDetailedVerificationForSellers?: boolean;
  detailedVerificationEnabledDate?: string; // ISO date string (YYYY-MM-DD)
  initialBalances?: {
    cash: number;
    qr: number;
  };
  crossStoreInitialBalances?: {
    [otherStoreId: string]: {
      cash: number;
      qr: number;
    }
  };
  accountNames?: {
    cash: string;
    qr: string;
  };
  paymentCommissions?: { [key in PaymentMethod]?: number };
  labelConfig?: LabelConfig;
}

export interface InventoryTransfer {
  id: string;
  fromStoreId: string;
  toStoreId: string;
  productId: string;
  productName: string;
  quantity: number;
  productCost: number;
  totalCost: number;
  createdAt: string; // ISO string
  sellerName: string;
  settled?: boolean;
}

export interface Category {
  id: string;
  name: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  storeId: string;
}

export interface Role {
  id: string;
  name: string;
  permissions: View[];
}

export interface Seller {
  id: string;
  name: string;
  username?: string;
  password: string;
  roleId: string;
  storeId: string;
  companyId?: string;
  isDeveloper?: boolean;
  isDisabled?: boolean;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  cost: number;
  stock: number;
  imageUrl: string;
  categoryId: string;
  supplier?: string;
  storeId: string;
  isDisabled?: boolean;
  discountPrice?: number;
}

export interface CartItem extends Product {
  quantity: number;
  basePrice?: number;
}

export interface HeldCart {
    id: string;
    items: CartItem[];
    storeId: string;
    customerName?: string | null;
    customerPhone?: string | null;
    sellerName?: string | null;
}

export interface StockTake {
  id: string;
  seller: string;
  createdAt: string; // ISO string
  cashBase?: number | null;
  isApplied?: boolean;
  productCounts?: Record<string, number>;
  verification: {
    categoryId: string;
    categoryName: string;
    systemStock: number;
    physicalCount: number;
    difference: number;
  }[];
  storeId: string;
  notes?: {
    content: string;
    author: string;
    date: string; // ISO string
  }[];
}

export enum View {
  DASHBOARD = 'dashboard',
  POS = 'pos',
  INVENTORY = 'inventory',
  INVENTORY_TRANSFER = 'inventory_transfer',
  LAYAWAY = 'layaway',
  PURCHASES = 'purchases',
  SELLERS = 'sellers',
  STORES = 'stores',
  CUSTOMERS = 'customers',
  STOCK_TAKE_HISTORY = 'stock_take_history',
  PAYROLL = 'payroll',
  SETTINGS = 'settings',
  INCIDENTS = 'incidents',
  ROLE_MANAGER = 'role_manager',
  ACCOUNTING = 'accounting',
  FINANCIAL_RECONCILIATION = 'financial_reconciliation',
  GIFT_VOUCHERS = 'gift_vouchers',
  CEO_CENTER = 'ceo_center',
  TAG_SCANNING = 'tag_scanning',
  DEVELOPER_CENTER = 'developer_center',
}

export const VIEW_LABELS: Record<View, string> = {
    [View.DASHBOARD]: 'Panel Directivo',
    [View.POS]: 'Punto de Venta',
    [View.INVENTORY]: 'Stock de Productos',
    [View.INVENTORY_TRANSFER]: 'Traslados Internos',
    [View.LAYAWAY]: 'Apartados y Abonos',
    [View.PURCHASES]: 'Registro de Compras',
    [View.SELLERS]: 'Gestión de Equipo',
    [View.STORES]: 'Sedes y Almacenes',
    [View.CUSTOMERS]: 'Gestión de Clientes',
    [View.STOCK_TAKE_HISTORY]: 'Auditorías / Conteos',
    [View.PAYROLL]: 'Nómina y Comisiones',
    [View.SETTINGS]: 'Configuración General',
    [View.INCIDENTS]: 'Novedades y Cambios',
    [View.ROLE_MANAGER]: 'Control de Permisos',
    [View.ACCOUNTING]: 'Contabilidad Inteligente',
    [View.FINANCIAL_RECONCILIATION]: 'Libro de Caja / Conciliación',
    [View.GIFT_VOUCHERS]: 'Bonos de Regalo',
    [View.CEO_CENTER]: 'CEO Center 💎',
    [View.TAG_SCANNING]: 'Control de Etiquetas',
    [View.DEVELOPER_CENTER]: 'Developer Center ⚙️',
};

export interface CompanyModuleInfo {
  id: View;
  label: string;
  category: 'Ventas y Operación' | 'Inventario y Logística' | 'Finanzas y Contabilidad' | 'Administración y Control';
  description: string;
}

export const ALL_CLIENT_MODULES: CompanyModuleInfo[] = [
  // Ventas y Operación
  { id: View.POS, label: 'Punto de Venta (POS)', category: 'Ventas y Operación', description: 'Facturación rápida, cobros mixtos, tickets e impresión' },
  { id: View.LAYAWAY, label: 'Apartados y Abonos', category: 'Ventas y Operación', description: 'Planes separe, abonos y reservas de clientes' },
  { id: View.INCIDENTS, label: 'Novedades y Garantías', category: 'Ventas y Operación', description: 'Cambios de prendas, arreglos, garantías y devoluciones' },
  { id: View.GIFT_VOUCHERS, label: 'Bonos de Regalo', category: 'Ventas y Operación', description: 'Emisión, redención y saldo de tarjetas de regalo' },
  { id: View.CUSTOMERS, label: 'Gestión de Clientes', category: 'Ventas y Operación', description: 'Directorio de clientes e historial de compras' },

  // Inventario y Logística
  { id: View.INVENTORY, label: 'Stock de Productos', category: 'Inventario y Logística', description: 'Catálogo de referencias, precios, código de barras y kardex' },
  { id: View.PURCHASES, label: 'Registro de Compras', category: 'Inventario y Logística', description: 'Ingreso de mercancía por proveedores y costos' },
  { id: View.INVENTORY_TRANSFER, label: 'Traslados Internos', category: 'Inventario y Logística', description: 'Movimientos y despachos de stock entre sedes' },
  { id: View.STOCK_TAKE_HISTORY, label: 'Auditorías / Conteos', category: 'Inventario y Logística', description: 'Conteos físicos, auditorías y cruces de inventario' },
  { id: View.TAG_SCANNING, label: 'Control de Etiquetas', category: 'Inventario y Logística', description: 'Escanear y detectar prendas sin etiqueta' },

  // Finanzas y Contabilidad
  { id: View.ACCOUNTING, label: 'Contabilidad e Informes', category: 'Finanzas y Contabilidad', description: 'Estado de resultados PyG, ventas globales y auditoría contable' },
  { id: View.FINANCIAL_RECONCILIATION, label: 'Libro de Caja / Conciliación', category: 'Finanzas y Contabilidad', description: 'Movimientos de caja diarios, gastos, ingresos y arqueos' },
  { id: View.PAYROLL, label: 'Nómina y Comisiones', category: 'Finanzas y Contabilidad', description: 'Cálculo de liquidación de sueldos y comisiones de ventas' },

  // Administración y Control
  { id: View.DASHBOARD, label: 'Panel Directivo (Dashboard)', category: 'Administración y Control', description: 'Métricas clave, gráficos y resumen ejecutivo' },
  { id: View.SELLERS, label: 'Gestión de Equipo', category: 'Administración y Control', description: 'Vendedores, cajeros y personal de la empresa' },
  { id: View.STORES, label: 'Sedes y Almacenes', category: 'Administración y Control', description: 'Configuración visual y saldo base de sedes' },
  { id: View.ROLE_MANAGER, label: 'Control de Permisos', category: 'Administración y Control', description: 'Jerarquía de roles y accesos para empleados' },
  { id: View.SETTINGS, label: 'Configuración General', category: 'Administración y Control', description: 'Logos, datos de ticket, consecutivos y opciones' },
  { id: View.CEO_CENTER, label: 'CEO Center 💎', category: 'Administración y Control', description: 'Control analítico unificado de compras y stock' },
];

export const DEFAULT_CLIENT_ALLOWED_VIEWS: View[] = ALL_CLIENT_MODULES.map(m => m.id);

export enum PaymentMethod {
    Efectivo = 'Efectivo',
    Nequi = 'Nequi',
    Daviplata = 'Daviplata',
    QR = 'QR',
    Tarjeta = 'Tarjeta',
    Sistecredito = 'Sistecredito',
    Addi = 'Addi',
    Bono = 'Bono de Regalo',
}

export interface Payment {
  date: string; // ISO string for simplicity
  amount: number;
  method: PaymentMethod;
  seller: string;
  voucherId?: string;
  voucherCode?: string;
}

export interface Layaway {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  items: CartItem[];
  totalAmount: number;
  paidAmount: number;
  payments: Payment[];
  status: 'active' | 'completed' | 'cancelled' | 'pre-order';
  createdAt: string; // ISO string
  seller: string;
  storeId: string;
  description?: string;
}

export interface Sale {
  id: string;
  invoiceNumber: number;
  customerName: string;
  customerPhone: string;
  items: CartItem[];
  totalAmount: number;
  paymentMethod?: PaymentMethod;
  payments?: Payment[];
  seller: string;
  createdAt: string; // ISO string
  storeId: string;
  layawayId?: string;
  discountPercent?: number;
  discountAmount?: number;
}

export interface Purchase {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  cost: number;
  totalCost: number;
  supplier: string;
  createdAt: string;
  storeId: string;
}

export interface DailyNote {
  id: string;
  createdAt: string; // ISO string
  content: string;
  seller: string;
  storeId: string;
}

export interface CeoDailyNote {
  id: string;
  fecha: string; // YYYY-MM-DD
  tienda: string; // storeId
  energia?: 'green' | 'yellow' | 'red';
  pregunta_cliente?: string;
  decision?: string;
  observacion?: string;
  usuario: string;
  createdAt: string; // ISO String
}

export interface Customer {
    id: string;
    name: string;
    phone: string;
    storeId: string;
    createdAt: string; // ISO string
}

export interface LoginRecord {
  id: string;
  sellerId: string;
  sellerName: string;
  date: string; // ISO string
  storeId: string;
}

export interface PayrollRecord {
  id: string;
  sellerName: string;
  period: string;
  paymentType?: 'nomina' | 'admin' | 'utilidad';
  baseSalary: number;
  daysWorked: number;
  adjustedBase: number;
  totalUnitsSold: number;
  totalCommissionableUnits: number;
  commissionAmount: number;
  bonuses?: { reason: string; amount: number; }[];
  totalBonuses?: number;
  deductions?: { reason: string; amount: number; }[];
  totalDeductions?: number;
  totalToPay: number;
  dailyBreakdown: {
    date: string;
    unitsSold: number;
    commissionableUnits: number;
    commissionEarned: number;
  }[];
  loginAccesses?: { date: string; times: string[]; startTime?: string; endTime?: string; }[];
  paidAt: string; // ISO string
  paidBy: string; // Name of user who registered the payment
  storeId: string;
}

export enum IncidentType {
  DAMAGED = 'Prenda Dañada',
  WARRANTY = 'Garantía',
  CASH_ADJUSTMENT = 'Ajuste de Caja',
  ADDITIONAL_INCOME = 'Ingreso Adicional',
  PRODUCT_EXCHANGE = 'Cambio de Producto',
  INVENTORY_TRANSFER_REQUEST = 'Solicitud de Traslado',
  RECAUDO = 'Recaudo',
  NEGATIVE_STOCK_SALE = 'Venta con Stock Negativo',
  INVENTORY_INCONSISTENCY = 'Inconsistencia de Inventario',
}

export enum IncidentStatus {
  REGISTRADO = 'Registrado',
  PENDIENTE_APROBACION = 'Pendiente de Aprobación',
  DAÑADO_REPORTADO = 'Dañado Reportado',
  CAMBIO_SOLICITADO = 'Cambio Solicitado',
  TRASLADO_SOLICITADO = 'Traslado Solicitado',
  EN_ARREGLO_CAMBIO = 'En Arreglo/Cambio',
  DEVUELTO_Y_RESUELTO = 'Devuelto y Resuelto',
  CAMBIO_PROCESADO = 'Cambio Procesado',
  TRASLADO_COMPLETADO = 'Traslado Completado',
  WARRANTY_ACTIVE = 'Garantía Activa',
  WARRANTY_RETURNED = 'Garantía Devuelta',
}

export interface ExchangedItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  cost: number;
  sku?: string;
  categoryId?: string;
}

export interface Incident {
  id: string;
  type: IncidentType;
  status: IncidentStatus;
  description: string;
  createdAt: string; // ISO string
  resolutionDate?: string; // ISO string
  sellerName: string;
  storeId: string;
  productId?: string;
  productName?: string;
  customerName?: string;
  customerPhone?: string;
  adjustmentType?: 'income' | 'expense';
  adjustmentAmount?: number;
  paymentMethod?: PaymentMethod;
  originalSaleId?: string;
  originalSaleInvoiceNumber?: string;
  returnedItems?: ExchangedItem[];
  takenItems?: ExchangedItem[];
  originalSaleItemsSnapshot?: CartItem[];
  originalSalePaymentsSnapshot?: Payment[];
  relatedIncidentId?: string;
  fromStoreId?: string;
  toStoreId?: string;
  quantity?: number;
  deadline?: string;
  history?: {
    status: IncidentStatus;
    changedBy: string;
    timestamp: string; // ISO string
    notes?: string;
  }[];
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  type: 'fixed' | 'variable';
  category: string;
  date: string;
  storeId: string;
  registeredBy: string;
  isRecurring?: boolean;
}

export interface GiftVoucher {
  id: string;
  code: string;
  initialValue: number;
  currentValue: number;
  status: 'active' | 'redeemed' | 'cancelled';
  createdAt: string;
  expiryDate?: string;
  customerName?: string;
  customerPhone?: string;
  storeId: string;
  createdBy: string;
  saleId?: string;
  paymentMethod?: PaymentMethod | string;
}

export interface Loan {
  id: string;
  lenderName: string; // Nombre del prestamista/banco
  loanType: 'bank' | 'personal'; // 'bank' | 'personal'
  totalAmount: number; // Monto desembolsado
  currentBalance: number; // Saldo deudor actual
  monthlyPayment: number; // Valor de la cuota mensual
  isPaid?: boolean; // Si ya fue pagado en su totalidad
  notes?: string; // Observaciones del crédito
  storeId: string;
  createdAt: string; // Fecha de creación/desembolso
}
