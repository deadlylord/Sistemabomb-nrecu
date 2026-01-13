
import { Product, Category, Seller, Role, View, Store, PaymentMethod, VersionLog } from './types';

export const formatCOP = (amount: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
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
    version: '2.7.0',
    date: '2024-05-30',
    description: 'Estabilidad y Sincronización Multimedia',
    isCurrent: true,
    changes: [
      'Corrección Crítica: Se resolvió el error de carga infinita que impedía entrar a la base de datos al iniciar sesión.',
      'Sincronización de Imágenes: Las fotos editadas o subidas desde cualquier tienda ahora se actualizan automáticamente en todas las sedes.',
      'Normalización de Datos: El sistema ahora es más inteligente al detectar productos existentes, ignorando espacios dobles y variaciones de mayúsculas.',
      'Mejora en Atributos Globales: Al cambiar la descripción o categoría de un producto, el cambio se aplica globalmente en toda la cadena.'
    ]
  },
  {
    version: '2.6.0',
    date: '2024-05-29',
    description: 'Sincronización Inteligente y Experiencia Visual',
    changes: [
      'Ampliación de imágenes (Zoom): Ahora puedes ver las fotos de los productos en detalle directamente desde el buscador de ventas y compras.',
      'Sincronización rápida en compras: Nuevos botones para copiar unidades, costos y precios a todas las sedes activas con un solo clic.',
      'Normalización automática de nombres: El sistema ahora detecta productos existentes sin importar si escribes en mayúsculas o minúsculas, evitando duplicados.',
      'Mejora en la consistencia de datos global para productos compartidos entre tiendas.'
    ]
  },
  {
    version: '2.5.0',
    date: '2024-05-28',
    description: 'Optimización de Compras y Gestión Visual',
    changes: [
      'Nuevo modo de "Compra por Lotes": Agrega múltiples productos de un mismo proveedor antes de procesar.',
      'Buscador de productos en Compras ahora incluye miniaturas visuales.',
      'Lightbox de expansión para fotos de productos en todas las listas.',
      'Acceso directo a edición de fotos desde el historial de compras.',
      'Optimización de carga de imágenes para ahorro de datos móviles.'
    ]
  },
  {
    version: '2.4.0',
    date: '2024-05-24',
    description: 'Sistema de Versiones e Interfaz Optimizada',
    changes: [
      'Implementación de sistema de historial de versiones (Changelog).',
      'Optimización del buscador en Compras: Normalización de espacios y priorización de tienda actual.',
      'Mejora en Novedades: Buscador predictivo para traslados de inventario.',
      'Corrección de error de sintaxis en resolución de incidencias.',
      'Mejora visual en badges de estado y notificaciones.'
    ]
  },
  {
    version: '2.3.0',
    date: '2024-05-20',
    description: 'Gestión Avanzada de Novedades',
    changes: [
      'Nuevo flujo de aprobación de prendas dañadas.',
      'Sincronización de stock en cambios de facturas.',
      'Notificaciones persistentes de tareas pendientes.'
    ]
  },
  {
    version: '2.2.0',
    date: '2024-05-15',
    description: 'Integración Multi-tienda',
    changes: [
      'Compras globales: Registro de productos en múltiples sedes simultáneamente.',
      'Módulo de traslados entre tiendas con historial de saldos.',
      'Buscador global de inventario para administradores.'
    ]
  },
  {
    version: '2.1.0',
    date: '2024-05-01',
    description: 'Estadísticas e IA',
    changes: [
      'Dashboard con gráficos de rendimiento mensual.',
      'Street AI: Generación de descripciones y análisis de rentabilidad.',
      'Contador inteligente para gestión de gastos y nómina.'
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
  },
];

export const INITIAL_CATEGORIES: Category[] = [
  { id: '1', name: "Blusas y Bodys" },
  { id: '2', name: "Busos y Chaquetas" },
  { id: '3', name: "Jeans" },
  { id: '4', name: "Pantalones" },
  { id: '5', name: "Vestidos short" },
];

export const INITIAL_ROLES: Role[] = [
  {
    id: '1',
    name: "Administrator",
    permissions: [
      View.DASHBOARD,
      View.POS, 
      View.INVENTORY, 
      View.INVENTORY_TRANSFER, 
      View.LAYAWAY, 
      View.PURCHASES, 
      View.SELLERS, 
      View.STORES, 
      View.CUSTOMERS, 
      View.STOCK_TAKE_HISTORY, 
      View.PAYROLL,
      View.SETTINGS, 
      View.INCIDENTS,
      View.ROLE_MANAGER,
      View.ACCOUNTING
    ],
  },
  {
    id: '2',
    name: "Vendedor",
    permissions: [
      View.POS,
      View.LAYAWAY,
      View.CUSTOMERS,
      View.DASHBOARD,
      View.STOCK_TAKE_HISTORY,
      View.INCIDENTS,
    ],
  },
];

export const INITIAL_SELLERS: Seller[] = [
  { id: '1', name: "Paula", password: "123", roleId: '1', storeId: '1' },
  { id: '2', name: "Lucía", password: "123", roleId: '2', storeId: '2' },
  { id: '3', name: "Carlos", password: "123", roleId: '2', storeId: '3' },
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: '1',
    sku: "BLU-PRI-01",
    name: "Blusa 'Primavera'",
    description: "Una blusa floral fresca y ligera, perfecta para cualquier ocasión.",
    price: 85990,
    cost: 55000,
    stock: 25,
    imageUrl: "",
    categoryId: '1',
    supplier: "ModaCo",
    storeId: '1', // Divino
  },
  {
    id: '2',
    sku: "CHA-REB-02",
    name: "Chaqueta de Jean 'Rebelde'",
    description: "Chaqueta de jean clásica con un toque moderno y desgastado.",
    price: 119990,
    cost: 90000,
    stock: 15,
    imageUrl: "",
    categoryId: '2',
    supplier: "Textiles SAS",
    storeId: '1', // Divino
  },
  {
    id: '3',
    sku: "JEA-SKI-03",
    name: "Jeans 'Skinny Fit'",
    description: "Jeans ajustados de tiro alto que realzan la figura.",
    price: 110000,
    cost: 75000,
    stock: 40,
    imageUrl: "",
    categoryId: '3',
    supplier: "DenimPro",
    storeId: '2', // Metro
  },
  {
    id: '4',
    sku: "PAN-EJE-04",
    name: "Pantalón 'Ejecutivo'",
    description: "Pantalón de tela formal, ideal para la oficina o eventos.",
    price: 98500,
    cost: 70000,
    stock: 20,
    imageUrl: "",
    categoryId: '4',
    supplier: "ModaCo",
    storeId: '2', // Metro
  },
  {
    id: '5',
    sku: "VES-VER-05",
    name: "Vestido Corto 'Verano'",
    description: "Vestido corto y fresco con estampado veraniego.",
    price: 95000,
    cost: 60000,
    stock: 30,
    imageUrl: "",
    categoryId: '5',
    supplier: "Estilos Frescos",
    storeId: '1', // Divino
  },
  {
    id: '6',
    sku: "BOD-SEN-06",
    name: "Body de Encaje 'Sensual'",
    description: "Body de encaje negro, elegante y atrevido.",
    price: 75500,
    cost: 45000,
    stock: 22,
    imageUrl: "",
    categoryId: '1',
    supplier: "ModaCo",
    storeId: '2', // Metro
  },
  {
    id: '7',
    sku: "BUS-CON-07",
    name: "Buso Tejido 'Confort'",
    description: "Buso de tejido suave, perfecto para un día frío.",
    price: 105000,
    cost: 80000,
    stock: 18,
    imageUrl: "",
    categoryId: '2',
    supplier: "Textiles SAS",
    storeId: '3', // Centro Comercial
  },
  {
    id: '8',
    sku: "JEA-MOM-08",
    name: "Jean 'Mom Fit'",
    description: "Jean estilo 'mom fit' de corte retro y cómodo.",
    price: 115000,
    cost: 78000,
    stock: 35,
    imageUrl: "",
    categoryId: '3',
    supplier: "DenimPro",
    storeId: '3', // Centro Comercial
  }
];
