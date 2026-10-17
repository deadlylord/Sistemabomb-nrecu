# Inicio y resumen por sede — 1.1.163

Proyecto autorizado: `vestika-staging`. Producción y `main` no se modifican.

## Estado de la entrega

El ingreso actualizado, las reglas, los tres índices y los cinco procesadores están desplegados en `vestika-staging`. Los índices están READY y las funciones ACTIVE. Se construyeron y verificaron transaccionalmente las dos sedes existentes: 12 fuentes en `staging_store_01` y 6 en `staging_store_02`, sin modificar sus registros originales. La versión 1.1.163 habilita `VITE_BUSINESS_SUMMARIES=true` solo en staging. La conexión administrativa se restableció con la misma cuenta autorizada.

## Inicio

- El formulario descarga React, sus iconos y su versión. Firebase y el controlador operativo se importan al enviar las credenciales. El controlador solo se monta tras verificar la identidad; su descarga transcurre en paralelo con el ingreso.
- Se conserva la validación de claims, la revocación de sesiones y el aislamiento por empresa/sede. El historial de ingreso se registra sin bloquear la apertura.
- El cambio preparado en el servidor reutiliza los documentos de sede/rol/empresa que ya validó y consulta en paralelo los metadatos independientes. Elimina tres lecturas repetidas, manteniendo scrypt, índices privados y límites de intentos. Desplegado en `vestikaStagingLogin`, revisión `vestikastaginglogin-00004-duj`.
- Comparación del grafo JavaScript necesario para mostrar el formulario: staging 1.1.161, 1.407.519 bytes sin comprimir / 351.926 gzip; candidato, 224.461 / 70.302 gzip. Aproximadamente 80 % menos comprimido. Es una medición de bytes, no de segundos de autenticación, ni una garantía para cada dispositivo/red.

## Resumen preparado

- Acumulados por empresa y sede: días para el período y comparación, meses para el gráfico anual e inventario valorizado. La comparación entre sedes se consulta al abrirla.
- Las unidades pertenecen a la creación; los ingresos a la fecha de cada pago, incluidos abonos recibidos después de crear el apartado. Días completos de Colombia. No se suma dos veces una venta que completa un apartado. Bonos y recaudos conservan el tratamiento del resumen actual.
- Un índice compacto de facturas pagadas en varios días corrige la suma diaria para conservar el número de ventas distintas al consultar varios días.
- Los procesadores leen la fuente actual dentro de una transacción y deduplican por versión; admiten ediciones, borrado, restauración y eventos desordenados. Las fuentes inválidas desactivan la confianza del resumen y registran un diagnóstico privado.
- Cinco funciones, una por colección (`sales`, `layaways`, `incidents`, `expenses`, `inventory`), con mínimo predeterminado cero, máximo dos instancias y concurrencia cuatro por función. Reintentos activados. Las transacciones y lecturas/escrituras adicionales tienen consumo; el costo mensual real no se ha medido. Las mediciones sintéticas de la nube se detallan abajo.
- El inicio del administrador deja de consultar inventarios e historiales completos. Solo mantiene alertas pendientes y encargos por traer de la sede activa. El detalle actual se conserva en “Historial y herramientas”. Allí sí se consultan históricos completos de esa sede; no se afirma que todos los módulos estén paginados. Búsqueda global, compras e informes pueden solicitar inventarios de otras sedes autorizadas.
- La división está en rutas y reglas; clientes no pueden escribir acumulados, estados ni diagnósticos. Un resumen no verificado no se muestra como cero.

## Verificación real y límites

- 16 comprobaciones reales aprobadas con una empresa aislada, dos sedes, un administrador y una vendedora temporal. Se procesaron 28 fuentes de las cinco colecciones; se verificaron acumulados y las consultas reales por período e índice de facturas repetidas. Edición de fecha/pago, borrado y restauración convergieron sin duplicaciones.
- Se comprobó que la vendedora solo consulta su sede; el administrador accede a sus dos sedes; otra empresa, estados privados y escrituras de acumulados están bloqueados. Se eliminaron los 28 registros temporales, los dos usuarios de Authentication y las rutas conocidas de los resultados de prueba.
- Medición sintética desde este entorno: escritura del lote de fuentes 4.466 ms; observación del acumulado completo después de la escritura 10.468 ms; lectura del resumen 286 ms y de dos resúmenes diarios 269 ms. Una edición se observó en 2.410 ms, el borrado en 1.477 ms y la restauración en 1.461 ms. Los acumulados son asíncronos: un guardado puede preceder unos segundos a su actualización.
- Ingreso más intercambio de token: primer acceso tras el despliegue 6.906 ms, siguiente 836 ms. El arranque en frío sigue siendo un factor, por lo que no se promete un tiempo exacto por dispositivo ni se presenta la reducción de bytes como reducción equivalente de segundos. Las funciones conservan mínimo cero; no se fijó una instancia de pago siempre encendida.
- `verifyStagingBusinessSummary` usa REST con token en memoria. Contrasta versiones, conteos, inventario, todos los días/meses y el índice de facturas repetidas en una transacción, y valida el propietario y las reglas antes de habilitar `ready`. El límite de esta herramienta de staging es 5.000 fuentes totales por sede: historiales mayores necesitan una migración paginada y una ventana de mantenimiento. Las nuevas sedes requieren verificar su resumen antes de activarlo.
- Se mantuvo el procesador financiero anterior y no se desplegó ninguna función ni regla de producción. Producción requiere su propia revisión y migración antes de habilitar esta arquitectura.

## Verificación local

- 25/25 pruebas focalizadas de ingreso, carga del administrador, contribuciones, aislamiento y proyección financiera. Simulación de 50.000 ventas en los acumulados.
- Reglas e integración en el emulador estándar: permisos de resúmenes, transacciones concurrentes reales, deduplicación y comparación del verificador con datos del emulador.
- Compilación con identidad y resúmenes habilitados aprobada.
- Suite completa: 136/138 aprobadas; persisten dos comprobaciones anteriores con textos desactualizados de navegación/recuperación. Se corrigió el simulador de Firestore (`docChanges`) y de estilos usado por esas pruebas, sin cambiar la lógica de producción para hacerlas pasar.
- Typecheck conserva tres errores previos en `AppErrorBoundary` (`setState`/`props`); no agrega errores en los componentes nuevos. `git diff --check` sin errores.

## Corrección 1.1.165

El resumen reducido fue retirado del flujo. Se restaura DashboardView completo con sus funciones y cálculos originales. `VITE_STORE_SCOPED_LOADING=true` conserva en staging las consultas de la sede activa; los informes multisede cargan al abrirse. Se conserva el ingreso diferido. Las fuentes detalladas de la sede sí se leen para sostener el historial completo, medios de pago, diferencias, categorías y top de productos; no se afirma una reducción de esas lecturas a acumulados. Los acumulados desplegados no sustituyen la vista original.
