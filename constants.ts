
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
    version: '2.11.27',
    date: '2026-02-27',
    description: 'Corrección en Alertas de Inventario',
    isCurrent: true,
    changes: [
      'Sincronización en Tiempo Real: Se corrigió un error que impedía que las inconsistencias de inventario se detectaran en tiempo real en el Dashboard.',
      'Lógica de Alerta Refinada: El sistema ahora verifica tanto el último conteo físico como las novedades pendientes, asegurando que la notificación sea precisa por local.',
      'Persistencia de Datos: Se optimizó la carga de reportes de inventario para que el administrador vea las alertas inmediatamente sin necesidad de recargar la página.'
    ]
  },
  {
    version: '2.11.26',
    date: '2026-02-26',
    description: 'Optimización de Auditoría y Control de Acceso',
    changes: [
      'Auto-desactivación de Lupas: La visibilidad detallada para vendedores ahora se desactiva automáticamente cada día, requiriendo activación manual diaria por el administrador.',
      'Relocalización de Alertas: La alerta de descuadre se movió junto al botón de verificación para una respuesta más rápida.',
      'Lógica de Alerta Optimizada: El indicador de descuadre ahora solo considera el último conteo realizado, evitando alertas por errores ya corregidos.',
      'Navegación Directa: La alerta de inventario ahora redirige directamente al historial de conteos físicos para facilitar la revisión.'
    ]
  },
  {
    version: '2.11.25',
    date: '2026-02-26',
    description: 'Auditoría de Novedades y Control de Inventario',
    changes: [
      'Historial de Novedades: Implementación de un sistema de auditoría que registra cada cambio de estado, responsable y fecha en las novedades.',
      'Privacidad de Auditoría: Se restringió el acceso al historial de novedades únicamente para usuarios con rol de Administrador.',
      'Control de Inconsistencias: Sistema automático que genera novedades de tipo "Inconsistencia de Inventario" al detectar descuadres en los conteos físicos.',
      'Alertas en Dashboard: Se añadió una tarjeta de alerta dinámica y un badge indicador en el botón de verificación para notificar descuadres al administrador.',
      'Feedback de Usuario: Mejora en la experiencia del vendedor con indicadores de carga y mensajes de confirmación al guardar inventarios.'
    ]
  },
  {
    version: '2.11.24',
    date: '2024-07-07',
    description: 'Herramientas de Auditoría de Inventario',
    changes: [
      'Auditoría: Se añadió una columna de "Stock Final" en el historial de productos que calcula el balance retroactivo para detectar errores.',
      'Diagnóstico: El historial ahora muestra el ID único del documento para ayudar a identificar productos duplicados con el mismo nombre.',
      'Transparencia: Se incluyeron notas de auditoría para guiar a los administradores en la resolución de discrepancias físicas vs sistema.'
    ]
  },
  {
    version: '2.11.23',
    date: '2024-07-07',
    description: 'Descuentos por Tienda',
    changes: [
      'Segmentación: Ahora los descuentos aplicados a un producto son específicos de la tienda donde se configuran.',
      'Independencia: Un mismo producto puede tener precio normal en una tienda y precio especial en otra.'
    ]
  },
  {
    version: '2.11.22',
    date: '2024-07-07',
    description: 'Persistencia de Descuentos y Precios Especiales',
    changes: [
      'Persistencia: Se corrigió un error que impedía que los precios de descuento se guardaran correctamente en la base de datos.',
      'Flexibilidad de Precios: Ahora es posible asignar precios especiales tanto mayores como menores al precio original desde el panel de rendimiento.',
      'Indicadores Visuales: Se añadieron etiquetas dinámicas (OFERTA / PRECIO ESP.) para identificar productos con precios modificados.',
      'Sincronización Total: El carrito ahora respeta siempre el precio especial definido, independientemente de si es mayor o menor.'
    ]
  },
  {
    version: '2.11.21',
    date: '2024-07-07',
    description: 'Mejoras en Sistema de Descuentos',
    changes: [
      'Categoría de Descuentos: Se añadió una nueva categoría virtual "Descuentos %" que agrupa todos los productos en oferta.',
      'Indicadores Visuales: Se mejoró la visibilidad de los descuentos en las tarjetas de productos con etiquetas de "OFERTA" animadas.',
      'Sincronización de Precios: Se optimizó la aplicación de precios de liquidación al añadir productos al carrito.'
    ]
  },
  {
    version: '2.11.20',
    date: '2024-07-07',
    description: 'Corrección Crítica Navegación Móvil',
    changes: [
      'Botón de Cierre: Se rediseñó el botón de cierre del carrito móvil con mayor contraste, tamaño y prioridad visual (z-index) para garantizar su accesibilidad.',
      'Layout Móvil: Se optimizó el contenedor del carrito para evitar que el contenido oculte los controles de navegación.'
    ]
  },
  {
    version: '2.11.19',
    date: '2024-07-07',
    description: 'Correcciones en Carrito y Descuentos',
    changes: [
      'Cierre de Carrito: Se mejoró el botón de cerrar carrito en dispositivos móviles para mayor facilidad de uso.',
      'Sincronización de Descuentos: Se corrigió un error donde el precio de liquidación no se actualizaba si el producto ya estaba en el carrito.',
      'Tipado de Datos: Se optimizó la estructura interna para manejar precios base y descuentos de forma más robusta.'
    ]
  },
  {
    version: '2.11.18',
    date: '2024-07-06',
    description: 'Mejoras en Visibilidad de Descuentos',
    changes: [
      'Visualización en Carrito: Ahora los productos con descuento muestran su precio original tachado en el carrito.',
      'Sincronización de Precios: Se aseguró que el precio de liquidación se aplique automáticamente al añadir al carrito.'
    ]
  },
  {
    version: '2.11.17',
    date: '2024-07-05',
    description: 'Gestión de Liquidación y Etiquetas',
    changes: [
      'Precios de Liquidación: Implementación de precios de descuento que no afectan el valor base del inventario.',
      'Código de Barras: Actualización de etiquetas para incluir códigos de barras legibles por lectores.'
    ]
  },
  {
    version: '2.11.16',
    date: '2024-07-05',
    description: 'Optimización de Duplicación en Lote',
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
    accountNames: { cash: 'Caja Efectivo', qr: 'Bancolombia (QR)', bank: 'Otros Bancos' }
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
    accountNames: { cash: 'Caja Efectivo', qr: 'Bancolombia (QR)', bank: 'Otros Bancos' }
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
    accountNames: { cash: 'Caja Efectivo', qr: 'Bancolombia (QR)', bank: 'Otros Bancos' }
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
