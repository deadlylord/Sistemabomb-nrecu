
import { Product, Category, Seller, Role, View, Store, PaymentMethod, VersionLog } from './types';

export const formatCOP = (amount: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const encodePrice = (price: number): string => {
  const mapping: Record<string, string> = {
    '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E',
    '6': 'F', '7': 'G', '8': 'H', '9': 'I', '0': 'J'
  };
  return price.toString().split('').map(digit => mapping[digit] || digit).join('');
};

export const toTitleCase = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .split(/\s+/) // Separa por cualquier cantidad de espacios en blanco
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const APP_VERSIONS: VersionLog[] = [
  {
    version: '2.11.16',
    date: '2024-07-05',
    description: 'Optimización de Duplicación en Lote',
    isCurrent: true,
    changes: [
      'Inserción Adyacente: Al duplicar un registro en el lote, el nuevo aparece inmediatamente debajo del original.',
      'Acceso Móvil: Se habilitó el botón de duplicar en la vista móvil del ingreso por lote.'
    ]
  },
  {
    version: '2.11.15',
    date: '2024-07-04',
    description: 'Reportes y Filtros Avanzados en Conciliación',
    changes: [
      'Pestaña de Ingresos: Nueva vista resumida de ingresos por categoría en el panel mensual.',
      'Filtro Cruzado: Al tocar gastos o ingresos en el resumen, la tabla se filtra automáticamente.',
      'Rango de Fechas: Filtro de fecha "Desde/Hasta" integrado en el libro mayor.',
      'Fila de Totales: Visualización automática de sumatorias al final de la tabla según los filtros aplicados.'
    ]
  },
  {
    version: '2.11.14',
    date: '2024-07-03',
    description: 'Fluidez en Conciliación por Lotes',
    changes: [
      'Herencia de Fechas: Al añadir filas en lote, heredan la fecha del registro anterior para agilizar ingresos retroactivos.',
      'Duplicación de Filas: Botón para clonar registros en el lote, útil para gastos recurrentes o similares.',
      'Optimización Móvil: Teclado numérico automático en campos de montos y saldos.'
    ]
  },
  {
    version: '2.11.13',
    date: '2024-07-02',
    description: 'Mejora en Validación de Conciliación',
    changes: [
      'Alertas de Campos Vacíos: El sistema ahora notifica explícitamente si falta el monto o la descripción en un movimiento manual.',
      'Integridad de Datos: Se bloquea el procesamiento de lotes si existen filas incompletas para evitar errores contables.'
    ]
  }
];

export const COMMISSION_RATES: { [key in PaymentMethod]?: number } = {
  [PaymentMethod.Addi]: 0.065,
  [PaymentMethod.Sistecredito]: 0.03,
  [PaymentMethod.Tarjeta]: 0.0515,
};

export const INITIAL_STORES: Store[] = [
  {
    id: '1',
    name: "Divino",
    receiptName: "Boutique Divino",
    logo: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMxYTFhMWEiLz48dGV4dCB4PSI1MCIgeT0iNjgiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI2MCIgZmlsbD0iI2ZmMDA3ZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC13ZWlnaHQ9ImJvbGQiPkQ8L3RleHQ+PC9zdmc+',
    contactInfo: 'Contacto Divino: 301 111 2222\nInstagram: @divino.tienda',
    footerText: '¡Gracias por tu compra en Divino!',
    whatsappFooterText: 'Este es tu recibo de Divino. ¡Gracias por preferirnos!',
    addiLink: 'https://www.addi.com/',
    sistecreditoLink: 'https://www.sistecredito.com/',
    autoPrint: false,
    autoSendWhatsApp: false,
    accentColor: '#ff007f',
    accentColorHover: '#e60073',
    nextInvoiceNumber: 1,
    loginBackgroundUrl: null,
    imageCompressionQuality: 'medium',
    initialBalances: { cash: 0, qr: 0, bank: 0 },
    accountLabels: { cash: 'Caja Efectivo', qr: 'Bancolombia (QR)', bank: 'Otros Bancos' }
  },
  {
    id: '2',
    name: "Metro",
    receiptName: "Tienda Metro",
    logo: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMxYTFhMWEiLz48dGV4dCB4PSI1MCIgeT0iNjgiIGZvbnQtZmFtaWx5PSJBminhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI2MCIgZmlsbD0iI2ZmMDA3ZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC13ZWlnaHQ9ImJvbGQiPk08L3RleHQ+PC9zdmc+',
    contactInfo: 'Contacto Metro: 302 333 4444\nInstagram: @metro.tienda',
    footerText: '¡Gracias por tu compra en Metro!',
    whatsappFooterText: 'Este es tu recibo de Metro. ¡Vuelve pronto!',
    addiLink: 'https://www.addi.com/',
    sistecreditoLink: 'https://www.sistecredito.com/',
    autoPrint: true,
    autoSendWhatsApp: false,
    accentColor: '#9d00ff',
    accentColorHover: '#8c00e6',
    nextInvoiceNumber: 1,
    loginBackgroundUrl: null,
    imageCompressionQuality: 'medium',
    initialBalances: { cash: 0, qr: 0, bank: 0 },
    accountLabels: { cash: 'Caja Efectivo', qr: 'Bancolombia (QR)', bank: 'Otros Bancos' }
  },
  {
    id: '3',
    name: "Centro Comercial",
    receiptName: "Bombon Centro Comercial",
    logo: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMxYTFhMWEiLz48dGV4dCB4PSI1MCIgeT0iNjgiIGZvbnQtZmFtaWx5PSJBminhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI1MCIgZmlsbD0iI2ZmMDA3ZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC13ZWlnaHQ9ImJvbGQiPkNDPC90ZXh0Pjwvc3ZnPg==',
    contactInfo: 'Contacto C.C.: 303 555 6666\nInstagram: @bombon.cc',
    footerText: '¡Gracias por tu compra en Bombon C.C.!',
    whatsappFooterText: 'Este es tu recibo de Bombon C.C. ¡No olvides seguirnos!',
    addiLink: 'https://www.addi.com/',
    sistecreditoLink: 'https://www.sistecredito.com/',
    autoPrint: false,
    autoSendWhatsApp: true,
    accentColor: '#00aaff',
    accentColorHover: '#0095e6',
    nextInvoiceNumber: 1,
    loginBackgroundUrl: null,
    imageCompressionQuality: 'medium',
    initialBalances: { cash: 0, qr: 0, bank: 0 },
    accountLabels: { cash: 'Caja Efectivo', qr: 'Bancolombia (QR)', bank: 'Otros Bancos' }
  },
];

export const INITIAL_CATEGORIES: Category[] = [
  { id: '1', name: "Blusas y Bodys" },
  { id: '2', name: "Pantalones y Jeans" },
  { id: '3', name: "Accesorios" }
];

export const INITIAL_ROLES: Role[] = [
  { id: '1', name: 'Administrator', permissions: Object.values(View) },
  { id: '2', name: 'Vendedor', permissions: [View.POS, View.LAYAWAY, View.INCIDENTS, View.CUSTOMERS, View.INVENTORY, View.PURCHASES] }
];

export const INITIAL_SELLERS: Seller[] = [
  { id: '1', name: 'admin', password: 'admin', roleId: '1', storeId: '1', isDisabled: false }
];

export const INITIAL_PRODUCTS: Product[] = [];
