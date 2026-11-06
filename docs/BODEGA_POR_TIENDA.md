# Bodega por tienda — implementación candidata

Estado: backend desplegado y verificado en vestika-staging; interfaz 1.1.206 habilitada exclusivamente en el contexto staging. No habilitar en producción.

## Modelo

- `inventory/{productId}.stock` continúa representando el stock del local. Compras, ventas y conteo actual no cambian sus cantidades. `warehouseUnits` es un espejo administrado solo por servidor para proteger el vínculo y valorar local + bodega con los documentos existentes, sin nuevas consultas.
- Una bodega lógica por empresa/tienda bajo `warehouseCompanies/{companyId}/stores/{storeId}`.
- `products/{productId}` mantiene cantidades de bodega enlazadas por ID exacto al producto del local, nunca por nombre/marca/SKU.
- `categories/{categoryId}` mantiene stock y revisión en la misma transacción de movimientos/ajustes. Inicialmente no hay mercancía; se envía desde el stock normal. No se duplica stock inicial.
- `movements`, `counts`, `drafts` y `receipts` están separados del conteo de tienda. Los registros de movimientos contienen actor verificado, fecha/hora servidor, ambas cantidades antes/después, dirección y nota.
- El conteo general guarda diferencias sin ajustar referencias. El ajuste detallado requiere administrador, productos identificados y total consistente. Reversiones crean otro movimiento vinculado; el original solo recibe la referencia de reversión. No hay borrar/editar movimientos.

## Acceso y seguridad

Todo acceso usa `vestikaStagingWarehouse` (callable con autenticación verificada y autorización de servidor, región us-central1, máximo tres instancias). La función rechaza cualquier proyecto distinto de vestika-staging.

Se reutiliza verifiedActor: identidad firmada, versión de acceso, perfil, rol, empresa y sede activos. Un vendedor solo opera su propia tienda; un administrador de empresa puede escoger otras tiendas de la misma empresa. No existe excepción para Developer que permita cruzar empresas. Se exige acceso POS/inventario. Ajustes y reversiones solo administrador. Actor/empresa/stock no se aceptan como autoridad del navegador.

Las reglas de staging actuales terminan en deny-all para rutas no declaradas. No se agregan permisos directos para warehouseCompanies; las lecturas y escrituras son solo del servidor. **Antes de activar, comprobar en emulador y en el proyecto real que estas rutas continúan denegadas al cliente y no existe otro match permisivo.** Se añaden validadores en las reglas de staging: el cliente no puede crear/alterar el espejo ni borrar o reclasificar referencias con unidades en bodega. No hay nuevas lecturas en reglas. Se validaron contra el emulador; aún no se desplegaron.

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

## Despliegue de pruebas 2026-11-06

- Cuenta Firebase reconectada por OAuth. Publicadas vestikaStagingWarehouse (us-central1), businessInventoryChanged (southamerica-east1) y reglas de staging. Se comprobó que las reglas anteriores eran exactamente la base de esta rama antes de actualizarlas.
- El POS no inicializa App Check; el callable usa enforceAppCheck=false, igual que las APIs de identidad existentes de staging. Conserva verificación obligatoria de identidad, rol vigente, empresa y sede y rechazo a otros proyectos. No se añadieron servicios reCAPTCHA ni se relaja la autenticación Firebase.
- Prueba sobre Firestore real con empresa/sede/usuario/producto temporales: dos envíos idénticos aplicados una vez, ida/vuelta, resumen, consulta de categoría, conteo e historial y valor consolidado de 10 unidades conservado en el trigger desplegado. Datos temporales eliminados al finalizar. Esta prueba usa el servicio interno con SDK administrativo, no equivale a una sesión visual del vendedor.
- La CLI informó funciones actualizadas correctamente, pero terminó con código 1 por no existir política de limpieza de imágenes de Artifact Registry en us-central1. No se forzó ninguna eliminación. El servicio se verificó por separado.
- Frontend habilitado solo con VITE_STORE_WAREHOUSE=true en context.staging de Netlify. Producción no recibe esa bandera.

## Referencia de activación y límites

1. Dependencias de functions instaladas con lockfile. Falta completar autenticación Firebase iniciada con login --no-localhost; después desplegar únicamente `vestikaStagingWarehouse` y actualizar `businessInventoryChanged` en **vestika-staging**, para que el resumen mantenga la valoración local + bodega. Desplegar únicamente las reglas de staging verificadas. No desplegar todos los servicios ni producción.
2. Validar App Check/identidad, reglas privadas de las rutas, consultas paginadas e índices efectivos. Ejecutar transacciones concurrentes contra emulador o staging con datos sintéticos.
3. Comprobar en la sesión real de vendedor y administrador: movimiento en ambos sentidos, conteo general, ojos/borrador/ajuste, reversiones, cambio de tienda/empresa y errores/reintentos.
4. Implementado y verificado en emulador: no borrar/cambiar categoría mientras warehouseUnits > 0; al vaciar bodega se permite reclasificar o borrar. Nombre, precio, costo y stock local siguen editables. Los detalles muestran el nombre/marca actual del catálogo cuando está cargado.
5. Implementada valoración local + bodega en Dashboard, gráfico de valor de inventario, Contador Inteligente y proyección businessSummary; POS/conteo físico/categorías siguen usando solo stock local. Campo opcional ausente equivale a cero: no se migra inventario antiguo. La prueba de valoración asegura que mover 4 de 10 unidades no altera el valor consolidado y que editar costo valora ambas ubicaciones. Falta confirmar el trigger efectivo actualizado en staging al desplegar.
6. Solo después, configurar **VITE_STORE_WAREHOUSE=true** en el contexto staging y recompilar. Además requiere VITE_APP_ENV=staging y el proyecto vestika-staging. No existe habilitación por defecto ni cambio de Netlify en esta propuesta.

## Validación ejecutada

- 15 pruebas focalizadas aprobadas de servicio y React. Servicio probado con un adaptador transaccional en memoria serializado, no con Firebase real: no certifica reintentos del SDK, IAM, índices o reglas desplegadas.
- Incluye pertenencia de empresa/sede, acceso revocado, cantidades inválidas, operaciones repetidas, dos movimientos compitiendo por stock, retorno, reversión, conteo con revisión obsoleta, borradores, ajuste explícito admin, paginación, cargas al tocar el ojo y reintento de UI con el mismo ID.
- Suite completa: 329 pruebas, 328 pasan y queda únicamente el fallo previo de empaquetado React en sharedRecordAccess; instalar dependencias de Functions resolvió el otro fallo de entorno. Typecheck conserva únicamente los tres errores previos de AppErrorBoundary. Build aprobado y diff limpio.
- Emulador real: 21 pruebas aprobadas de identidad, resúmenes y bodega, incluidas transacciones SDK concurrentes, consulta paginada, validación de reglas privadas y conservación de ediciones de productos. No se escribieron datos reales. El intento visual con Chromium volvió a fallar por restricciones del proceso; queda pendiente la revisión visual. Firebase CLI está instalado; autenticación iniciada y pendiente del código de Carlos. No se desplegó el callable ni se activó la bandera. Staging y main publicados permanecen sin cambios.
