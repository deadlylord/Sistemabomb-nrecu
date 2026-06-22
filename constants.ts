
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

export const generateUniqueSku = (name: string, existingSkus: Set<string>): string => {
  // Tomamos las primeras 3 letras, eliminamos caracteres especiales y normalizamos
  const prefix = normalizeText(name.substring(0, 3)).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
  let sku = '';
  let attempts = 0;
  
  // Si el nombre es muy corto, usamos un prefijo genérico
  const finalPrefix = prefix.length >= 2 ? prefix : 'PRO';

  do {
    // Generamos 4 dígitos aleatorios
    const random = Math.floor(1000 + Math.random() * 9000);
    sku = `${finalPrefix}${random}`;
    attempts++;
  } while (existingSkus.has(sku) && attempts < 100);

  return sku;
};

export const APP_VERSIONS: VersionLog[] = [
  {
    version: '1.1.72',
    date: '2026-06-22',
    description: 'Visualización y Edición de Método de Pago en Novedades de Recaudo y Ajuste',
    isCurrent: true,
    changes: [
      'Visualización de Método de Pago: Ahora el método de pago se muestra en tiempo real directamente en la lista de novedades (para Ajustes de Efectivo, Recaudos y Cambios con Excedente).',
      'Edición del Método de Pago: Se habilitó el campo de selección del Método de Pago dentro de la edición de novedades de Recaudo y Ajustes de Caja para que el Administrador pueda corregir errores de pago sin problemas.'
    ]
  },
  {
    version: '1.1.71',
    date: '2026-06-22',
    description: 'Edición de Métodos de Pago y Edición de Excedente Manual en Cambios',
    isCurrent: false,
    changes: [
      'Edición de Novedades de Cambio: Se habilitó la edición del método de pago de un excedente de cambio (ej. de Nequi a QR), visible y editable exclusivamente para el Administrador.',
      'Control de Excedente Manual: Se corrigió una fuga lógica que sobreescribía automáticamente el excedente de cambio registrado en la base de datos con el valor calculado, permitiendo ahora re-editar y guardar cualquier monto manual de excedente sin perderlo.'
    ]
  },
  {
    version: '1.1.70',
    date: '2026-06-18',
    description: 'Solución a Fuga de Foco en Formularios y Modales',
    isCurrent: false,
    changes: [
      'POS View: Se corrigió el comportamiento del escuchador de teclado (keydown listener) que capturaba pulsaciones durante la escritura en otros elementos de entrada (inputs, textareas, dropdowns, y modales) y desviaba el cursor al buscador de productos.',
      'Control de Foco: Implementada una condicional de control para ignorar la acumulación de datos de escáner en el búfer si el foco actual reside en un formulario de edición de ventas, clientes, o novedades.'
    ]
  },
  {
    version: '1.1.69',
    date: '2026-06-18',
    description: 'Solución a Cierre Involuntario de Modales de Venta / Apartados',
    isCurrent: false,
    changes: [
      'POS View: Se corrigió un re-montaje involuntario de componentes React en el panel lateral de venta. Ahora las vistas de carrito y modales persistirán en memoria de forma segura sin cerrarse solos al interactuar con campos o inputs de clientes y vendedores.',
      'Optimización de Render: Se eliminó el patrón de declaración de componentes hijos anidados en fase de renders de React, normalizando llamadas directas que conservan el estado original e incrementan el rendimiento global.'
    ]
  },
  {
    version: '1.1.68',
    date: '2026-06-17',
    description: 'Corrección en Historial de Producto para Encargos (Pre-Orders) Recibidos',
    isCurrent: false,
    changes: [
      'Historial de Inventario: Se corrigió la lógica inversa de cálculo en la columna "Stock Final" del historial del producto para eventos de tipo "Abono Recibido (Pre-orden)". Ahora se suma correctamente el stock de forma retroactiva al auditar el flujo de existencias.',
      'Detalles de Log: Se estandarizó el formato de registro de eventos para pre-órdenes recibidas asegurando una extracción precisa de la cantidad de productos devueltos/ingresados en las auditorías de inventario.'
    ]
  },
  {
    version: '1.1.67',
    date: '2026-06-10',
    description: 'Compatibilidad de Instalación PWA Absoluta en Android',
    isCurrent: false,
    changes: [
      'PWA Cache: Se corrigieron las rutas de los iconos PWA (/assets/icon.svg) moviendo los SVG estáticos a la carpeta pública de distribución (/public/assets/), lo cual elimina los errores 404 del Service Worker al cachear.',
      'Instalabilidad: Solucionado el problema que causaba que Android Chrome solo mostrara "Crear acceso directo" debido a fallos de inicialización del Service Worker en la instalación del caché.'
    ]
  },
  {
    version: '1.1.66',
    date: '2026-06-10',
    description: 'Valor del Inventario en Panel de Control y Guía de Instalación Celular',
    isCurrent: false,
    changes: [
      'Panel de Control: Se corrigió e integró el valor total del inventario en pesos COP dentro de las métricas del Informe de Pagos en tiempo real.',
      'Navegación: Al hacer clic en el valor del inventario en el Panel de Control, te redirige automáticamente a la sección del gráfico de valorización de stock.',
      'Gráfico de Valorización: Ahora cuenta con un selector dinámico para elegir el rango de tiempo visualizado (últimos 30, 60, 90, 180, 365 días o todo el historial).',
      'Guía de Instalación Móvil: Se incorporó una guía interactiva detallada para solucionar cuando los navegadores integrados (como WhatsApp/Instagram) sólo permiten crear accesos directos, explicando cómo instalar como App nativa en Chrome (Android) y Safari (iPhone).'
    ]
  },
  {
    version: '1.1.65',
    date: '2026-06-09',
    description: 'Actualización de WhatsApp y Compatibilidad PWA',
    isCurrent: false,
    changes: [
      'Compartido en POS: Botón inalámbrico siempre visible en cada producto para enviar detalles (tallas, colores/detalles) por WhatsApp sin incluir precios.',
      'Sincronización PWA: Configuración de servicios de instalación en dispositivos Android y computadores para solucionar problemas de caché.',
      'Responsividad: Se mejoró la visualización de ventanas emergentes (pop-ups) de facturas y de conciliaciones bancarias para que no se oculten ni se corten.'
    ]
  },
  {
    version: '1.1.64',
    date: '2026-05-22',
    description: 'Menú Sidebar Profesional y Escritorios Fluidos',
    isCurrent: false,
    changes: [
      'Menú PC: Se reemplazó la barra de navegación superior horizontal por un elegante menú lateral de escritorio (Sidebar) con agrupaciones claras.',
      'Estructura: Los accesos están ordenados visualmente en bloques temáticos (Operaciones, Control de Stock, Administración/Finanzas).',
      'Fluidificación: Se removió la restricción del contenedor centrado en PC para expandir la interfaz aprovechando el ancho total disponible en monitores grandes.',
      'Claridad: Se agregaron títulos de sección y breves descripciones explicativas bajo de cada módulo en el menú.'
    ]
  },
  {
    version: '1.1.63',
    date: '2026-05-22',
    description: 'Optimización de escaneo de productos en POS',
    isCurrent: false,
    changes: [
      'Escáner: Los productos escaneados por código de barras (SKU) ahora se agregan al carrito de compras de manera instantánea y automática.',
      'Buscador: Tras agregar un producto, se borra automáticamente el buscador y se devuelve el foco/cursor para estar listos para la siguiente lectura.',
      'Experiencia: Se introdujo detección de SKU en tiempo real para acelerar el flujo continuo de facturación en caja.'
    ]
  },
  {
    version: '1.1.62',
    date: '2026-05-17',
    description: 'Ajuste fino en impresión de etiquetas',
    isCurrent: false,
    changes: [
      'Etiquetas: Se omite la última palabra del nombre del producto al imprimir para evitar incluir la marca de forma redundante.',
      'Diseño: Mantenimiento de la estructura multi-línea para el resto del nombre.'
    ]
  },
  {
    version: '1.1.61',
    date: '2026-05-17',
    description: 'Mejoras en impresión de etiquetas',
    isCurrent: false,
    changes: [
      'Reportes: Los filtros de Análisis de Precios ahora permiten selección múltiple para comparaciones complejas.',
      'Obsequios: Se excluyen los productos con precio $0 de las unidades vendidas en Dashboard y Nómina.',
      'Control: Los obsequios ahora se muestran por separado en las métricas para no afectar los KPIs de ventas.',
      'Interfaz: Se añadió un indicador visual de "Obsequio" en el POS y Carrito para evitar confusiones.'
    ]
  },
  {
    version: '1.1.59',
    date: '2026-05-17',
    description: 'Claridad en metas y desglose quincenal de proyecciones',
    isCurrent: false,
    changes: [
      'Street AI: Se reemplazó el término técnico "Gap" por "Faltante para Meta" para mejor comprensión.',
      'Metas Quincenales: Cada nivel de proyección (Base, Ambiciosa, Élite) ahora muestra el objetivo de unidades sugerido por quincena.',
      'Interfaz: Mejora visual en las tarjetas de incentivos para destacar los objetivos de unidades.'
    ]
  },
  {
    version: '1.1.58',
    date: '2026-05-17',
    description: 'Metas ambiciosas e incentivos por IA',
    isCurrent: false,
    changes: [
      'Street AI: Se añadieron 3 niveles de proyección (Base, Ambiciosa, Élite).',
      'Incentivos: Cada nivel de proyección incluye una recomendación de incentivo para vendedores.',
      'Unidades: Las proyecciones ahora calculan tanto ingresos monetarios como volumen de unidades.',
      'Visualización: Nueva interfaz escalonada para seguimiento de metas y gaps de cierre.'
    ]
  },
  {
    version: '1.1.57',
    date: '2026-05-17',
    description: 'Análisis dinámico de pagos y proyecciones IA avanzadas',
    isCurrent: false,
    changes: [
      'Novedades: Restricción confirmada para vendedores (solo mes actual y sin edición).',
      'Abonos: Los vendedores ahora pueden visualizar abonos en estado "ACTIVO" y "POR TRAER".',
      'Seguridad: Se mantienen las facultades administrativas completas en todos los módulos.'
    ]
  },
  {
    version: '1.1.55',
    date: '2026-05-17',
    description: 'Restricciones de seguridad y privacidad para vendedores',
    isCurrent: false,
    changes: [
      'Novedades: Los vendedores ya no pueden editar novedades existentes.',
      'Privacidad Novedades: Se restringió la vista de novedades para vendedores únicamente al mes actual.',
      'Filtro de Abonos: Los vendedores ahora solo pueden visualizar abonos con estado "ACTIVO".',
      'Seguridad: Los administradores conservan acceso total a todas las funciones y registros históricos.'
    ]
  },
  {
    version: '1.1.54',
    date: '2026-05-09',
    description: 'Mejoras de Visibilidad y Desplazamiento en Escritorio',
    isCurrent: false,
    changes: [
      'Scroll de Navegación: Se habilitó el desplazamiento horizontal en la barra de pestañas para asegurar que todos los módulos sean accesibles en cualquier resolución.',
      'Alineación de Pestañas: Se ajustó la alineación a la izquierda para evitar que el contenido se oculte al desbordar el contenedor.',
      'Visibilidad de Scroll: Se restauró la barra de desplazamiento en escritorio para facilitar la navegación entre grupos de módulos.'
    ]
  },
  {
    version: '1.1.53',
    date: '2026-05-09',
    description: 'Mejoras de Visibilidad en Escritorio y Navegación',
    isCurrent: false,
    changes: [
      'Visibilidad en Escritorio: Se compactaron las pestañas de navegación y se agruparon por categorías para asegurar que todos los módulos sean visibles en pantallas de laptop.',
      'Ajuste de Desbordamiento: La barra de navegación ahora se alinea correctamente si el contenido supera el ancho de la pantalla.',
      'Navegación Móvil: Se implementó un nuevo menú de tres botones con submenús desplegables para mayor comodidad.',
      'Consolidación de Sedes: Se eliminó el selector de sede redundante en la vista de conciliación para evitar confusiones.',
      'Atajos Rápidos: Se añadieron botones de acceso directo entre las vistas de Conciliación y Contabilidad Inteligente.'
    ]
  },
  {
    version: '1.1.52',
    date: '2026-05-09',
    description: 'Mejoras de Navegación y Consolidación de Vistas',
    isCurrent: false,
    changes: [
      'Navegación Móvil: Se implementó un nuevo menú de tres botones con submenús desplegables para mayor comodidad.',
      'Consolidación de Sedes: Se eliminó el selector de sede redundante en la vista de conciliación para evitar confusiones, centralizando el control en la barra principal.',
      'Atajos Rápidos: Se añadieron botones de acceso directo entre las vistas de Conciliación y Contabilidad Inteligente.',
      'Interfaz de Dashboard: Las pestañas de informes en móvil ahora son más compactas (cuadros de a dos) para una lectura rápida.',
      'Gestión de Gastos: Nueva opción para "Descartar" categorías de gastos directamente desde Contabilidad sin afectar los registros base.'
    ]
  },
  {
    version: '1.1.51',
    date: '2026-05-09',
    description: 'Optimización de reportes de rentabilidad y COGS.',
    isCurrent: false,
    changes: [
      'Se reemplazó "Inversión Stock" por "Utilidad Neta" en el tablero principal para mayor relevancia financiera.',
      'Cálculo de Utilidad Neta: Utilidad Bruta menos Gastos Operativos.',
      'Filtro inteligente de gastos: Se descartan automáticamente categorías de costo directo (Mercancía, Inventario) de los Gastos Operativos para evitar duplicidad con el COGS.',
      'Priorización visual del COGS (Costo de Ventas) en los informes.',
      'Mejoras en el diseño de tarjetas de métricas para dispositivos móviles.'
    ]
  },
  {
    version: '1.1.49',
    date: '2026-05-09',
    description: 'Mejoras en conciliación financiera y navegación.',
    isCurrent: false,
    changes: [
      'Selector de periodo mejorado con navegación rápida por meses y años.',
      'Categorización insensible a mayúsculas/minúsculas para sumatorias precisas.',
      'Desglose detallado por cuenta en el resumen de ingresos y gastos con vista expandible.',
      'Corrección en la visualización de la versión del sistema.',
      'Sincronización de menús móviles optimizados.'
    ]
  },
  {
    version: '1.1.48',
    date: '2026-05-08',
    description: 'Refactorización de SKUs y mejoras UX en búsqueda.',
    isCurrent: false,
    changes: [
      'Se implementó un nuevo generador de SKUs más cortos, coherentes y garantizados como únicos (Formato: PREF1234).',
      'Nueva funcionalidad para Administradores: "Regenerar SKUs" masivamente para corregir códigos largos o inconsistentes en el inventario.',
      'Se habilitó la edición manual de SKUs desde el modal de edición de producto para correcciones puntuales.',
      'Mejora UX: El buscador (POS e Inventario) mantiene el foco automáticamente al limpiar el texto con la "X".',
      'Optimización de escaneo: La búsqueda por SKU en el POS ahora ignora los filtros de categoría si se encuentra una coincidencia exacta de SKU.'
    ]
  },
  {
    version: '1.1.47',
    date: '2026-05-06',
    description: 'Mejoras integrales en búsqueda por SKU y escaneo.',
    isCurrent: false,
    changes: [
      'Se activó la búsqueda por SKU en el módulo de Inventario, permitiendo encontrar productos escaneando sus etiquetas.',
      'Se flexibilizó la búsqueda por SKU en el POS para corregir fallos con lectores de códigos de barras (normalización y trimming).',
      'Optimización de la respuesta del sistema al presionar Enter después de un escaneo.',
      'Sincronización de versiones (1.1.47).'
    ]
  },
  {
    version: '1.1.46',
    date: '2026-05-06',
    description: 'Estabilización dimensional de impresión de etiquetas.',
    isCurrent: false,
    changes: [
      'Se implementó una restricción de altura rígida por etiqueta para evitar desplazamientos verticales.',
      'Sincronización de cuadrícula mediante medidas absolutas (mm) en lugar de fracciones proporcionales.',
      'Corrección de desbordamiento en configuraciones multi-columna.',
      'Versión de producción sincronizada (1.1.46).'
    ]
  },
  {
    version: '1.1.45',
    date: '2026-05-06',
    description: 'Optimización de legibilidad de códigos de barras.',
    isCurrent: false,
    changes: [
      'Se ajustó el renderizado de códigos de barras para evitar que las barras se vean demasiado juntas.',
      'Mejora en el escalado automático de las barras según el ancho configurado.',
      'Sincronización de versiones en todos los módulos (1.1.45).'
    ]
  },
  {
    version: '1.1.44',
    date: '2026-05-06',
    description: 'Unificación global de configuración de etiquetas.',
    isCurrent: false,
    changes: [
      'Se implementó la sincronización automática de la configuración de etiquetas entre todos los locales.',
      'Ahora, cualquier cambio en las dimensiones o formato de etiquetas se aplica instantáneamente a todas las tiendas del sistema.',
      'Sincronización de versiones en todos los módulos (1.1.44).'
    ]
  },
  {
    version: '1.1.43',
    date: '2026-05-06',
    description: 'Ajuste de precisión en la alineación de etiquetas.',
    isCurrent: false,
    changes: [
      'Se corrigió el desbordamiento de contenido entre etiquetas al imprimir múltiples unidades.',
      'Ajuste de rigidez en las dimensiones CSS (mm) para evitar saltos de página inesperados.',
      'Optimización de la cuadrícula de impresión para configuraciones de múltiples columnas.'
    ]
  },
  {
    version: '1.1.42',
    date: '2026-05-06',
    description: 'Mejoras críticas en impresión y persistencia.',
    isCurrent: false,
    changes: [
      'Se eliminaron definitivamente las cabeceras (Date/URL/about:blank) en la impresión de etiquetas mediante un parche de título invisible en el iframe.',
      'Se mejoró el parche de window.fetch en index.html para evitar errores de "getter-only" en navegadores específicos.',
      'Se añadió manejo de errores detallado en el guardado de ajustes de tienda para garantizar la persistencia de la configuración de etiquetas.',
      'Sincronización de versiones en todos los módulos del sistema (1.1.42).'
    ]
  },
  {
    version: '1.1.41',
    date: '2026-05-06',
    description: 'Solución a problemas de impresión y persistencia.',
    isCurrent: false,
    changes: [
      'Se eliminaron los encabezados/pies de página del navegador (fecha, about:blank) al imprimir etiquetas.',
      'Se corrigió la persistencia de la configuración de etiquetas en los ajustes.',
      'Optimización de la carga de estilos de impresión para mayor fidelidad.'
    ]
  },
  {
    version: '1.1.40',
    date: '2026-05-06',
    description: 'Mejora en la visibilidad de acceso a impresión por categorías.',
    isCurrent: false,
    changes: [
      'Se hizo permanente el botón de impresión en el resumen de categorías.',
      'Añadida leyenda informativa sobre el uso del icono de etiquetas por categoría.'
    ]
  },
  {
    version: '1.1.39',
    date: '2026-05-06',
    description: 'Impresión de etiquetas por categorías.',
    isCurrent: false,
    changes: [
      'Se añadió la funcionalidad de imprimir etiquetas masivamente por categorías en el inventario.',
      'Nueva vista previa en el modal de etiquetas con resumen de cantidades y productos únicos.',
      'Controles rápidos para establecer cantidades masivas (Todos 1 o según Stock).'
    ]
  },
  {
    version: '1.1.38',
    date: '2026-04-28',
    description: 'Visualización de hora en intercambios entre sedes.',
    isCurrent: false,
    changes: [
      'Se añadió la visualización de la hora en el historial de intercambios entre sedes.',
      'Permite verificar con precisión la secuencia cronológica de los cruces de cuentas.',
      'Facilita la auditoría de saldos sincronizados.'
    ]
  },
  {
    version: '1.1.37',
    date: '2026-04-28',
    description: 'Sincronización horaria en intercambios entre sedes.',
    isCurrent: false,
    changes: [
      'Mejora del algoritmo de ordenamiento para intercambios entre sedes, incluyendo hora e ID como criterios de desempate.',
      'Asegura que el saldo acumulado (running balance) sea idéntico en ambos locales involucrados en un cruce.',
      'Eliminación de discrepancias visuales en el historial de deudas inter-sedes.'
    ]
  },
  {
    version: '1.1.36',
    date: '2026-04-28',
    description: 'Barras de navegación fijas (Sticky) en Conciliación.',
    isCurrent: false,
    changes: [
      'La barra de selección de sede se mantiene fija en la parte superior.',
      'La barra de cambio de cuenta (Efectivo/QR) se mantiene fija al hacer scroll para mayor agilidad.',
      'Mejora de visibilidad con efectos de desenfoque y capas de prioridad (Z-Index).'
    ]
  },
  {
    version: '1.1.35',
    date: '2026-04-28',
    description: 'Mejora en la legibilidad de descripciones del Libro Mayor.',
    isCurrent: false,
    changes: [
      'Se habilitó el ajuste de texto (text wrapping) en las descripciones del Libro Mayor para evitar desplazamientos horizontales.',
      'Uso de break-words y leading-snug para mejorar la visualización de registros con descripciones extensas.'
    ]
  },
  {
    version: '1.1.34',
    date: '2026-04-28',
    description: 'Mejora en la gestión de espacio de la vista de conciliación.',
    isCurrent: false,
    changes: [
      'Implementación de sidebar colapsable para "Cierres de Caja".',
      'Expansión automática del Libro Mayor a pantalla completa cuando los cierres están ocultos.',
      'Inclusión de botón de restauración rápido para volver a mostrar los cierres de caja.'
    ]
  },
  {
    version: '1.1.33',
    date: '2026-04-18',
    description: 'Optimización de ancho de pantalla y UI en vista de conciliación.',
    isCurrent: false,
    changes: [
      'Eliminación de restricciones de ancho máximo (max-width) para aprovechar todo el espacio disponible en pantallas de escritorio.',
      'Ajuste de espaciados laterales y grids para mejorar la visibilidad del Libro Mayor y los registros de cuentas.'
    ]
  },
  {
    version: '1.1.32',
    date: '2026-04-17',
    description: 'Separación de Tarjeta, Nequi y Daviplata de la conciliación QR.',
    isCurrent: false,
    changes: [
      'Se eliminaron los pagos de Tarjeta, Nequi y Daviplata de la categoría de QR en la conciliación bancaria.',
      'Ahora solo se incluyen Efectivo, QR (Bancolombia), Addi y Sistecredito en los totales de cierre de caja, respetando el flujo de trabajo original.'
    ]
  },
  {
    version: '1.1.31',
    date: '2026-04-14',
    description: 'Seguimiento de saldo acumulado en intercambios entre sedes.',
    isCurrent: false,
    changes: [
      'Se añadió el cálculo de saldo acumulado (running balance) en el historial de intercambios entre sedes.',
      'Ahora cada registro de deuda o pago muestra el saldo resultante después de ese movimiento, facilitando el seguimiento de la deuda histórica.'
    ]
  },
  {
    version: '1.1.30',
    date: '2026-04-14',
    description: 'Sincronización masiva de cierres y soporte universal de comisiones.',
    isCurrent: false,
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
