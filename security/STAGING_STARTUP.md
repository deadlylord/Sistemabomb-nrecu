# Inicio y resumen por sede — 1.1.162

Proyecto autorizado: `vestika-staging`. Producción y `main` no se modifican.

## Estado de la entrega

El formulario ligero funciona con el servicio de identidad 1.1.160 ya desplegado. Los nuevos resúmenes están preparados bajo `VITE_BUSINESS_SUMMARIES=false` en staging: la activación requiere desplegar reglas, índices y cinco procesadores, construir y verificar las sedes, y cambiar entonces esa bandera. La sesión administrativa de Firebase no estaba disponible al preparar esta entrega. No se han desplegado los nuevos servicios ni se han reconstruido datos reales.

## Inicio

- El formulario descarga React, sus iconos y su versión. Firebase y el controlador operativo se importan al enviar las credenciales. El controlador solo se monta tras verificar la identidad; su descarga transcurre en paralelo con el ingreso.
- Se conserva la validación de claims, la revocación de sesiones y el aislamiento por empresa/sede. El historial de ingreso se registra sin bloquear la apertura.
- El cambio preparado en el servidor reutiliza los documentos de sede/rol/empresa que ya validó y consulta en paralelo los metadatos independientes. Elimina tres lecturas repetidas, manteniendo scrypt, índices privados y límites de intentos. Requiere desplegar solo `vestikaStagingLogin` para estar activo.
- Comparación del grafo JavaScript necesario para mostrar el formulario: staging 1.1.161, 1.407.519 bytes sin comprimir / 351.926 gzip; candidato, 224.461 / 70.302 gzip. Aproximadamente 80 % menos comprimido. Es una medición de bytes, no de segundos de autenticación, ni una garantía para cada dispositivo/red.

## Resumen preparado

- Acumulados por empresa y sede: días para el período y comparación, meses para el gráfico anual e inventario valorizado. La comparación entre sedes se consulta al abrirla.
- Las unidades pertenecen a la creación; los ingresos a la fecha de cada pago, incluidos abonos recibidos después de crear el apartado. Días completos de Colombia. No se suma dos veces una venta que completa un apartado. Bonos y recaudos conservan el tratamiento del resumen actual.
- Un índice compacto de facturas pagadas en varios días corrige la suma diaria para conservar el número de ventas distintas al consultar varios días.
- Los procesadores leen la fuente actual dentro de una transacción y deduplican por versión; admiten ediciones, borrado, restauración y eventos desordenados. Las fuentes inválidas desactivan la confianza del resumen y registran un diagnóstico privado.
- Cinco funciones, una por colección (`sales`, `layaways`, `incidents`, `expenses`, `inventory`), con mínimo predeterminado cero, máximo dos instancias y concurrencia cuatro por función. Reintentos activados. Las transacciones y lecturas/escrituras adicionales tienen consumo; todavía no se ha medido el costo real ni el rendimiento de estos procesadores en la nube.
- El inicio del administrador deja de consultar inventarios e historiales completos. Solo mantiene alertas pendientes y encargos por traer de la sede activa. El detalle actual se conserva en “Historial y herramientas”. Allí sí se consultan históricos completos de esa sede; no se afirma que todos los módulos estén paginados. Búsqueda global, compras e informes pueden solicitar inventarios de otras sedes autorizadas.
- La división está en rutas y reglas; clientes no pueden escribir acumulados, estados ni diagnósticos. Un resumen no verificado no se muestra como cero.

## Activación pendiente

1. Volver a autenticar la cuenta administrativa de Firebase y confirmar el proyecto `vestika-staging`.
2. Desplegar las reglas revisadas y crear únicamente los índices nuevos necesarios, conservando los que ya existan. Verificar que estén listos.
3. Desplegar únicamente `vestikaStagingLogin` y las cinco funciones `business*Changed`, sin tocar las funciones de producción ni cambiar el procesador financiero existente.
4. Ejecutar `verifyStagingBusinessSummary` por sede con `backfill:true, activate:true`, tras validar propietario y reglas. La herramienta usa REST con token en memoria, verifica versiones, conteos, inventario, días, meses e índice de facturas repetidas en una transacción. Su límite deliberado es 5.000 fuentes totales por sede; un histórico mayor necesita un proceso paginado y una ventana de migración. Una sede nueva también necesita este paso de verificación.
5. Pruebas reales de ingreso, ventas/abonos, edición/borrado, atraso del procesador y acceso cruzado entre empresas/sedes, usando datos aislados; limpiar los datos de prueba.
6. Habilitar `VITE_BUSINESS_SUMMARIES=true` solo en staging y comprobar móvil/PC. Producción requiere su propia migración y revisión posterior.

## Verificación local

- 25/25 pruebas focalizadas de ingreso, carga del administrador, contribuciones, aislamiento y proyección financiera. Simulación de 50.000 ventas en los acumulados.
- Reglas e integración en el emulador estándar: permisos de resúmenes, transacciones concurrentes reales, deduplicación y comparación del verificador con datos del emulador.
- Compilación con identidad y resúmenes habilitados aprobada.
- Suite completa: 136/138 aprobadas; persisten dos comprobaciones anteriores con textos desactualizados de navegación/recuperación. Se corrigió el simulador de Firestore (`docChanges`) y de estilos usado por esas pruebas, sin cambiar la lógica de producción para hacerlas pasar.
- Typecheck conserva tres errores previos en `AppErrorBoundary` (`setState`/`props`); no agrega errores en los componentes nuevos. `git diff --check` sin errores.
