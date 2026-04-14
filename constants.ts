
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

export const normalizeText = (text: string): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

export const APP_VERSIONS: VersionLog[] = [
  {
    version: '1.1.30',
    date: '2026-04-14',
    description: 'Sincronización masiva de cierres y soporte universal de comisiones.',
    isCurrent: true,
    changes: [
      'Se añadió un botón de "Sincronizar Todo" que permite actualizar todos los cierres del mes con un solo clic si se detectan diferencias por cambios en comisiones.',
      'Se extendió el cálculo de comisiones a todos los medios de pago configurados (Tarjeta, Nequi, Daviplata, etc.).',
      'Se agruparon automáticamente los pagos digitales (Nequi, Daviplata, Tarjeta) en la categoría de QR para una conciliación unificada.',
      'El sistema ahora recalcula dinámicamente los totales de cierre al detectar cualquier cambio en los porcentajes de comisión.'
    ]
  },
  {
    version: '1.1.29',
    date: '2026-04-14',
    description: 'Soporte universal de comisiones por medio de pago.',
    isCurrent: false,
    changes: [
      'Se extendió el cálculo de comisiones a todos los medios de pago configurados (Tarjeta, Nequi, Daviplata, etc.).',
      'Se agruparon automáticamente los pagos digitales (Nequi, Daviplata, Tarjeta) en la categoría de QR para una conciliación unificada.',
      'El sistema ahora recalcula dinámicamente los totales de cierre al detectar cualquier cambio en los porcentajes de comisión.'
    ]
  },
  {
    version: '1.1.28',
    date: '2026-04-14',
    description: 'Recalculado dinámico de cierres al cambiar comisiones.',
    isCurrent: false,
    changes: [
      'Se habilitó la actualización de cierres de caja cuando hay una diferencia entre el valor del sistema y el conciliado.',
      'El sistema ahora detecta automáticamente si el cambio en las comisiones afecta los totales y permite actualizar el registro con un solo clic.',
      'Se añadió un indicador visual de "DIFERENCIA" en los botones de cierre cuando los montos no coinciden.'
    ]
  },
  {
    version: '1.1.27',
    date: '2026-04-09',
    description: 'Integración de pestaña Sistecredito y conciliación por rango.',
    isCurrent: false,
    changes: [
      'Se añadió la pestaña de Sistecredito en la sección de Cierres de Caja.',
      'Implementación de conciliación por rango de fechas para Sistecredito, agrupando ventas y calculando totales netos.',
      'Los registros de Sistecredito ahora muestran el valor bruto, el descuento aplicado y el valor neto.',
      'Se unificó la lógica de descuentos para Addi (6.5%) y Sistecredito (3%) basada en la configuración de la sede.',
      'Se añadió soporte para saldos iniciales de Sistecredito en los ajustes de la sede.'
    ]
  },
  {
    version: '1.1.26',
    date: '2026-04-09',
    description: 'Ajuste de pestañas de Addi en cierres.',
    isCurrent: false,
    changes: [
      'Se eliminó la pestaña de Addi de las cuentas principales del libro para mantener la consolidación en QR.',
      'Se añadió un selector de pestañas específico dentro de la sección de Cierres de Caja para revisar Addi de forma independiente.',
      'La conciliación de Addi sigue dirigiéndose a la cuenta QR como se solicitó.',
      'Se mantiene la visualización detallada de fecha de venta y descuentos en los registros de Addi.'
    ]
  },
  {
    version: '1.1.25',
    date: '2026-04-09',
    description: 'Separación de Addi en cierres y corrección de descuentos.',
    isCurrent: false,
    changes: [
      'Addi ahora tiene su propia pestaña independiente en la sección de Cierres de Caja para facilitar la revisión.',
      'Se corrigió la aplicación de descuentos en Addi; ahora el valor conciliado refleja el descuento correctamente.',
      'Se añadió la fecha de venta original en cada registro de Addi para mayor claridad.',
      'En el libro principal, Addi sigue consolidándose en la cuenta QR por solicitud previa, pero su revisión en cierres es independiente.'
    ]
  },
  {
    version: '1.1.24',
    date: '2026-04-09',
    description: 'Corrección técnica de error de Fetch.',
    isCurrent: false,
    changes: [
      'Se mejoró el parche de window.fetch en index.html para evitar errores de "getter-only" en navegadores específicos.',
      'El parche ahora define correctamente una propiedad escribible incluso si fetch es heredado del prototipo.'
    ]
  },
  {
    version: '1.1.23',
    date: '2026-04-09',
    description: 'Integración de Addi en cuenta QR.',
    isCurrent: false,
    changes: [
      'Addi ahora se concilia en la misma cuenta que QR por solicitud del usuario.',
      'Se eliminó la pestaña independiente de Addi para simplificar el flujo.',
      'Addi aparece como ítem separado en Cierres de Caja pero se registra en la cuenta QR.',
      'Se eliminó el retraso de 1 mes en Addi; ahora aparece en el mes exacto de la venta.',
      'Los montos de Addi ya incluyen el descuento por comisión aplicado automáticamente.'
    ]
  },
  {
    version: '1.1.22',
    date: '2026-04-08',
    description: 'Separación de conciliación de Addi.',
    isCurrent: false,
    changes: [
      'Se separó la conciliación de Addi de la de QR para un mejor control.',
      'Nueva pestaña de Addi en el libro de conciliación con su propio saldo y desglose.',
      'Saldos de Addi ahora se muestran de forma independiente en el Estado General de Sedes.',
      'Posibilidad de configurar el nombre y saldo inicial de la cuenta Addi por sede.'
    ]
  },
  {
    version: '1.1.21',
    date: '2026-04-08',
    description: 'Integración de pagos Addi en conciliación QR.',
    isCurrent: false,
    changes: [
      'Los pagos realizados con Addi ahora aparecen automáticamente en la conciliación de Bancolombia QR.',
      'Se implementó el retraso de 1 mes para los pagos de Addi (ej: venta en enero se concilia en febrero).',
      'Cálculo automático del descuento de Addi basado en la comisión configurada por sede.',
      'La descripción de la transacción ahora incluye la fecha real de la compra para facilitar su rastreo.'
    ]
  },
  {
    version: '1.1.20',
    date: '2026-03-27',
    description: 'Mejora en la visualización de conciliaciones: registros siempre expandidos y filtrado estricto de medios de pago.',
    isCurrent: false,
    changes: [
      'Se eliminó la necesidad de expandir manualmente los cierres de caja; ahora se muestran siempre abiertos.',
      'Se ajustó el filtrado de QR para que sea estricto: ahora Nequi y Daviplata no aparecen en la lista de QR si no se desea conciliarlos allí.',
      'Mejora en la interfaz para una conciliación más rápida y directa.'
    ]
  },
  {
    version: '1.1.19',
    date: '2026-03-27',
    description: 'Mejora en la sincronización de conciliaciones al editar ventas y visualización detallada de medios de pago.',
    isCurrent: false,
    changes: [
      'Se añadió el nombre del medio de pago en la descripción de las transacciones para mayor claridad.',
      'Mejora en la sincronización de conciliaciones: al editar una venta, se actualizan los registros de conciliación asociados.',
      'Se corrigió un error donde los administradores no veían las ventas de otras sedes en la vista de conciliación.'
    ]
  },
  {
    version: '1.1.18',
    date: '2026-03-27',
    description: 'Conciliación individual de pagos QR y efectivo',
    isCurrent: false,
    changes: [
      'Se añadió la capacidad de conciliar cada pago de QR y efectivo de forma independiente.',
      'Mejora en la sincronización de cierres de caja: ahora se permite actualizar el registro si el monto del sistema cambia.',
      'Estabilización de IDs de transacciones para una conciliación persistente y precisa.'
    ]
  },
  {
    version: '1.1.17',
    date: '2026-03-27',
    description: 'Estado General Global de Sedes',
    isCurrent: false,
    changes: [
      'Nuevo botón "Estado General" que despliega un resumen consolidado de todas las tiendas.',
      'Visualización detallada de saldos (Efectivo/QR) y deudas (Por Cobrar/Por Pagar) por sede.',
      'Cálculo de balance neto global de toda la red de tiendas.'
    ]
  },
  {
    version: '1.1.16',
    date: '2026-03-27',
    description: 'Carga inteligente de cierres de caja (Efectivo/QR) con opción de vista combinada.',
    isCurrent: false,
    changes: [
      'Se añadió la capacidad de cargar cierres de caja de forma selectiva según la cuenta activa (Efectivo o QR).',
      'Nueva opción "Cargar Ambos" para visualizar y conciliar ambos tipos de cierres simultáneamente.',
      'Mejora en la interfaz de cierres de caja para mayor claridad y agilidad en la conciliación.'
    ]
  },
  {
    version: '1.1.15',
    date: '2026-03-27',
    description: 'Edición de Saldo Inicial y Filtro de Sedes',
    isCurrent: false,
    changes: [
      'Se añadió la posibilidad de editar el saldo inicial de las cuentas directamente desde el modal de ajustes (piñón).',
      'Se filtró la "Training Store" del selector de sedes en la vista de conciliación.',
      'Mejora en la interfaz del modal de ajustes con secciones diferenciadas por cuenta.'
    ]
  },
  {
    version: '1.1.14',
    date: '2026-03-27',
    description: 'Movimientos Divididos (Cruce Parcial)',
    isCurrent: false,
    changes: [
      'Implementación de la capacidad de dividir un movimiento entre el local actual y un cruce a otra sede.',
      'Nueva interfaz en el modal de conciliación para especificar el monto exacto del cruce.',
      'Generación automática de registros locales y de cruce según la división especificada.'
    ]
  },
  {
    version: '1.1.13',
    date: '2026-03-27',
    description: 'Modal de Confirmación para Eliminación',
    isCurrent: false,
    changes: [
      'Se reemplazó el diálogo nativo de confirmación por un modal personalizado para eliminar registros en conciliación.',
      'Mejora en la experiencia de usuario en entornos donde los diálogos nativos están restringidos.'
    ]
  },
  {
    version: '1.1.12',
    date: '2026-03-27',
    description: 'Refinamiento de Conciliación y Cruce de Sedes',
    isCurrent: false,
    changes: [
      'Se eliminó definitivamente la opción de cuenta "Banco" de la conciliación financiera.',
      'Se mejoraron las descripciones de los cruces de sedes para ser más explícitas (ej: "Cruce Metro").',
      'Se aseguró que la "Training Store" no aparezca en ningún listado de la conciliación.'
    ]
  },
  {
    version: '1.1.11',
    date: '2026-03-26',
    description: 'Corrección en Novedades y Ediciones Manuales',
    isCurrent: false,
    changes: [
      'Se corrigió un error donde editar manualmente el estado de una prenda dañada no actualizaba el inventario correctamente.',
      'Se deshabilitó la edición manual de estados procesados (Cambios, Traslados) para evitar inconsistencias en inventario y ventas.',
      'Se mejoró la lógica de actualización de inventario al editar novedades.'
    ]
  },
  {
    version: '1.1.10',
    date: '2026-03-25',
    description: 'Mejora en Cruce de Sedes y Cuentas',
    isCurrent: false,
    changes: [
      'Se agregó la opción de elegir de qué caja física sale/entra el dinero en el cruce de sedes.',
      'Se ocultó la tienda de prueba (Training Store) de los menús de cruce de sedes.',
      'Se renombró la cuenta "Bancos / Otros" a "Bancos".'
    ]
  },
  {
    version: '1.1.9',
    date: '2026-03-23',
    description: 'Búsqueda Insensible a Tildes en Toda la Aplicación',
    isCurrent: false,
    changes: [
      'Búsqueda Global: Se extendió la búsqueda insensible a acentos a todos los módulos (Inventario, Ventas, Clientes, Vendedores).',
      'Mejora de Entrada: Se corrigió el problema que impedía la entrada de texto en los buscadores en ciertos casos.',
      'Normalización: Uso de la función normalizeText en todos los filtros de búsqueda.'
    ]
  },
  {
    version: '1.1.8',
    date: '2026-03-23',
    description: 'Búsqueda Insensible a Tildes y Mejoras de Teclado',
    changes: [
      'Búsqueda Optimizada: Ahora los buscadores ignoran las tildes y acentos (ej. "canción" encontrará "cancion").',
      'Mejora de Teclado: Se refinó la lógica de captura de teclas en el POS para evitar bloqueos en la entrada de texto.',
      'Normalización de Texto: Implementación de una función global para estandarizar las búsquedas en toda la aplicación.'
    ]
  },
  {
    version: '1.1.7',
    date: '2026-03-18',
    description: 'Corrección de Teclado y Ajuste Fino de Centro',
    changes: [
      'Corrección de Teclado: Se solucionó el problema que impedía escribir valores negativos o borrar el contenido de los campos numéricos.',
      'Ajuste Centro (mm): Nueva opción para desplazar el contenido de cada etiqueta hacia el centro de la página, optimizando el espacio y evitando recortes en los bordes.',
      'Sincronización Real: Se aseguró que el ajuste del centro se refleje tanto en la vista previa como en la impresión final.'
    ]
  },
  {
    version: '1.1.6',
    date: '2026-03-18',
    description: 'Ajuste de Centrado y Desplazamiento de Etiquetas',
    changes: [
      'Ajuste de Centro: Se añadió una opción para desplazar horizontalmente las columnas de etiquetas, permitiendo centrarlas o pegarlas según la necesidad del papel.',
      'Espaciado Negativo: Se habilitó la posibilidad de usar valores negativos en la división de columnas para eliminar cualquier espacio residual.',
      'Control de Margen: Nuevo control para ajustar el margen izquierdo de la impresión.'
    ]
  },
  {
    version: '1.1.5',
    date: '2026-03-18',
    description: 'Optimización de Espacio en Etiquetas y Lectura de Código de Barras',
    changes: [
      'Espacio Central: Se eliminaron márgenes internos y rellenos innecesarios para que las etiquetas queden más juntas en impresiones multi-columna.',
      'Código de Barras: Se optimizó el ancho del código de barras para ocupar el 100% del espacio disponible, mejorando la legibilidad.',
      'Configuración Sugerida: Se añadieron valores recomendados en el panel de configuración para maximizar la eficiencia del papel.'
    ]
  },
  {
    version: '1.1.4',
    date: '2026-03-18',
    description: 'Corrección de Error de Fetch (Getter-only)',
    changes: [
      'Error de Fetch: Se implementó un parche en index.html para evitar que polyfills externos intenten sobrescribir window.fetch cuando es de solo lectura.',
      'Estabilidad: Se mejoró la compatibilidad con el entorno de ejecución de AI Studio.'
    ]
  },
  {
    version: '1.1.3',
    date: '2026-03-18',
    description: 'Ajuste de Espaciado entre Columnas de Etiquetas',
    changes: [
      'Espacio entre Columnas: Se añadió una opción para configurar el espacio (gap) entre etiquetas en impresiones multi-columna.',
      'Eliminación de Divisiones: Al establecer el espacio en 0, las etiquetas quedan perfectamente pegadas una de la otra.',
      'Vista Previa Precisa: Se mejoró la vista previa del diseño para reflejar exactamente el espaciado configurado.'
    ]
  },
  {
    version: '1.1.2',
    date: '2026-03-18',
    description: 'Cantidades Predeterminadas en Etiquetas',
    changes: [
      'Cantidades Inteligentes: El modal de etiquetas ahora sugiere automáticamente la cantidad basada en el stock (Inventario) o la cantidad comprada (Compras).',
      'Corrección de Fallback: Se actualizaron los valores por defecto de la configuración de etiquetas.'
    ]
  },
  {
    version: '2.11.28',
    date: '2026-02-28',
    description: 'Sincronización de Fecha Local y Confirmación de Activación',
    changes: [
      'Fecha Local: Se corrigió el error de zona horaria que causaba la desactivación prematura de la verificación detallada.',
      'Confirmación de Activación: Se añadió un mensaje de confirmación al activar o desactivar las lupas para vendedores.',
      'Persistencia Reforzada: Se optimizó el guardado de la fecha de activación para asegurar visibilidad inmediata.'
    ]
  },
  {
    version: '2.11.27',
    date: '2026-02-27',
    description: 'Corrección en Alertas de Inventario',
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
    initialBalances: { cash: 0, qr: 0 },
    accountNames: { cash: 'Caja Efectivo', qr: 'Bancolombia (QR)' }
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
    initialBalances: { cash: 0, qr: 0 },
    accountNames: { cash: 'Caja Efectivo', qr: 'Bancolombia (QR)' }
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
    initialBalances: { cash: 0, qr: 0 },
    accountNames: { cash: 'Caja Efectivo', qr: 'Bancolombia (QR)' }
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
