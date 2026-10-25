# Producción 1.1.193: datos mensuales compactos del resumen

## Comportamiento conservado

El resumen mantiene sus controles, diseño, filtros, gráfico, categorías, unidades, medios de pago e historial visible. No se oculta el historial ni se añade un botón para obtenerlo. Como ya aparece abierto y permite editar apartados, el panel necesita los datos del período además de sus totales.

En lugar de suscribirse a todos los documentos originales de apartados y novedades, consulta documentos mensuales auxiliares con los campos que usa la pantalla. Se agrupan en ocho particiones por tipo y mes; cada documento almacena el contenido en un campo JSON, evitando indexar un mapa de productos y pagos por cada registro. Se conserva el cálculo existente de las cifras sobre esos datos compactos, además de los agregados de inventario y gráfico ya activos.

Los meses incluyen creación y todas las fechas de pago de cada apartado, incluso pagos de apartados antiguos, pagos con bono y pagos de apartados cancelados cuando el cálculo original los incluía. Los movimientos financieros se incluyen por su fecha. Un grupo separado conserva los pendientes antiguos que alimentan el menú y su aviso. Los meses disponibles del historial se conservan mediante metadatos pequeños. Los filtros habituales consultan los meses elegidos y Todo permite consultar el conjunto completo.

Editar y reimprimir un apartado obtiene primero su documento original, con verificación de empresa/sede. El editor recibe el original completo, conservando notas y campos ajenos al resumen. Las respuestas tardías después de desmontar la vista no abren un editor ni un recibo en otra sede. Las pestañas operativas de Apartados y Novedades mantienen sus consultas completas. Los conteos siguen fuera del inicio, como en 1.1.192.

Los importes principales muestran Cargando mientras faltan las fuentes del resumen. No se presenta esa espera como ingresos cero. Si el resumen no está verificado, no existe para una sede nueva o falla su lectura, se conserva la consulta original para mantener las cifras y funciones.

## Servidor

Dos procesadores aislados en factura2-6e811/us-central1: productionDashboardLayawaysChanged y productionDashboardIncidentsChanged. Build a45ff2f4b94ebb4c22b982c51a192659936c9616. Se ejecutan después de cambios en fuentes; las escrituras del usuario conservan su confirmación habitual. La proyección puede reflejar el cambio poco después del guardado.

Las transacciones son idempotentes por versión de fuente; actualizan todas las particiones afectadas, retiran entradas al cambiar fechas/estado/sede o borrar la fuente y controlan el tamaño del documento. Los errores transitorios se reintentan. Los errores de datos deterministas desactivan la proyección de la sede para conservar la ruta anterior y terminan sin reintentos indefinidos. Los límites protegen la integridad; un volumen que los supere requiere revisar la partición antes de activar la optimización.

Los documentos viven en businessSummaryCompanies/{empresa}/stores/{sede}/dashboardActivity. El estado privado usa claves dashboardActivity_* en businessSummaryState. Las reglas existentes protegen esas rutas: el cliente solo lee los resúmenes según su ámbito y no lee ni escribe el estado privado. No se cambiaron reglas, índices ni IAM. No se modificaron fuentes, stock, conciliaciones ni credenciales durante la construcción. Los procesadores sí añaden lecturas y escrituras de mantenimiento; la reducción neta de costo depende del uso real.

## Verificación

Construcción, cotejo íntegro y activación completados en ocho sedes sobre 1.639 fuentes. El cotejo comprueba versiones de fuente, estado, alcance, contenido de todas las particiones y meses disponibles; la activación usa precondición de versión del metadato y exige el build exacto del servidor.

Una comprobación independiente comparó las contribuciones originales y compactas a ingresos por método, cobros, utilidad, costo, unidades, efectivo, categorías, productos y facturas por cada mes disponible y un día representativo. Pasó en las ocho sedes, incluyendo 14 meses en las sedes 1 y 2 y 13 en la sede 3. La lectura autenticada del cliente pasó en todas las sedes y el estado privado fue rechazado. Para el mes actual y los pendientes de la sede 2 se observaron 17 documentos compactos frente a 572 fuentes originales; no es una medición de lecturas facturadas ni del tiempo del móvil.

Pruebas focalizadas: 23 aprobadas; ampliación final de interfaz y pendientes: 3 y 2 pruebas aprobadas, respectivamente. La comparación del árbol del panel completo verificó las mismas cifras, referencias de pagos, categorías, precios, historial y meses disponibles. Se comprobó lectura fresca para edición/reimpresión, ausencia de consultas históricas provisionales al ingresar, conservación de pendientes y recuperación de la ruta original ante un error. Las transacciones y el verificador paginado pasaron en el emulador con cambios de fecha, pagos antiguos, repetición, borrado y rechazo de empresa incorrecta. Compilaciones de producción y staging aprobadas; comprobación de producción repetida después del ajuste de los indicadores de carga.

Estas comprobaciones no equivalen a una revisión visual manual ni demuestran un tiempo específico en el dispositivo del usuario. La siguiente medición debe separar el ingreso del login y la carga del panel, con la misma sede y filtros.

## Recuperación

Referencia anterior del cliente: 3f343fb0626c0eeffafc3b05fb2a0f915a49f2f0 (1.1.192). Volver a publicarla o desactivar VITE_DASHBOARD_ACTIVITY_SUMMARY recupera las consultas originales sin restaurar datos ni afectar el login. Los documentos auxiliares pueden mantenerse. El mantenimiento del servidor seguiría generando operaciones hasta retirar explícitamente esos dos procesadores.
