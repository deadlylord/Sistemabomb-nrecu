# Producción 1.1.190: resúmenes con la pantalla original

## Comportamiento

Conserva la pantalla principal, sus controles y el gráfico original. Las ventas se consultan por los meses solicitados; un índice de pagos recupera también ventas antiguas con actividad en esos meses y fechas heredadas que no coinciden con la consulta por creación. Los filtros históricos y Todo siguen disponibles. El gráfico usa resúmenes mensuales verificados y el valor del inventario usa el agregado de costo por existencias. La edición obtiene los productos necesarios mediante la ruta ya probada en staging.

Mientras llega la confirmación del resumen no se abre una descarga provisional de todo el historial de ventas. Un resumen ausente, inválido o con error conserva la consulta anterior. No se activa la pantalla alternativa BusinessOverview (`VITE_DASHBOARD_SUMMARY=false`). Apartados, incidencias y otras fuentes operativas que aún consume la pantalla conservan su carga existente; esta entrega no elimina todas las lecturas del inicio.

Los procesadores agregan escrituras y trabajo de servidor después de cada cambio. El resumen puede actualizarse poco después del guardado. La reducción neta de costo y los tiempos reales requieren mediciones comparables en producción; no se deducen de la compilación ni del número de documentos derivados.

## Backend y compatibilidad

Proyecto factura2-6e811, Firestore Standard nam5. Cinco procesadores aislados en us-central1, reintento e idempotencia por versión de fuente y proyección. Construcción paginada con lotes máximos de 50 fuentes y división adicional ante límites de escritura. Sin cambios a documentos de ventas, apartados, incidencias, gastos o productos durante la construcción.

Las ocho plantillas de gasto con fecha TEMPLATE se excluyen de totales fechados conservando el documento original. Las fechas heredadas reproducen el calendario Colombia de la pantalla existente. La comprobación independiente del gráfico no reutiliza la función de proyección.

Reglas compatibles de negocio: d6081a97-fa0e-44ee-9ffc-7559b2d281c4. Los agregados son de escritura exclusiva del servidor; inventario y categorías públicos se conservan para la tienda web. Las reglas operativas heredadas no se presentan como una migración completa de seguridad por empresa. Índices aditivos de ventas por sede/creación y repeticiones por fechas, sin eliminar índices existentes.

Build de procesadores requerido: dc0a8e9fb7379e117161dc6e1d5167c8e20f8211. Cada sede necesita verificación completa y activación con precondición de versión antes de usar su índice de pagos.

## Login pendiente

`VITE_VERIFIED_IDENTITY=false`: continúan el acceso y las cuentas actuales. No se ejecutó la migración de perfiles, contraseñas o permisos. Los servicios y el plan de migración están preparados, con respaldo cifrado verificado; no se activan por publicar este cliente.

La revisión automática rechazó la concesión IAM de firma de tokens por falta de autorización explícita. IAM Credentials API ya está habilitada. El único cambio propuesto pendiente es roles/iam.serviceAccountTokenCreator para 1038601908493-compute@developer.gserviceaccount.com sobre esa misma cuenta. El script preparado no habilita APIs y no debe ejecutarse antes de obtener esa autorización. Después aún se requieren migración controlada, pruebas reales y otra publicación para activar el login.

## Validación y recuperación

Construcción de 12.611 fuentes en las ocho sedes completada. Las ocho pasaron la verificación íntegra de versiones y agregados y la comparación independiente del valor del inventario y de todos los meses del gráfico. No se modificaron fuentes durante la construcción. La comprobación anterior a publicar aprobó 26 pruebas focalizadas; compilaciones de producción y staging aprobadas después de corregir la espera inicial de metadatos.

Las ocho sedes quedaron activadas mediante comprobación de despliegue y precondición de versión. Prueba REST con identidad anónima temporal del cliente: lectura permitida de las ocho raíces y sus meses/índices de pagos; cuenta temporal eliminada al finalizar. Lecturas públicas de inventario y categorías permitidas sin autenticación. Estas pruebas no equivalen a una revisión visual ni a una medición de velocidad desde el móvil del usuario.

Suite general previa: 240 de 241 pruebas aprobadas; fallo conocido de carga dinámica de React en sharedRecordAccess. Tres errores TypeScript previos de AppErrorBoundary. Pruebas adicionales con emulador verificaron transacciones, idempotencia, cambios y borrados, límites de lotes y reglas. La última corrección de espera de metadatos cuenta con pruebas de ausencia de consulta histórica provisional y de consulta mensual posterior.

Cliente anterior: d1361d47a5337308f2c0ee10b88077c032cc7561 (1.1.189). Volver a publicar ese cliente desactiva estos consumidores de resúmenes sin restaurar registros antiguos sobre operaciones nuevas. Los procesadores y documentos derivados pueden mantenerse durante la recuperación; no es necesario borrar ventas ni productos. El login no cambia en esta entrega.
