
export enum ProductChangeType {
  SALE = 'Venta',
  RETURN = 'Devolución (Venta Editada)',
  SALE_DELETED = 'Venta Eliminada',
  PURCHASE = 'Compra',
  PURCHASE_EDIT = 'Edición de Compra',
  PURCHASE_DELETE = 'Compra Eliminada',
  TRANSFER_OUT = 'Traslado (Salida)',
  TRANSFER_IN = 'Traslado (Entrada)',
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
  accountType: 'cash' | 'qr' | 'bank';
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

export interface Store {
  id: string;
  name: string;
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
  initialBalances?: {
    cash: number;
    qr: number;
    bank: number;
  };
  accountNames?: {
    cash: string;
    qr: string;
    bank: string;
  };
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
  password: string;
  roleId: string;
  storeId: string;
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
  cashBase?: number;
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
}

export enum PaymentMethod {
    Efectivo = 'Efectivo',
    Nequi = 'Nequi',
    Daviplata = 'Daviplata',
    QR = 'QR',
    Tarjeta = 'Tarjeta',
    Sistecredito = 'Sistecredito',
    Addi = 'Addi',
}

export interface Payment {
  date: string; // ISO string for simplicity
  amount: number;
  method: PaymentMethod;
  seller: string;
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
