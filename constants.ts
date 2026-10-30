
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
  { version: '1.1.199', date: '2026-10-30', description: 'Traslados únicos con stock verificado', isCurrent: true, changes: ['Valida las existencias de origen y destino dentro de la misma transacción.', 'Los reintentos y aprobaciones repetidas no duplican el traslado ni sus movimientos.', 'Espera la confirmación antes de limpiar el formulario y conserva sus datos cuando falla.', 'Detiene el traslado si el destino tiene varios productos con el mismo nombre.', 'No modifica existencias ni historiales anteriores.'] },
  { version: '1.1.198', date: '2026-10-30', description: 'Protección contra ventas duplicadas', isCurrent: false, changes: ['El pago espera confirmación y bloquea envíos repetidos mientras guarda.', 'Los reintentos de una misma operación recuperan su factura sin repetir inventario ni pagos.', 'Conserva la separación por usuario, empresa y sede y permite ventas legítimas distintas.', 'No modifica automáticamente facturas ni saldos históricos.'] },
  { version: '1.1.197', date: '2026-10-30', description: 'Aprobación única de cambios de prenda', isCurrent: false, changes: ['Una solicitud de cambio procesada no vuelve a descontar inventario al repetir su aprobación.', 'La aprobación confirma el estado guardado de la solicitud y actualiza prendas, venta e historial en una transacción.', 'Bloquea el botón mientras guarda; conserva empresa, sede y permisos.', 'No altera automáticamente registros ni existencias históricas.'] },
  { version: '1.1.196', date: '2026-10-27', description: 'Cruces entre sedes más claros en el libro de caja', isCurrent: false, changes: ['Identifica la sede relacionada y distingue los pagos y préstamos reconocidos en los movimientos.', 'Resume los pagos entre sedes y permite consultar las referencias completas en su detalle.', 'Conserva registros, exportaciones y cálculos financieros originales.'] },
  { version: '1.1.195', date: '2026-10-25', description: 'Apertura móvil y catálogo al ingresar', isCurrent: false, changes: ['Desactiva la transparencia animada y el desenfoque del formulario de ingreso en dispositivos táctiles.', 'Evita que la llegada de la lista de sedes borre productos ya cargados en el punto de venta.', 'Conserva la conexión de inventario del administrador si las sedes consultadas no cambian.', 'Mantiene el stock en vivo y la separación entre usuarios, empresas y sedes.'] },
  { version: '1.1.194', date: '2026-10-25', description: 'Control de medición desde Developer', isCurrent: false, changes: ['Permite mostrar u ocultar el medidor en el login y el POS de este navegador desde Developer.', 'Permite compartir un enlace para medir el ingreso en una pestaña concreta.', 'Retira el aviso de carga del resumen y mantiene las cifras pendientes sin mostrar ceros provisionales.'] },
  { version: '1.1.193', date: '2026-10-25', description: 'Datos mensuales del resumen optimizados', isCurrent: false, changes: ['Usa resúmenes mensuales compactos de apartados y movimientos financieros en la pantalla principal.', 'Incluye los abonos actuales de apartados antiguos y conserva los pendientes del menú.', 'Mantiene cifras, filtros e historial visibles; editar y reimprimir consultan el apartado original.'] },
  { version: '1.1.192', date: '2026-10-25', description: 'Resumen sin alerta de diferencias', isCurrent: false, changes: ['Retira la alerta de descuadre del resumen en móvil y PC.', 'Consulta los conteos al abrir su historial y conserva la verificación, las notas y la aplicación de conteos.', 'Conserva los ingresos, los abonos antiguos, los filtros y el gráfico del resumen.'] },
  { version: '1.1.191', date: '2026-10-25', description: 'Acceso verificado en producción', isCurrent: false, changes: ['Conserva el usuario, la contraseña y la pantalla de ingreso habituales.', 'Verifica el acceso mediante el servidor y mantiene privadas las credenciales.', 'Conserva el resumen del negocio, las sedes y las mejoras de carga de la versión anterior.'] },
  { version: '1.1.190', date: '2026-10-24', description: 'Resúmenes verificados de inventario y ventas en producción', isCurrent: false, changes: ['Conserva el resumen del negocio original y usa acumulados verificados para el valor del inventario y las columnas mensuales del gráfico.', 'Carga las ventas del mes y las ventas antiguas con pagos en el período, manteniendo el historial y la edición habituales.', 'Los acumulados se actualizan desde el servidor después de cada cambio; las sedes sin verificar conservan la carga anterior.', 'El acceso actual sigue activo mientras se autoriza el permiso necesario para emitir los tokens del login verificado.'] },
  { version: '1.1.189', date: '2026-10-24', description: 'Mejoras compatibles de rendimiento y conciliación en producción', isCurrent: false, changes: ['Agiliza la validación del borrador detallado mediante una consulta por sede y categoría.', 'Conserva cuenta y panel de cierres al cambiar de sede y adapta el registro de movimientos a móvil.', 'Pospone fuentes de conciliación hasta abrir cierres y evita preparar accesos externos que el POS no utiliza.', 'Conserva el acceso actual y el resumen original; los nuevos acumulados y la identidad verificada requieren su activación de producción.'] },
  { version: '1.1.188', date: '2026-10-24', description: 'Inicio de autenticación ajustado al login verificado de staging', isCurrent: false, changes: ['Evita preparar ventanas de acceso externo que no usa el ingreso con token de staging.', 'Conserva la persistencia de sesión, sus alternativas de almacenamiento y la sincronización entre pestañas.', 'Mantiene las validaciones, el formulario y las etapas de medición del ingreso.'] },
  { version: '1.1.187', date: '2026-10-24', description: 'Diagnóstico por etapas del ingreso verificado en staging', isCurrent: false, changes: ['Separa la restauración de Firebase del cierre de sesión previo.', 'Al medir un ingreso, incluye tiempos internos del servicio de identidad sin guardar credenciales ni datos de documentos.', 'Conserva el formulario, los permisos y todas las validaciones de acceso.'] },
  { version: '1.1.186', date: '2026-10-24', description: 'Preparación anticipada del código de ingreso en staging', isCurrent: false, changes: ['Descarga los módulos de autenticación al entrar en los campos del login, sin enviar credenciales ni iniciar sesión.', 'Mantiene el formulario y todas las validaciones de acceso.', 'El diagnóstico separa la carga del módulo de acceso, la preparación de Firebase y el cierre de la sesión previa.'] },
  { version: '1.1.185', date: '2026-10-24', description: 'Menos solicitudes al comprobar el borrador detallado', isCurrent: false, changes: ['El borrador comprueba sus productos con una consulta por sede y categoría, conservando las validaciones y los productos históricos sin empresa explícita.', 'Conserva el conteo, la foto del sistema y el historial, sin modificar el stock al guardar borrador.', 'Las transacciones conservan sus lecturas propias para mantener la detección de conflictos.'] },
  { version: '1.1.184', date: '2026-10-24', description: 'Validación del borrador detallado sin lecturas en serie', isCurrent: false, changes: ['Las comprobaciones de productos del borrador se leen en grupos simultáneos, conservando las validaciones de empresa, sede y categoría.', 'El borrador y su historial siguen guardándose juntos sin aplicar conteos al stock.', 'El diagnóstico mide la comprobación de productos y el guardado completo del borrador.'] },
  { version: '1.1.183', date: '2026-10-24', description: 'Valor del inventario por resumen en staging', isCurrent: false, changes: ['El panel conserva su diseño y obtiene el valor total del inventario desde el resumen verificado de la sede.', 'Los informes consultan los productos vendidos en el período; la edición carga el catálogo completo automáticamente.', 'Las sedes sin resumen verificado conservan la carga habitual del inventario.'] },
  { version: '1.1.182', date: '2026-10-24', description: 'Ventas del mes en el panel original de staging', isCurrent: false, changes: ['El panel conserva su diseño habitual y consulta las ventas del mes seleccionado.', 'El historial permite cargar otros meses al seleccionarlos.', 'El gráfico visible usa los resúmenes mensuales verificados de la sede.'] },
  { version: '1.1.181', date: '2026-10-24', description: 'Regresa el panel original con gráfico mensual resumido en staging', isCurrent: false, changes: ['Se restaura la pantalla habitual con todas sus secciones y el gráfico visible.', 'Las columnas mensuales del gráfico usan resúmenes verificados de cada mes.', 'La consulta de ventas por mes queda preparada y protegida por una bandera hasta que su índice esté listo en staging.'] },
  { version: '1.1.180', date: '2026-10-24', description: 'Resumen diario por sede y herramientas a demanda en staging', isCurrent: false, changes: ['El ingreso usa los resúmenes verificados del período; ventas e inventario completos se consultan al abrir Historial y herramientas.', 'El gráfico anual se consulta al abrirlo y conserva filtros, métricas y comparación con el período anterior.', 'Los pagos de apartados antiguos cuentan en su fecha de recepción; las sedes sin resumen verificado conservan el panel completo.'] },
  { version: '1.1.179', date: '2026-10-24', description: 'Menos consultas al abrir el panel inicial', isCurrent: false, changes: ['Compras y bonos se cargan en las pantallas operativas que los utilizan, sin descargarlos al entrar al panel.', 'Las notas diarias se consultan al abrir Ventas, conservando el historial editable, pagos, gráficos y alertas del panel inicial.'] },
  { version: '1.1.178', date: '2026-10-24', description: 'Usuarios visibles al reconocer el permiso Developer', isCurrent: false, changes: ['Actualiza el alcance de la lista de usuarios al activar o revocar el permiso Developer verificado.', 'Los administradores ya creados y los nuevos aparecen en su empresa sin volver a iniciar sesión.'] },
  { version: '1.1.177', date: '2026-10-23', description: 'Administradores de empresa desde Developer en staging', isCurrent: false, changes: ['Crear administrador usa los servicios de identidad verificada en staging.', 'Crea o reutiliza un rol administrador propio de la empresa y respeta sus módulos permitidos sin depender del rol legado principal.'] },
  { version: '1.1.176', date: '2026-10-23', description: 'Medición desde el login de staging', isCurrent: false, changes: ['Permite iniciar la medición antes de ingresar y conservarla durante las consultas de arranque del POS.', 'Distingue carga del código, servicio de identidad y autenticación sin registrar credenciales ni contenido de documentos.'] },
  { version: '1.1.175', date: '2026-10-24', description: 'Ingreso de movimientos compacto y guardar visible en móvil', isCurrent: false, changes: ['El formulario aparece sobre el menú de navegación y mantiene las acciones fuera del desplazamiento.', 'Se adapta al teclado móvil y reduce el espacio entre campos y movimientos conservando los datos de cruces.'] },
  { version: '1.1.174', date: '2026-10-23', description: 'Conciliación carga cierres a demanda y conserva la cuenta al cambiar de sede', isCurrent: false, changes: ['Ventas y apartados se consultan al abrir Cierres de Caja; no se cargan gastos sin uso al abrir conciliación.', 'La cuenta del libro, la cuenta de cierres y el panel abierto se conservan entre sedes dentro de la misma empresa y usuario.', 'Los cierres mantienen los pagos recientes de apartados antiguos y muestran carga o error sin reutilizar los datos de otra sede.'] },
  { version: '1.1.173', date: '2026-10-23', description: 'Errores de conciliación visibles dentro del formulario', isCurrent: false, changes: ['Los fallos de guardado se muestran dentro del formulario y conservan el borrador.', 'El medidor incluye códigos de error de Firebase permitidos, sin mensajes ni datos del movimiento.'] },
  { version: '1.1.172', date: '2026-10-23', description: 'Tiempos del guardado en el medidor de staging', isCurrent: false, changes: ['El diagnóstico separa la duración completa de transacciones, lecturas y validaciones.', 'Los guardados interrumpidos durante la medición se identifican como incompletos.', 'No se modifica la lógica de conciliación ni se agregan consultas.'] },
  { version: '1.1.171', date: '2026-10-23', description: 'Medición local de consultas en staging', isCurrent: false, changes: ['Developer dispone de un medidor optativo por acción con resultados de servidor, caché y transacciones.', 'El diagnóstico funciona en memoria y permite descargar el resultado sin consultas adicionales.', 'Las consultas, permisos y datos operativos conservan su comportamiento.'] },
  { version: '1.1.170', date: '2026-10-18', description: 'Edición de abonos protegida en celular', isCurrent: false, changes: ['El editor de abonos ocupa la pantalla móvil completa y se muestra por encima del menú inferior.', 'Cancelar y Guardar cambios permanecen visibles en una zona fija, amplia y protegida por el espacio seguro de Android.', 'Los productos, pagos, fechas y estados del abono conservan su funcionamiento actual.'] },
  { version: '1.1.169', date: '2026-10-18', description: 'Edición de ventas protegida en celular', isCurrent: false, changes: ['El editor del historial ocupa la pantalla móvil completa y se muestra por encima del nuevo menú inferior.', 'Cancelar y Guardar cambios permanecen visibles en una zona fija, amplia y protegida por el espacio seguro de Android.', 'La edición de precios, cantidades, descuentos y pagos conserva el comportamiento de la versión anterior.'] },
  { version: '1.1.168', date: '2026-10-17', description: 'Conciliación con lectura paginada por sede', isCurrent: false, changes: ['El libro y los cruces consultan páginas de 50 movimientos y conservan los saldos del histórico completo.', 'Los resúmenes de cada sede se verifican contra los movimientos originales antes de activarse y se actualizan en el servidor.', 'Los cierres y exportaciones conservan sus datos completos; el menú, el resumen del negocio y el acceso actual se mantienen.'] },
  { version: '1.1.167', date: '2026-10-17', description: 'Usuarios sin identificadores duplicados', isCurrent: false, changes: ['Las altas y ediciones verifican nombres y usuarios de acceso sin distinguir mayúsculas ni espacios exteriores.', 'El guardado de cuentas se coordina para evitar duplicados entre administradores y conserva los datos ante conflictos.', 'La validación incluye cuentas desactivadas y altas de administradores, sin añadir consultas al inicio de sesión.'] },
  { version: '1.1.166', date: '2026-10-17', description: 'Correcciones y carga por sede en producción', isCurrent: false, changes: ['Se conservan el resumen completo y el acceso actual de producción.', 'Conciliación conserva borradores y confirma los cambios de las dos contrapartes.', 'La carga por sede funciona también con el acceso actual; el nuevo login sigue pendiente de migración.'] },
  { version: '1.1.165', date: '2026-10-16', description: 'Restauración completa del resumen del negocio', isCurrent: false, changes: ['El resumen conserva el historial de ventas, medios de pago, diferencias de precios, categorías y top de productos originales.', 'La carga permanece limitada a la sede activa y los informes multisede se consultan al solicitarlos.', 'Se reutilizan los datos filtrados mientras no cambien para evitar cálculos repetidos al usar los controles.'] },
  { version: '1.1.164', date: '2026-10-17', description: 'Menú móvil del resumen restaurado', isCurrent: false, changes: ['Se recupera la barra inferior de fechas y accesos del resumen del negocio, conservando la carga por sede a solicitud.'] },
  { version: '1.1.163', date: '2026-10-16', description: 'Resumen por sede con carga a solicitud', isCurrent: false, changes: ['El resumen consulta acumulados verificados por sede y período, conservando los abonos recibidos en días posteriores.', 'El inventario y los historiales se consultan al abrir sus herramientas; la comparación multisede se carga a solicitud.', 'El ingreso reutiliza los datos que ya verificó el servidor.'] },
  { version: '1.1.162', date: '2026-10-16', description: 'Inicio más ligero', isCurrent: false, changes: ['El formulario de ingreso abre antes de descargar la aplicación operativa.', 'Se prepara un resumen por sede con acumulados diarios y mensuales, pendiente de activar tras verificar Firebase.', 'Las consultas por sede y módulo quedan preparadas bajo activación de staging.'] },
  { version: '1.1.161', date: '2026-10-16', description: 'Libro y cruces por páginas', isCurrent: false, changes: ['El libro y los historiales entre sedes se consultan en páginas de 50 movimientos, conservando los saldos completos.', 'Los cierres del mes se cargan al abrir Cierres de Caja.', 'Se corrige el avance de página y la visualización de sedes cuyo historial todavía no se ha abierto.'] },
  { version: '1.1.160', date: '2026-10-16', description: 'Ingreso verificado por empresa y sede', isCurrent: false, changes: ['El servidor verifica usuario y contraseña y entrega una identidad de empresa, sede y rol.', 'La gestión de usuarios protege las contraseñas e invalida los accesos anteriores al cambiarlas o desactivar una cuenta.'] },
  { version: '1.1.159', date: '2026-10-16', description: 'Conciliación por sede y guardado de cruces', isCurrent: false, changes: ['El libro carga la sede activa y muestra páginas de 50 movimientos conservando sus saldos históricos.', 'Los cruces se editan, eliminan y restauran en ambas sedes dentro de una transacción; los borradores permiten reintentar sin duplicar.', 'Se prepara una proyección de saldos por sede que solo se activa después de verificar el histórico en Firebase.'] },
  { version: '1.1.158', date: '2026-10-15', description: 'Nómina con ventas del día completo', isCurrent: false, changes: ['Las unidades y comisiones incluyen las ventas del día completo en horario de Colombia para la vendedora y sede seleccionadas.', 'Los horarios de entrada y salida solo afectan las horas trabajadas y el salario.'] },
  { version: '1.1.157', date: '2026-10-15', description: 'Edición consistente de ventas', isCurrent: false, changes: ['Precios, cantidades, descuentos y recargos recalculan el total inmediatamente; el pago único puede ajustarse al total y los pagos mixtos permiten asignar la diferencia.', 'El formulario espera la confirmación del guardado, evita dobles envíos y conserva los cambios cuando falla.'] },
  { version: '1.1.156', date: '2026-10-14', description: 'Estimado de cierre mensual', isCurrent: false, changes: ['Debajo de cada mes se muestra una proyección de cierre según el acumulado comparable y los días de ese mes, en lugar de repetir el valor de la línea.'] },
  { version: '1.1.155', date: '2026-10-14', description: 'Valor visible sobre la línea comparativa', isCurrent: false, changes: ['Cada línea mensual del acumulado a la fecha muestra el valor completo en pesos junto al marcador.'] },
  { version: '1.1.154', date: '2026-10-14', description: 'Comparativo mensual a la misma fecha', isCurrent: false, changes: ['Se restaura la línea y el valor acumulado hasta el mismo día en cada mes del gráfico de ingresos.', 'Mensual continúa como vista inicial y conserva los totales completos de enero a diciembre.'] },
  { version: '1.1.153', date: '2026-10-14', description: 'Gráfico mensual de todo el año', isCurrent: false, changes: ['Mensual muestra enero a diciembre del año elegido con meses completos, sin limitarse al rango de fechas.', 'Los valores se muestran completos en pesos; la vista diaria conserva las fechas seleccionadas.'] },
  { version: '1.1.152', date: '2026-10-14', description: 'Abonos recibidos y recaudos en caja', isCurrent: false, changes: ['Ingresos y gráfico incluyen los recaudos recibidos una sola vez, separados de la utilidad.', 'El reporte diario suma recaudos en efectivo a la caja esperada y conserva compatibilidad con recaudos antiguos sin medio de pago.'] },
  { version: '1.1.151', date: '2026-10-14', description: 'Gráfico de ingresos y vista móvil', isCurrent: false, changes: ['El gráfico de ingresos usa los mismos pagos y fechas del total del período; conserva la vista de ventas históricas.', 'Barras adaptadas al celular con desplazamiento, detalle al tocar y espacio para los controles inferiores.'] },
  { version: '1.1.150', date: '2026-10-12', description: 'Guardar ventas editadas en móvil', isCurrent: false, changes: ['La edición de ventas se muestra sobre el menú y mantiene sus botones visibles con altura dinámica y espacio seguro en Android.'] },
  { version: '1.1.149', date: '2026-10-10', description: 'Restauración de Firebase de pruebas', isCurrent: false, changes: ['Staging recupera la configuración de Firebase por entorno y bloquea el proyecto de producción.'] },
  { version: '1.1.148', date: '2026-10-10', description: 'Corrección de apertura de staging', isCurrent: false, changes: ['Los módulos y el manifiesto se cargan desde la misma dirección de la aplicación para evitar bloqueos CORS.'] },
  { version: '1.1.147', date: '2026-10-10', description: 'Staging: abono por traer e historial de stock', isCurrent: false, changes: ['Se separan Abono y Abono por traer; este último permite prendas con stock cero y descuenta inventario al recibirlas.', 'El historial registra movimientos numéricos y ventas editadas por producto; los registros antiguos sin cantidad dejan el saldo como desconocido.', 'La aprobación, edición y eliminación de novedades dañadas aplican el cambio de stock dentro de transacciones.'] },
  { version: '1.1.146', date: '2026-10-10', description: 'Staging: encargos sin existencias', isCurrent: false, changes: ['Por traer permite seleccionar prendas del catálogo con stock cero desde el carrito vacío, las categorías o el escáner.', 'Crear y pagar el encargo no descuentan inventario; las ventas y la recepción comprueban existencias en una transacción.'] },
  { version: '1.1.145', date: '2026-10-10', description: 'Staging: recibir reemplazo en novedades de daño', isCurrent: false, changes: ['El administrador puede seleccionar una prenda distinta al recibir un arreglo o cambio desde la misma novedad.', 'Se suma una unidad al producto recibido, se conserva la prenda enviada y se registra el historial en una transacción que evita duplicados.'] },
  { version: '1.1.144', date: '2026-10-10', description: 'Staging: inventario y comparación mensual', isCurrent: false, changes: ['Se restaura el valor total del inventario actual a costo en Resumen del negocio.', 'Los rangos desde el primero del mes se comparan con el mismo tramo del mes anterior y los meses completos con el mes completo anterior.'] },
  { version: '1.1.143', date: '2026-10-10', description: 'Staging: módulos vinculados a su despliegue', isCurrent: false, changes: ['Cada módulo utiliza los archivos de su propio despliegue para evitar errores al navegar desde una pestaña anterior.', 'La caché conserva los archivos de ese despliegue; los errores de descarga permiten actualizar la aplicación manualmente.'] },
  { version: '1.1.142', date: '2026-10-10', description: 'Staging: espacio adaptable al compactar el menú', isCurrent: false, changes: ['El margen del contenido en escritorio sigue el ancho de la barra lateral y libera espacio para la cuadrícula de productos.'] },
  { version: '1.1.141', date: '2026-10-10', description: 'Staging: gráfico circular de ventas por categoría', isCurrent: false, changes: ['Icono junto a Ventas por Categoría para mostrar u ocultar la participación por valor vendido.', 'Porcentajes, valores y unidades con selección táctil, usando los datos del período ya cargados.'] },
  { version: '1.1.139', date: '2026-10-06', description: 'Conciliación: guardado inmediato y sin bloqueos', isCurrent: false, changes: ['Los cambios editados se reflejan inmediatamente mientras Firestore confirma el guardado.', 'El formulario deja de quedar aparentemente congelado después de guardar.', 'Se evita reenviar el mismo cambio mientras existe un guardado en curso y se revierte la vista si Firestore rechaza la operación.'] },
  { version: '1.1.138', date: '2026-10-06', description: 'Developer Center: cambio seguro de empresa y sede', isCurrent: false, changes: ['Cada cambio de empresa reemplaza la pantalla y cierra los modales anteriores, sin duplicar módulos.', 'El developer autorizado puede seleccionar las sedes de la empresa conectada; la cabecera refleja esa empresa.', 'Los formularios y respuestas pendientes quedan aislados por empresa y se descartan al salir.', 'Developer Center suspende las lecturas operativas; el cambio de sede reutiliza las suscripciones de inventario de la empresa.'] },
  { version: '1.1.137', date: '2026-10-03', description: 'Traslados exclusivos de administradores', isCurrent: false, changes: ['La pestaña de Traslados Internos solo está disponible para administradores y Developer.', 'Los vendedores mantienen acceso a Novedades y a las solicitudes de traslado de su sede.'] },
  { version: '1.1.136', date: '2026-10-02', description: 'Búsquedas conservadas entre sedes', isCurrent: false, changes: ['El texto del buscador del POS se conserva al cambiar de tienda.', 'Se conservan también las búsquedas pendientes de historiales, resumen, conciliación, vendedores, CEO y etiquetas.'] },
  { version: '1.1.135', date: '2026-10-02', description: 'Solicitudes por sede y filtros conservados', isCurrent: false, changes: ['Las solicitudes de traslado aparecen únicamente en la sede que registra la novedad.', 'Los filtros de consulta se conservan al cambiar de sede o módulo dentro de la misma empresa y sesión.'] },
  { version: '1.1.134', date: '2026-10-02', description: 'Visibilidad de solicitudes de traslado', isCurrent: false, changes: ['Las solicitudes de traslado se muestran en origen y destino dentro de la misma empresa.', 'El formulario espera la confirmación de guardado y muestra errores sin perder la información.'] },
  { version: '1.1.133', date: '2026-10-02', description: 'Consulta de novedades, abonos y traslados', isCurrent: false, changes: ['Todos los roles válidos pueden consultar novedades, abonos y traslados sin restricción automática de meses.', 'El nuevo acceso es de consulta; se conservan los permisos de operación y la separación por empresa y tienda.'] },
  { version: '1.1.132', date: '2026-10-02', description: 'Inicio y navegación estables', isCurrent: false, changes: ['Cada módulo reemplaza la pantalla anterior y vuelve al inicio.', 'Los fallos de carga muestran una opción de recuperación en lugar de una pantalla en blanco.', 'Se conserva la caché anterior de módulos para las sesiones abiertas durante una actualización.'] },
  { version: '1.1.131', date: '2026-10-01', description: 'Recargo Opcional por Pago', isCurrent: false, changes: ['El vendedor puede quitar o volver a aplicar el recargo de cada pago antes de finalizar la venta.', 'El total y la factura reflejan el recargo elegido; se conserva la configuración del medio de pago.'] },
  { version: '1.1.130', date: '2026-10-01', description: 'Novedades Activas y Lectura de Etiquetas', isCurrent: false, changes: ['Vendedores ven el mes actual y solo novedades pendientes y abonos activos o por traer del mes anterior, con fechas de Bogotá.', 'Cada lectura de código seguida de Enter agrega una unidad al carrito, sin duplicación por coincidencia automática de SKU.', 'Se mantienen el aislamiento por empresa y tienda y los permisos administrativos.'] },
  { version: '1.1.129', date: '2026-10-01', description: 'Preparación de Identidad Firebase', isCurrent: false, changes: ['Servidor preparado para validar credenciales y emitir una identidad Firebase por usuario y empresa.', 'Developer se determina por Carlos o una autorización activa del propietario.', 'Preparación pendiente de despliegue administrativo; se mantienen el login y las reglas existentes.'] },
  { version: '1.1.128', date: '2026-10-01', description: 'Separación de Novedades, Exportaciones y Cachés', isCurrent: false, changes: ['Cambios de prendas y garantías validan los productos y ventas vinculados a la empresa y sede.', 'Las exportaciones descartan datos ajenos antes de generar archivos.', 'La caché almacena únicamente archivos estáticos; escaneos y formularios se separan por contexto.'] },
  { version: '1.1.127', date: '2026-10-01', description: 'Auditoría de Clientes, Usuarios y Configuración', isCurrent: false, changes: ['Los permisos validan la empresa del rol y la sede del usuario antes de abrir una pantalla.', 'Los historiales de clientes se filtran por empresa y sede; las escrituras verifican la sede real.', 'Los roles de plataforma no se asignan mediante roles de empresa; las imágenes pendientes no cambian otra sede.'] },
  { version: '1.1.126', date: '2026-09-30', description: 'Auditoría de Contabilidad, Reportes y CEO', isCurrent: false, changes: ['Los cálculos y datos enviados a IA se filtran por empresa y sede.', 'El CEO carga compras, gastos, ventas y abonos de la selección elegida con suscripciones compartidas.', 'Los chats y reportes descartan respuestas de contextos anteriores; las sugerencias CEO se solicitan con un botón.'] },
  { version: '1.1.125', date: '2026-09-30', description: 'Historial de Versiones en Developer', isCurrent: false, changes: ['El login muestra únicamente el número de versión.', 'El historial se consulta desde un botón dentro del Developer Center.'] },
  { version: '1.1.124', date: '2026-10-01', description: 'Auditoría de Inventario, Compras y Conteos', isCurrent: false, changes: ['Inventario y reparación de categorías validan la empresa y sede real.', 'Compras, traslados y conteos verifican la sede de cada producto vinculado.', 'Los conteos descartan respuestas de selecciones anteriores; borrador e historial se guardan juntos.'] },
  { version: '1.1.123', date: '2026-09-30', description: 'Auditoría de Separación: Ventas y Finanzas', isCurrent: false, changes: ['Validación de bonos, ventas de origen, abonos y movimientos financieros vinculados.', 'Historial financiero y movimiento se guardan juntos, verificando la empresa de sus estados anteriores y nuevos.', 'Resultados de ventas y abonos pendientes no alteran recibos ni carritos después de cambiar empresa, sede o usuario.'] },
  { version: '1.1.122', date: '2026-09-30', description: 'Developer Exclusivo de Plataforma', isCurrent: false, changes: ['Carlos se identifica por su cuenta única, no por el nombre.', 'Solo Carlos asigna, crea o retira developers desde Developer Center.', 'Los roles y formularios de empresa no conceden acceso Developer.'] },
  { version: '1.1.121', date: '2026-10-01', description: 'Protección entre Empresas y Conciliación en Vivo', isCurrent: false, changes: ['Validación de empresa antes de modificar registros y sus referencias.', 'Conciliación y reportes con suscripciones compartidas en tiempo real.', 'Roles independientes por empresa y caché compatible con varias pestañas.'] },
  { version: '1.1.120', date: '2026-09-30', description: 'Nómina por Empresa, Sede y Horario', isCurrent: false,
    changes: ['La nómina filtra accesos y pagos por empresa y sede y utiliza el identificador del vendedor para sus accesos.', 'Las comisiones se calculan dentro del horario de cada jornada en hora Colombia; ventas sin inicio de sesión requieren validar el día.', 'Cambiar sede limpia la liquidación; guardar y eliminar pagos valida la empresa y sede del registro.']
  },
  { version: '1.1.119', date: '2026-09-30', description: 'Conteo sin Categorías en Cero', isCurrent: false,
    changes: ['La revisión de apertura oculta categorías cuya existencia total es cero en la sede seleccionada, conservando el catálogo y los historiales. Las existencias negativas siguen visibles para revisar inconsistencias.']
  },
  { version: '1.1.118', date: '2026-09-30', description: 'Protección de Categorías con Productos', isCurrent: false,
    changes: ['Se impide eliminar categorías con productos vinculados en cualquier sede, incluyendo productos deshabilitados o con existencias en cero.']
  },
  { version: '1.1.117', date: '2026-09-30', description: 'Categorías Independientes por Empresa', isCurrent: false,
    changes: ['Las categorías se crean y se muestran únicamente en su empresa.', 'Las categorías históricas permanecen en la empresa original; referencias compartidas en otras empresas se convierten en categorías propias sin cambiar existencias.']
  },
  {
    version: '1.1.116', date: '2026-09-30',
    description: 'Inventario de Apertura y Medios de Pago', isCurrent: false,
    changes: ['La verificación carga el inventario de la sede y muestra categorías con productos incluso en cero o sin referencia de categoría.', 'Se informa la carga, errores o inventario vacío antes de permitir guardar.', 'Los medios de pago permanecen visibles cuando una venta tiene total cero.']
  },
  {
    version: '1.1.115',
    date: '2026-09-30',
    description: 'Acceso Temporal Carlos Developer',
    isCurrent: false,
    changes: ['Excepción temporal para el usuario exacto Carlos; no se conceden privilegios por coincidencias parciales como Carlos V.']
  },
  {
    version: '1.1.114',
    date: '2026-09-30',
    description: 'Estilos Integrados en Vestika',
    isCurrent: false,
    changes: ['Los estilos se generan durante la compilación y se cargan desde Vestika, sin depender del CDN de Tailwind.', 'Se conservan el tema, las animaciones y los estilos de impresión.']
  },
  {
    version: '1.1.113',
    date: '2026-09-30',
    description: 'Corrección de Acceso Developer',
    isCurrent: false,
    changes: ['El nombre y el usuario ya no conceden acceso Developer; se exige asignación explícita o rol autorizado.']
  },
  {
    version: '1.1.112',
    date: '2026-09-30',
    description: 'Permisos de Revisión de Etiquetas',
    isCurrent: false,
    changes: ['El acceso desde el POS respeta los permisos efectivos del rol y los módulos de la empresa.', 'El permiso Revisión de Etiquetas identifica claramente el acceso a auditoría y verificador.']
  },
  {
    version: '1.1.111',
    date: '2026-09-30',
    description: 'Degradado Vestika Más Intenso',
    isCurrent: false,
    changes: ['Degradado azul cielo, morado y rosa más intenso en ik, conservando el borde luminoso y las demás letras blancas.']
  },
  {
    version: '1.1.110',
    date: '2026-09-30',
    description: 'Colores Suaves de Vestika',
    isCurrent: false,
    changes: ['Letras blancas y degradado azul cielo, lavanda y rosa claro en ik, con borde luminoso.']
  },
  {
    version: '1.1.109',
    date: '2026-09-30',
    description: 'Marca Vestika dentro del POS',
    isCurrent: false,
    changes: ['Vestika reemplaza el nombre Sistema POS en la cabecera.', 'Las letras i y k utilizan un degradado rosa y violeta en el login y la cabecera.']
  },
  {
    version: '1.1.108',
    date: '2026-09-30',
    description: 'Tipografía Vestika',
    isCurrent: false,
    changes: ['Nombre Vestika más grande y con tipografía serif en el inicio de sesión.']
  },
  {
    version: '1.1.107',
    date: '2026-09-30',
    description: 'Logo Vestika Actualizado',
    isCurrent: false,
    changes: ['Se utiliza el nuevo archivo vestika.png en el login, la pestaña y la aplicación instalada.']
  },
  {
    version: '1.1.106',
    date: '2026-09-30',
    description: 'Identidad Vestika POS',
    isCurrent: false,
    changes: ['Logo original de Vestika en el inicio de sesión.', 'Nombre Vestika POS en la pestaña y la aplicación instalada.']
  },
  {
    version: '1.1.105',
    date: '2026-09-30',
    description: 'Límites de Usuarios por Empresa',
    isCurrent: false,
    changes: [
      'El Developer configura cupos separados para administradores y vendedores.',
      'La creación y el cambio de rol se bloquean al alcanzar el cupo contratado.',
      'Los roles personalizados se clasifican por tipo de licencia para evitar evadir límites.'
    ]
  },
  {
    version: '1.1.104',
    date: '2026-09-30',
    description: 'Corrección de Referencia en Carga Masiva',
    isCurrent: false,
    changes: ['Se importa normalizeText para permitir resolver y crear las categorías en la carga masiva.']
  },
  {
    version: '1.1.103',
    date: '2026-09-30',
    description: 'Carga Masiva con Guardado Confirmado',
    isCurrent: false,
    changes: [
      'Las categorías nuevas se crean junto con los productos en un único guardado.',
      'La ventana espera la confirmación del guardado antes de cerrarse.',
      'Si falla la importación, muestra el error y conserva los datos para reintentar.',
      'El historial de productos conserva la empresa de la tienda.'
    ]
  },
  {
    version: '1.1.102',
    date: '2026-09-29',
    description: 'Recargo Configurable por Medio de Pago',
    isCurrent: false,
    changes: [
      'Nuevo porcentaje de recargo al cliente configurable por medio de pago.',
      'El recargo se calcula automáticamente al seleccionar el medio y funciona con pagos mixtos.',
      'El valor queda guardado separado de la comisión del proveedor financiero.',
      'Recibo impreso y WhatsApp discriminan subtotal, recargo y total final.'
    ]
  },
  {
    version: '1.1.101',
    date: '2026-09-29',
    description: 'Corrección de Carga Masiva y Edición de Productos',
    isCurrent: false,
    changes: [
      'La carga masiva convierte correctamente el nombre de categoría a categoryId.',
      'Los productos importados quedan asociados a su categoría real.',
      'El editor ya no falla al abrir productos antiguos que quedaron sin categoryId.',
      'Los nuevos productos masivos conservan companyId para el aislamiento por empresa.'
    ]
  },
  {
    version: '1.1.100',
    date: '2026-09-28',
    description: 'Protección de Pantallas por Rol',
    isCurrent: false,
    changes: [
      'Cada pantalla valida los permisos reales del rol del usuario.',
      'Un usuario ya no puede quedar en Resumen del negocio si su rol no tiene ese permiso.',
      'Al iniciar sesión se redirige automáticamente al primer módulo autorizado.',
      'La protección aplica a todos los roles, no solamente al rol Vista.'
    ]
  },
  {
    version: '1.1.99',
    date: '2026-09-27',
    description: 'Auditoría de Etiquetas Sincronizada con Ventas',
    isCurrent: false,
    changes: [
      'Las etiquetas faltantes se recalculan automáticamente con el stock actual.',
      'Si se vende una prenda después de la auditoría, disminuye la cantidad pendiente por imprimir.',
      'El modal de impresión permanece sincronizado con el inventario en tiempo real.',
      'Las etiquetas marcadas para reetiquetado se conservan independientemente del faltante por stock.'
    ]
  },
  {
    version: '1.1.102',
    date: '2026-09-26',
    description: 'Configuración flexible y vista previa real de etiquetas',
    isCurrent: false,
    changes: [
      'La impresión permite configurar ancho, alto, columnas, filas y separación horizontal y vertical.',
      'La vista previa representa la misma distribución que se envía a la impresora, incluidos los espacios entre etiquetas.',
      'Se añadió ajuste vertical para adaptar rollos y hojas de distintos formatos sin alterar las configuraciones anteriores.'
    ]
  },
  {
    version: '1.1.101',
    date: '2026-09-26',
    description: 'Cambio de tienda inmediato en el punto de venta',
    isCurrent: false,
    changes: [
      'El administrador conserva en memoria el inventario independiente de cada tienda durante la sesión.',
      'Al cambiar de tienda, los productos disponibles aparecen sin vaciar la pantalla.',
      'El inventario se mantiene actualizado en segundo plano sin volver a leer el catálogo en cada cambio.'
    ]
  },
  {
    version: '1.1.100',
    date: '2026-09-25',
    description: 'Orden inicial alfabético en el punto de venta',
    isCurrent: false,
    changes: [
      'El punto de venta abre en orden alfabético, con productos disponibles primero y agotados al final.',
      'El administrador puede elegir manualmente los modos Inteligente, Tendencias o Recompra cuando los necesite.'
    ]
  },
  {
    version: '1.1.99',
    date: '2026-09-25',
    description: 'Carga por módulos y navegación más ligera',
    isCurrent: false,
    changes: [
      'Los módulos se descargan al abrirlos, reduciendo la carga inicial.',
      'El inventario y los datos operativos compartidos conservan su conexión al cambiar de pantalla.',
      'Las consultas multisede evitan solicitudes duplicadas y consultan solo tiendas de la empresa activa.',
      'El buscador del POS reutiliza las estadísticas sin recalcular el historial con cada letra.',
      'Ventas, compras y bonos se mantienen actualizados en el POS.'
    ]
  },
  {
    version: '1.1.98',
    date: '2026-09-25',
    description: 'POS Más Ligero y Menos Lecturas Firestore',
    isCurrent: false,
    changes: [
      'Se redujeron listeners permanentes al abrir el punto de venta.',
      'Ventas, compras, clientes y bonos se cargan una sola vez en lugar de mantenerse escuchando en tiempo real.',
      'Inventario, separados y carritos pendientes conservan actualización en tiempo real por ser operativos.',
      'Se reduce el consumo de lecturas de Firestore y la carga inicial del POS.'
    ]
  },
  {
    version: '1.1.97',
    date: '2026-09-25',
    description: 'Conteo Correcto por Categoría en Auditoría',
    isCurrent: false,
    changes: [
      'Los números de las categorías muestran unidades reales de stock y no cantidad histórica de referencias.',
      'Solo se cuentan productos activos, con stock positivo y pertenecientes a la tienda seleccionada.',
      'El total de categorías queda alineado con las prendas teóricas que realmente deben auditarse.'
    ]
  },
  {
    version: '1.1.96',
    date: '2026-09-24',
    description: 'Actualización de Novedades en Conciliación',
    isCurrent: false,
    changes: [
      'Las correcciones realizadas a una novedad existente se reflejan inmediatamente en la conciliación.',
      'Los excedentes agregados posteriormente, incluido QR, actualizan el caché multisede usado por conciliación.',
      'Se evita tener que recargar el sistema o registrar manualmente el excedente corregido.'
    ]
  },
  {
    version: '1.1.95',
    date: '2026-09-24',
    description: 'Corrección de Compilación del Escáner',
    isCurrent: false,
    changes: [
      'Se corrigió la estructura visual del módulo de auditoría que impedía compilar el despliegue.',
      'Se eliminó por completo el selector antiguo de cantidades para evitar contradicciones con el conteo seguro +1.',
      'Se mantiene el historial agrupado y el conteo de una prenda por cada lectura.'
    ]
  },
  {
    version: '1.1.94',
    date: '2026-09-24',
    description: 'Historial Claro de Auditoría de Etiquetas',
    isCurrent: false,
    changes: [
      'El historial de auditoría ahora agrupa cada referencia en una sola fila.',
      'Se muestra claramente el total real escaneado, el stock del sistema y las etiquetas faltantes.',
      'Se elimina la visualización confusa de acumulados #1, #2, #3 como si fueran escaneos separados.',
      'Se conserva la opción de restar una unidad o reportar una etiqueta equivocada desde cada referencia.'
    ]
  },
  {
    version: '1.1.93',
    date: '2026-09-24',
    description: 'Conteo Seguro de Etiquetas',
    isCurrent: false,
    changes: [
      'Cada lectura normal de etiqueta registra exactamente una prenda.',
      'Se desactivó el uso de multiplicadores en códigos durante la auditoría para evitar conteos accidentales.',
      'El registro manual y la cámara fuerzan +1 por cada lectura.',
      'La cámara amplía la protección contra lectura repetida del mismo código.',
      'La interfaz informa claramente que el modo auditoría cuenta una unidad por etiqueta.'
    ]
  },
  {
    version: '1.1.92',
    date: '2026-09-24',
    description: 'CEO Center Bajo Demanda',
    isCurrent: false,
    changes: [
      'CEO Center ya no dispara automáticamente la carga multisede ni sus cálculos al abrir el sistema.',
      'Al entrar al módulo se muestra una pantalla ligera con un botón para cargar y analizar la información manualmente.',
      'Las consultas y cálculos completos del CEO Center solo se activan cuando el usuario pulsa Cargar y analizar CEO Center.',
      'Se conservan intactos los datos y análisis completos una vez activados durante la sesión.'
    ]
  },
  {
    version: '1.1.91',
    date: '2026-09-20',
    description: 'Restauración de Datos CEO Center',
    isCurrent: false,
    changes: [
      'Se restaura la carga de información multisede del CEO Center para evitar indicadores en cero.',
      'CEO Center vuelve al comportamiento estable anterior mientras se optimiza su procesamiento interno.',
      'Se conserva la optimización general de listeners Firebase realizada en la versión 1.1.89.'
    ]
  },
  {
    version: '1.1.90',
    date: '2026-09-20',
    description: 'CEO Center Ligero por Sede',
    isCurrent: false,
    changes: [
      'CEO Center abre usando únicamente los datos de la sede activa del usuario o seleccionada en el menú principal.',
      'La información de todas las sedes deja de cargarse automáticamente al abrir CEO Center.',
      'La opción Todas las Sedes solicita explícitamente la carga multisede solo cuando el usuario la necesita.',
      'Al cambiar de sede en el menú principal, CEO Center sigue automáticamente esa sede mientras esté en modo local.',
      'Los cálculos pesados de comparación, vendedores e inventario trabajan sobre un conjunto de datos mucho menor en la apertura normal.'
    ]
  },
  {
    version: '1.1.89',
    date: '2026-09-20',
    description: 'Optimización de Carga y Lecturas Firebase',
    isCurrent: false,
    changes: [
      'Ventas, apartados y novedades multisede dejan de mantenerse con listeners globales permanentes para administradores.',
      'Dashboard, CEO Center, Conciliación y Reportes cargan la información multisede bajo demanda y la reutilizan durante la sesión.',
      'Compras carga y reutiliza el catálogo multisede para reconocer referencias, nombres y fotos de otras sedes sin mantener un listener global adicional.',
      'POS y módulos operativos conservan listeners por sede para mantener ventas y stock activos en tiempo real.',
      'Se eliminó el segundo listener global de inventario que se activaba en modo multisede.'
    ]
  },
  {
    version: '1.1.88',
    date: '2026-09-20',
    description: 'Navegación Responsive y Menú Adaptable',
    isCurrent: false,
    changes: [
      'Menú lateral de escritorio ahora puede contraerse y recuerda la preferencia del usuario.',
      'Navegación móvil más compacta para evitar choques entre selector de sede, menú y acciones del encabezado.',
      'Submenús móviles aprovechan mejor el ancho disponible y se adaptan a pantallas pequeñas.',
      'Área principal usa espaciado progresivo para celular, tablet y escritorio y evita desbordamientos horizontales innecesarios.'
    ]
  },
  {
    version: '1.1.87',
    date: '2026-09-20',
    description: 'CEO Center: Inventario Inteligente y Corrección de Recaudos en Efectivo',
    isCurrent: false,
    changes: [
      'Nuevo motor de inventario inteligente con recomendaciones de traslado, reabastecimiento y promoción basadas en rotación y stock de los últimos 30 días.',
      'Las recomendaciones son informativas: el sistema no realiza traslados ni compras automáticamente.',
      'Se corrigió el resumen del negocio para que los recaudos Sistecredito también sumen al Efectivo Neto, manteniendo su casilla separada para control.',
      'El desglose de Efectivo ahora muestra explícitamente cuánto corresponde a recaudos Sistecredito, alineándolo con la lógica de Conciliación.'
    ]
  },
  {
    version: '1.1.86',
    date: '2026-09-20',
    description: 'CEO Center: Desempeño Comercial por Vendedora',
    isCurrent: false,
    changes: [
      'Nuevo panel de desempeño de vendedoras dentro del consolidado del CEO Center.',
      'Muestra ventas, prendas vendidas, número de facturas y ticket promedio por vendedora.',
      'Compara automáticamente cada vendedora contra el periodo anterior equivalente y muestra su variación porcentual.',
      'Respeta el filtro de sede y el periodo seleccionado, manteniendo aislada la información de la empresa activa.'
    ]
  },
  {
    version: '1.1.85',
    date: '2026-09-20',
    description: 'Aislamiento Multiempresa y Preparación de Autenticación Segura',
    isCurrent: false,
    changes: [
      'Aislamiento operativo por empresa activa para evitar mezclar información entre Bombón/Street Legends y empresas cliente como Mayla.',
      'Validaciones de seguridad en productos, compras multitienda, traslados y usuarios para impedir operaciones entre empresas distintas.',
      'Los nuevos registros operativos comienzan a guardar companyId además de storeId, manteniendo compatibilidad con los datos históricos.',
      'El inicio de sesión ahora resuelve y conserva la empresa del usuario como preparación para la futura autenticación segura multiempresa.'
    ]
  },
  {
    version: '1.1.84',
    date: '2026-07-02',
    description: 'Compatibilidad Total con Microsoft Edge e Impresión de Alta Confiabilidad',
    isCurrent: false,
    changes: [
      'Impresión en Ventana Emergente Aislada (Popup): Se implementó la impresión utilizando una ventana popup independiente (`window.open`). Esto resuelve de raíz el problema de Microsoft Edge y algunos motores Chromium donde las llamadas de impresión en el hilo principal del documento congelan/bloquean la pestaña indefinidamente si se aplican reglas CSS complejas o si la configuración bloquea el diálogo.',
      'Control y Notificaciones para Bloqueadores de Ventanas: Si el navegador bloquea la apertura de ventanas emergentes (comportamiento por defecto en algunos perfiles estrictos de Edge), la aplicación detecta el bloqueo con gracia, activa una alerta instructiva clara para el usuario con pasos para resolverlo, y ofrece un fallback seguro.',
      'Detección Activa de Microsoft Edge: Se añadió detección de agente de usuario para Edge con mensajes y banners de ayuda contextuales específicos que mejoran significativamente la usabilidad y evitan la frustración del usuario.'
    ]
  },
  {
    version: '1.1.83',
    date: '2026-07-02',
    description: 'Solución Definitiva de Impresión Nativa sin Bloqueos',
    isCurrent: false,
    changes: [
      'Remoción de Iframe de Impresión: Se eliminó el uso de iframes ocultos dinámicos para la impresión de recibos, ya que las políticas modernas de seguridad y sandbox de los navegadores bloquean estas operaciones, causando que no se imprima nada y que el hilo principal de JavaScript de la pestaña se congele de forma permanente.',
      'Impresión Nativa 100% Confiable: Se restauró la llamada directa a `window.print()` en la ventana principal, la cual utiliza la hoja de estilos de impresión `@media print` ya configurada en `index.html` para aislar y dar formato óptimo al recibo térmico de forma impecable.',
      'Secuenciación de Eventos Sincronizados: Se corrigió el conflicto de carreras donde la auto-impresión y la apertura automática de WhatsApp ocurrían en paralelo bloqueando el navegador; ahora el envío automático de WhatsApp se ejecuta de forma secuencial y segura exactamente después de que el usuario interactúa y cierra el diálogo de impresión.'
    ]
  },
  {
    version: '1.1.82',
    date: '2026-07-02',
    description: 'Impresión en Iframe Aislado Sin Bloqueo de Pantalla',
    isCurrent: false,
    changes: [
      'Impresión en Canal Aislado (Iframe Silencioso): Se implementó la impresión mediante un iframe oculto en segundo plano para los recibos de venta y comprobantes de recaudo. Esto evita que el navegador principal o del celular se congele, asegurando que la interfaz de usuario siga siendo 100% interactiva en todo momento, incluso si la impresión es cancelada o tarda en responder.',
      'Optimización de Formato POS: Los recibos impresos ahora utilizan estilos específicos de impresora térmica monocromática para una mayor nitidez y ahorro de papel, sin alterar los colores del modo oscuro o claro del programa principal.'
    ]
  },
  {
    version: '1.1.81',
    date: '2026-07-02',
    description: 'Solución a Congelamientos y Edición de Bonos de Regalo',
    isCurrent: false,
    changes: [
      'Corrección Anti-Congelamiento Móvil: Se desactivó la función de Auto-Impresión específicamente para celulares y tablets, resolviendo el grave fallo nativo de los navegadores móviles donde abrir el diálogo de impresión congelaba por completo la aplicación (bloqueo total que forzaba reiniciar).',
      'Eliminación de Botón Redundante: Se removió el botón inferior de "Listo / Nueva Venta" a solicitud para evitar confusiones en los modales de factura.',
      'Soporte a Edición de Bonos de Regalo: Ahora es posible editar la fecha de una venta que contiene un bono de regalo, y la fecha de creación del bono asociado se actualizará correctamente de forma automática, sin fallar o deshacer la edición.'
    ]
  },
  {
    version: '1.1.80',
    date: '2026-06-30',
    description: 'Simplificación de Interfaz y Remoción de la Guía de Instalación Móvil',
    isCurrent: false,
    changes: [
      'Remoción de Opción de Instalación Móvil: Se eliminaron por completo las opciones y guías de "Instalar en Celular" tanto en el menú lateral principal como en el perfil de usuario del vendedor, respondiendo a la simplificación de uso directo sin navegador.'
    ]
  },
  {
    version: '1.1.79',
    date: '2026-06-29',
    description: 'Prevención de Bloqueos e Imposibilidad de Cierre de la Vista de Facturas en Vistas Previas',
    isCurrent: false,
    changes: [
      'Seguridad Anti-Congelamiento en Vista Previa: Se detecta automáticamente si el software se ejecuta dentro de un iframe (como el de AI Studio) para desactivar la auto-impresión y auto-envío que suspenden el hilo de ejecución principal de Google Chrome de forma permanente.',
      'Soporte Educativo para Impresión: En caso de clics manuales dentro de un iframe, se muestra un mensaje informativo interactivo sugiriendo abrir la aplicación en una pestaña nueva para poder realizar la impresión y envíos sin bloqueos del navegador.'
    ]
  },
  {
    version: '1.1.78',
    date: '2026-06-29',
    description: 'Optimización de Espacio en Modal de Procesamiento de Pago',
    isCurrent: false,
    changes: [
      'Espacio Compacto en Pago: Rediseño del modal de pagos a un formato de dos columnas bento ultra-ajustado y limpio, maximizando el espacio de pantalla disponible en dispositivos de ventas.',
      'Mejora de Inputs en Paralelo: Se colocaron los campos opcionales del cliente en una cuadrícula horizontal de dos columnas, reduciendo la altura ocupada a la mitad.',
      'Sustitución de Alertas por Alertas de Estado Inline: Se eliminaron por completo las llamadas a alert() nativo para validaciones (falta de vendedor, códigos incorrectos, etc.) por avisos integrados e interactivos.'
    ]
  },
  {
    version: '1.1.77',
    date: '2026-06-29',
    description: 'Resolución de Bloqueos de Recibos y Privacidad de Estadísticas',
    isCurrent: false,
    changes: [
      'Corrección de Flujo de Recibo (Imprimir/WhatsApp): Se reemplazó el uso de alert() nativo (causante de bloqueos en iframes) por un sistema de advertencias inline no-bloqueantes. Se añadió un botón principal y destacado de "Listo / Nueva Venta" para cerrar los recibos de forma rápida.',
      'Privacidad de Estadísticas para Vendedores: Se restringió la visualización de insignias de stock de recompra ("RECOMPRAR") y productos en tendencia ("TENDENCIA") exclusivamente para administradores en las tarjetas de producto.'
    ]
  },
  {
    version: '1.1.76',
    date: '2026-06-28',
    description: 'Inteligencia Administrativa y Badges de Negocio',
    isCurrent: false,
    changes: [
      'Ordenación Administrativa Segmentada (30 días): Se implementó la lógica de rendimiento con un selector interactivo para administradores (Inteligente, Tendencias, Recompra Urgente, Alfabético).',
      'Insignias Visuales Dinámicas: Las tarjetas de productos ahora muestran etiquetas en tiempo real de los últimos 30 días como "TENDENCIA (cantidad)" para el percentil superior de ventas, o "RECOMPRAR" para stock bajo en demanda.',
      'Asistente de Abastecimiento Inteligente: Panel de análisis en el modal de rendimiento que evalúa automáticamente la velocidad de venta mensual contra existencias y provee recomendaciones de reabastecimiento exactas.',
      'Optimización de Redes: Se eliminó el botón de compartir producto por WhatsApp de la tarjeta de producto conforme a las solicitudes.'
    ]
  },
  {
    version: '1.1.75',
    date: '2026-06-28',
    description: 'Descuento Global en el Punto de Venta (POS)',
    isCurrent: false,
    changes: [
      'Porcentaje Seleccionable: Se añadió un selector con porcentajes de bono preestablecidos (5%, 10%, 15%, 20%, 25%, 30%, 40%, 50%) para aplicar un descuento global a la compra.',
      'Porcentaje Personalizado: Permite ingresar cualquier valor de porcentaje manual seleccionando "Otro %" según lo requiera el cajero.',
      'Sincronización de Totales: El descuento recalcula automáticamente el subtotal, el monto total del descuento, el total general a pagar and el cambio de devolución en tiempo real.',
      'Visualización de Pago: El desglose se muestra detallado tanto en el resumen del carrito como en el modal de procesamiento de pago.'
    ]
  },
  {
    version: '1.1.74',
    date: '2026-06-22',
    description: 'Edición Ágil de Método de Pago en Cambios',
    isCurrent: false,
    changes: [
      'Sin Bloqueos por Selección de Prendas: Se removieron por completo las alertas que obligaban a ingresar prendas a devolver o prendas a llevar al momento de editar la novedad.',
      'Búsqueda Flexible sin Stock: Ahora puedes buscar y agregar prendas de cambio incluso si el inventario actual de dicho artículo es 0 (lo cual sucede si el cambio físico en tienda real ya se entregó al cliente).',
      'Celular Opcional: Se flexibilizó la validación del teléfono inteligente para que no bloquee la edición si el usuario prefiere dejar el dato del celular en blanco.'
    ]
  },
  {
    version: '1.1.73',
    date: '2026-06-22',
    description: 'Edición Sin Bloqueo de Novedades de Cambio',
    isCurrent: false,
    changes: [
      'Independencia de Facturas: Se modificó el motor de edición de novedades de cambio para que no dependa estrictamente de que la factura original esté cargada en la vista activa local. Esto te permite editar directamente el método de pago, el valor del excedente, el estado, la fecha o la descripción sin tener que realizar de nuevo toda la novedad ni volver a buscar e ingresar las prendas.',
      'Persistencia de Prendas: Los artículos que ya se ingresaron en el cambio (tanto los devueltos como los que el cliente lleva) permanecen 100% visibles y editables en el formulario, eliminando la molesta pérdida de datos o limpieza automática al abrir la edición.'
    ]
  },
  {
    version: '1.1.72',
    date: '2026-06-22',
    description: 'Visualización y Edición de Método de Pago en Novedades de Recaudo y Ajuste',
    isCurrent: false,
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
  { id: '1', name: 'Administrator', permissions: Object.values(View).filter(v => v !== View.DEVELOPER_CENTER) },
  { id: '2', name: 'Vendedor', permissions: [View.POS, View.LAYAWAY, View.INCIDENTS, View.CUSTOMERS, View.INVENTORY, View.PURCHASES] },
  { id: '3', name: 'Developer', permissions: Object.values(View) }
];

export const INITIAL_SELLERS: Seller[] = [
  { id: '1', name: 'admin', password: 'admin', roleId: '1', storeId: '1', isDisabled: false }
];

export const INITIAL_PRODUCTS: Product[] = [];
