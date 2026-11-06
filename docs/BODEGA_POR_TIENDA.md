# Bodega por tienda — implementación candidata

Estado: rama de trabajo derivada de staging. Desactivada por defecto. No habilitar en producción.

## Modelo

- `inventory/{productId}.stock` continúa representando el stock del local. Compras, ventas y conteo actual no cambian de código.
- Una bodega lógica por empresa/tienda bajo `warehouseCompanies/{companyId}/stores/{storeId}`.
- `products/{productId}` mantiene cantidades de bodega enlazadas por ID exacto al producto del local, nunca por nombre/marca/SKU.
- `categories/{categoryId}` mantiene stock y revisión en la misma transacción de movimientos/ajustes. Inicialmente no hay mercancía; se envía desde el stock normal. No se duplica stock inicial.
- `movements`, `counts`, `drafts` y `receipts` están separados del conteo de tienda. Los registros de movimientos contienen actor verificado, fecha/hora servidor, ambas cantidades antes/después, dirección y nota.
- El conteo general guarda diferencias sin ajustar referencias. El ajuste detallado requiere administrador, productos identificados y total consistente. Reversiones crean otro movimiento vinculado; el original solo recibe la referencia de reversión. No hay borrar/editar movimientos.

## Acceso y seguridad

Todo acceso usa `vestikaStagingWarehouse` (callable con App Check, región us-central1, máximo tres instancias). La función rechaza cualquier proyecto distinto de vestika-staging.

Se reutiliza verifiedActor: identidad firmada, versión de acceso, perfil, rol, empresa y sede activos. Un vendedor solo opera su propia tienda; un administrador de empresa puede escoger otras tiendas de la misma empresa. No existe excepción para Developer que permita cruzar empresas. Se exige acceso POS/inventario. Ajustes y reversiones solo administrador. Actor/empresa/stock no se aceptan como autoridad del navegador.

Las reglas de staging actuales terminan en deny-all para rutas no declaradas. No se agregan permisos directos para warehouseCompanies; las lecturas y escrituras son solo del servidor. **Antes de activar, comprobar en emulador y en el proyecto real que estas rutas continúan denegadas al cliente y no existe otro match permisivo.** No se modificaron ni desplegaron reglas.

## Lecturas

- El botón se añade al POS, donde los productos locales ya están cargados. El modal es lazy y no se descarga al iniciar sesión.
- Abrir bodega: consulta resúmenes de categorías y validaciones de identidad; no descarga referencias ni historial.
- Ojo: productos de una categoría con límite 50/página, más el borrador de ese usuario/categoría. Query por categoría con orden implícito por ID: verificar índice automático efectivo en staging; nunca hacer fallback a leer todas las bodegas.
- Historial y conteos: 50 registros por página, ID con timestamp invertido para ordenar sin índice compuesto adicional. El historial paginado conserva todos los registros guardados; no hay listener permanente.
- Movimiento: lecturas puntuales de identidad, recibo, producto local, producto bodega y categoría. La transacción escribe stock local, stock bodega, resumen, movimiento, historial local y recibo juntos. Conflictos SDK pueden repetir lecturas.
- Conteo: solo resúmenes incluidos y referencias contadas explícitamente en el ojo. Una revisión cambiada bloquea guardar y obliga a actualizar/revisar cantidades.
- No se prometen cero lecturas al abrir/operar. Con la bandera desactivada no se ejecuta ninguna llamada de bodega.

## Reintentos

Cada formulario conserva operationId y payload en sessionStorage por usuario, empresa y tienda. Reabrir el modal o recargar la misma sesión permite resolver la operación pendiente sin crear otra. El servidor deduplica con recibo y huella incluyendo actor/empresa/tienda. Dos clics/reintentos no duplican movimiento ni historial. Un rechazo definitivo permite corregir formulario; un error de transporte conserva el ID y exige reintentar el mismo payload.

Si sessionStorage está bloqueado o contiene un registro inválido, se impide guardar hasta resolver la recuperación. No se guardan clientes ni contraseñas. Cerrar definitivamente la sesión del navegador elimina sessionStorage: no se promete recuperar después de su eliminación.

## Activación pendiente

1. Instalar dependencias de functions con su lockfile y desplegar únicamente `vestikaStagingWarehouse` al proyecto **vestika-staging**, con cuenta autorizada. No desplegar todos los servicios ni producción.
2. Validar App Check/identidad, reglas privadas de las rutas, consultas paginadas e índices efectivos. Ejecutar transacciones concurrentes contra emulador o staging con datos sintéticos.
3. Comprobar en la sesión real de vendedor y administrador: movimiento en ambos sentidos, conteo general, ojos/borrador/ajuste, reversiones, cambio de tienda/empresa y errores/reintentos.
4. Validar edición/cambio de categoría, baja/reactivación de referencias con unidades en bodega: por ahora el servicio bloquea inconsistencias, pero no hay asistente para resolver un producto local eliminado o cambiado de categoría.
5. Revisar interpretación de valor de inventario: los informes actuales calculan con stock local; deben distinguirlo de la valoración consolidada local+bodega antes de considerar completada la integración financiera.
6. Solo después, configurar **VITE_STORE_WAREHOUSE=true** en el contexto staging y recompilar. Además requiere VITE_APP_ENV=staging y el proyecto vestika-staging. No existe habilitación por defecto ni cambio de Netlify en esta propuesta.

## Validación ejecutada

- 12 pruebas nuevas aprobadas de servicio y React. Servicio probado con un adaptador transaccional en memoria serializado, no con Firebase real: no certifica reintentos del SDK, IAM, índices o reglas desplegadas.
- Incluye pertenencia de empresa/sede, acceso revocado, cantidades inválidas, operaciones repetidas, dos movimientos compitiendo por stock, retorno, reversión, conteo con revisión obsoleta, borradores, ajuste explícito admin, paginación, cargas al tocar el ojo y reintento de UI con el mismo ID.
- Suite completa: 326 pruebas, 324 pasan y solo dos fallos conocidos de baseline (dependencia Functions ausente y empaquetado React en sharedRecordAccess). Typecheck conserva únicamente los tres errores previos de AppErrorBoundary. Build aprobado y diff limpio.
- No hubo revisión visual en navegador ni escrituras sobre datos reales. No hay sesión Firebase CLI configurada en este entorno; no se desplegó el callable ni se activó la bandera. Staging y main publicados permanecen sin cambios.
