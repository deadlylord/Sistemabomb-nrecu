# Vestika POS — Estado operativo y decisiones

**Actualizado:** 2026-10-26. Este documento distingue hechos verificados del repositorio y reportes históricos de Carlos. **No constituye una auditoría de producción ni certifica que un error siga abierto.**

## Corrección 2026-10-30 — traslados únicos y stock transaccional, versión 1.1.199

- Carlos autorizó corregir y subir el mismo cambio a staging y main. Rollback de código previo: `7bc826a727b6b142d06e23d9fda9b414b26479e8` (1.1.198). Deploy y versión servida pendientes de verificación; no se declara una suite general/typecheck completamente aprobada.
- Causa reproducida: la comprobación de existencias estaba separada del lote que descontaba/sumaba stock. Una venta concurrente o dos traslados podían dejar origen -1 y destino con una unidad ficticia. La aprobación de solicitudes también usaba el estado de pantalla y un lote, sin comprobar transaccionalmente si ya se había procesado.
- `applyInventoryTransfer` comparte la operación de traslado directo y solicitado: lee recibo, origen y destino dentro de la transacción; comprueba stock, cantidades enteras, permisos, companyId y las dos sedes. Escribe ambos stocks, un traslado y sus dos historiales juntos. La consulta por nombre/storeId para resolver el producto destino se limita a dos resultados; el documento elegido se vuelve a leer y validar dentro de la transacción. Dos coincidencias provocan un error explícito en vez de escoger una arbitraria. No se descargan inventarios completos para esta resolución.
- Traslado directo: ID estable `transfer_{UUID}`, bloqueo inmediato de envíos y recuperación de ID pendiente por usuario/empresa/ruta en memoria/sessionStorage. Un recibo confirmado se reutiliza sin tocar stock aunque la unidad recibida ya se haya vendido. Si los datos difieren, se informa y no se vuelve a mover mercancía. `InventoryTransferView` espera confirmación, deshabilita el formulario mientras guarda y conserva producto/cantidad/ID al fallar.
- Solicitudes: estado guardado de la novedad y recibo `request_{incidentId}` en la misma transacción del traslado. La sede creadora debe ser la activa y origen/destino pertenecer a la empresa autorizada. Dos administradores concurrentes no pueden procesar dos veces una misma solicitud. Se preserva su historial de aprobación.
- Nuevos registros incluyen producto destino y usuario procesador; los historiales nuevos enlazan el ID del traslado. No se modifican documentos antiguos. El mantenimiento de anulación/borrado de traslados conserva su implementación anterior; esta corrección protege creación/aprobación, no rediseña su ciclo de anulación.
- Pruebas: 15 en `transferIdempotency.test.mjs`, 1 en `transferSave.test.mjs`. Cubren doble envío, mismo ID en dos clientes, última unidad vendida concurrentemente, dos traslados independientes, venta simultánea en destino, confirmación perdida, error/reintento, productos ambiguos, tenant/sede/permisos/cambio de contexto, aprobación simultánea, validación de datos guardados, historial vinculado y el resultado cero/cero tras traslado más venta y reintento. Son simulaciones optimistas y pruebas React, no ejecución en Firebase real.
- Verificación con `TZ=America/Bogota`: **285/287 aprobadas**; las 16 nuevas pasan. Suite focalizada de traslados/cambios/aislamiento: **51/51**. Build y `git diff --check` aprobados. Persisten los dos fallos de baseline y los tres errores TypeScript previos de AppErrorBoundary, documentados en versiones anteriores; no se ocultaron ni se amplió el cambio para corregirlos.
- No cambian reglas, índices, configuración Firebase/Netlify, servicios, ventas ni facturas. No se ajustan existencias anteriores. Las lecturas adicionales son por acción explícita de traslado y reintentos por conflicto, sin nuevos listeners ni trabajo de arranque. Las reglas reales desplegadas y la UI móvil no fueron verificadas desde este entorno.
- Pendiente en staging: comprobar doble aprobación desde dos sesiones, error/reintento y venta concurrente de la última unidad con productos sintéticos. En cada equipo debe cargarse 1.1.199 para usar el flujo nuevo; no se fuerza recarga con carritos abiertos. El caso histórico de Metro/Porvenir sigue sin auditoría de registros reales ni corrección automática.

## Corrección local 2026-10-30 — ventas sin doble envío, versión 1.1.198

- Carlos autorizó promover 1.1.198 a producción el 2026-10-30. Rollback de código: main previo 201443d572b51156125900de96ab5a4bf8b451b9 (1.1.197). Publicación y versión servida pendientes de verificación; no se afirma que las pruebas generales/typecheck estén totalmente aprobados. Aplica al flujo común de todas las empresas/sedes, conservando su aislamiento; no es un parche por tienda.
- Causa reproducida: el pago y los wrappers de POS no esperaban la promesa de guardado; el controlador podía recibir dos llamadas concurrentes y crear dos IDs aleatorios de venta. Una transacción por sí sola no identifica dos envíos de una misma operación. No se habían eliminado esas protecciones en 1.1.196/197: el código de venta era idéntico al main previo.
- `PaymentModal`, `CartPanel` y los wrappers móvil/escritorio de `PosView` esperan la confirmación. El pago bloquea doble pulsación, edición y cierre mientras guarda; conserva datos al fallar. `SellVoucherModal` conserva código/ID del bono al reintentar y bloquea envíos repetidos.
- `App` mantiene un bloqueo inmediato por usuario/empresa/sede y usa `saleCheckout.ts` para recuperar un ID pendiente en memoria/sessionStorage, sin guardar clientes, contraseñas o carrito. La factura se escribe en `sales/checkout_{UUID}` y se comprueba primero dentro de la transacción. Si ya existe con la misma identidad y huella de solicitud, se recupera sin volver a aplicar pagos, bonos, inventario, historial o consecutivo. Si los datos difieren, informa la factura anterior y no escribe otra. Una recepción confirmada libera el ID pendiente; la misma pantalla conserva su propio ID hasta abrir una operación nueva.
- La huella SHA-256 usa datos comerciales, pagos sin sus timestamps variables y el día de Bogotá. Las ventas nuevas incluyen `checkoutFingerprint`/`checkoutUserId` opcionales; las históricas siguen siendo compatibles. Se conserva la validación de carrito y tenant writer existentes. Los cambios de contexto siguen evitando recibos o limpieza de carrito en otra sede.
- Ventas legítimas con el mismo contenido e IDs distintos siguen permitidas. No se deduplica por cliente/importe/productos ni se pretende detectar dos ventas manuales diferentes. Dos clientes solo comparten idempotencia si comparten el ID de la operación. El almacenamiento de pendientes es por sesión de navegador; si sessionStorage no está disponible, se usa memoria y no se promete recuperación tras cerrar esa sesión.
- Coste: una lectura puntual del recibo por intento/transacción, además de las lecturas normales y reintentos SDK. No se descargan facturas históricas para encontrar duplicados, no se abren listeners ni se cambian índices, reglas, Firebase, IAM o servicios.
- Nuevas pruebas: 10 en `saleIdempotency.test.mjs` y 2 en `salePaymentSave.test.mjs`. Cubren doble envío, conflicto entre clientes del mismo ID, confirmación perdida, recuperación de pendiente, cambios de datos, ventas idénticas legítimas distintas, empresas/sedes/usuarios, no repetir canje de bono, bloqueo/errores de pago y venta de bono. Se adapta `lateSaleContext.test.mjs` a la nueva lectura de recibo conservando sus comprobaciones de contexto.
- Resultado final con `TZ=America/Bogota`: **269/271 aprobadas**, incluidas las doce nuevas. Persisten solo los dos fallos de baseline (dependencia Functions ausente y empaquetado ESM de React). Build y `git diff --check` aprobados. Typecheck mantiene los tres errores previos de AppErrorBoundary; no se ocultaron ni se modificó ese componente.
- Las pruebas usan transacciones optimistas simuladas y componentes React; no se probaron reglas contra emulador ni pagos reales ni se hizo una comprobación visual en navegador. Antes de producción, verificar en staging vendedor/admin, móvil/escritorio, efectivo/QR/bonos, intento repetido, error/reintento, factura única, stock, consecutivo, recibo y totales de caja por empresa/sede. El archivo local de reglas permite la lectura puntual de documentos inexistentes y los campos auxiliares de venta; no se certifica aquí la configuración efectiva desplegada.
- No se corrigen automáticamente duplicados históricos ni descuadres. Requieren auditar facturas, mercancía y dinero realmente recibido antes de decidir una anulación/ajuste trazable.

## Corrección local 2026-10-30 — aprobación única de cambios, versión 1.1.197

- Causa reproducida con datos sintéticos: dos aprobaciones simultáneas de una misma solicitud pendiente podían confirmar dos lotes, descontar dos unidades y crear dos registros de salida. La validación leía el estado de la pantalla, no una condición transaccional del documento guardado. El botón no bloqueaba una segunda pulsación.
- `App.tsx` procesa PRODUCT_EXCHANGE en una transacción del tenant writer existente: lee solicitud, prendas y venta original guardadas antes de escribir; comprueba empresa/sede, permisos, cantidades y stock. El estado procesado hace que repetir la misma aprobación sea una operación sin escrituras. Si dos clientes compiten, la transacción reintenta contra el estado actualizado. Venta, existencias e historial se confirman juntos. No se depende de que la venta estuviera descargada en el módulo.
- `IncidentsView.tsx` bloquea aprobaciones repetidas mientras guarda y libera el botón tras éxito/error, conservando filtros. Los otros tipos de novedad conservan su procesamiento existente; la protección transaccional nueva es específica de cambios de prenda.
- Regresiones nuevas: `exchangeApproval.test.mjs` (8 casos) y `exchangeApprovalUI.test.mjs` (1 caso), con concurrencia/reintento simulado de transacciones y componente real con modales auxiliares sustituidos. No son pruebas en dos dispositivos reales ni contra Firebase producción.
- Suite con `TZ=America/Bogota`: **257/259 aprobadas**; las nueve pruebas nuevas pasan y persisten únicamente los dos fallos de baseline documentados anteriormente. Build y `git diff --check` aprobados. Typecheck conserva exactamente los tres errores anteriores de `AppErrorBoundary.tsx`; no se ocultaron ni se modificó ese archivo.
- Sin cambios en reglas, servicios desplegados, Firebase, contraseñas o datos históricos. Sin nuevas consultas de arranque ni listeners; las lecturas puntuales adicionales ocurren solo al aprobar el cambio y pueden repetirse si hay conflicto de transacción. Carlos autorizó promover esta versión a producción el 2026-10-30. Se conserva como rollback de código el main previo f8277e96fddb198afedfd68630beaf4641aa0bf9. La promoción incluye la mejora visual 1.1.196 y esta corrección 1.1.197. La verificación del deploy y versión servida queda pendiente; no se afirma que las pruebas generales/typecheck estén completamente aprobados.
- Pendiente antes de producción: comprobar en staging con datos sintéticos dos aprobaciones del mismo cambio desde dos sesiones; verificar una entrada/salida, venta y estado, errores, permisos y stock insuficiente. No se afirma validación visual o contra reglas reales.
- Los dos movimientos de la factura 2962 fotografiados no se auditaron en Firebase: se desconoce si corresponden a una misma solicitud o a dos distintas. La corrección no ajusta existencias antiguas. Para una sola prenda entregada con doble descuento confirmado, registrar un ajuste justificado de +1 por la unidad extra descontada; revisar también la prenda recibida porque podría haberse sumado dos veces. No borrar historial ni reaplicar la novedad. Dos solicitudes diferentes para una misma factura requieren auditoría separada: el control de aprobación única usa el ID de solicitud, no solo el número de factura.

## Cambio local 2026-10-27 — cruces entre sedes, versión 1.1.196

- Preparado en `staging`; Carlos autorizó publicar en staging. Subida a GitHub autorizada; despliegue y versión servida pendientes de verificación (el acceso al sitio y API de Netlify devuelve HTTP 403 desde este entorno). Solo presentación del libro de caja/conciliación: sede relacionada visible, pagos identificados por dirección y préstamos cuando el concepto los identifica expresamente. Los cruces ambiguos dicen «Cruce con [sede]»; no se infiere un préstamo solo por el signo del importe.
- Los pagos generados por la aplicación muestran una descripción corta y «Ver detalle del pago» con el concepto original completo. En la confirmación, las fechas quedan en «Ver deudas incluidas en el pago». Se conserva texto libre, registros históricos, referencias, exportaciones, saldos y lógica de guardado. No se añaden lecturas Firestore.
- Nuevos archivos: `services/financialRecordPresentation.ts`, `components/FinancialRecordConcept.tsx` y `tests/financialRecordPresentation.test.mjs`. Integración en `FinancialReconciliationView.tsx`; versión, historial y caché actualizados.
- Verificaciones con `TZ=America/Bogota`: suite completa 248/250 aprobadas; persisten los dos fallos de baseline (dependencia Functions `@google-cloud/firestore` ausente y empaquetado ESM de React en `sharedRecordAccess`). Las cinco pruebas nuevas aprueban. Build y `git diff --check` aprobados.
- Typecheck conserva exactamente tres errores previos en `AppErrorBoundary.tsx` (`setState`/`props`), comprobados también sobre la copia sin cambios; no se modificó ese componente.
- Sin cambios en Firebase, reglas, permisos, datos ni cálculos. Pendiente validación visual en móvil y PC tras publicar en staging: revisar cruces existentes, pagos salientes/entrantes, préstamos explícitos y abrir detalle sin seleccionar accidentalmente la fila. No se afirma una comprobación visual de navegador.

## Decisiones vigentes
- Repositorio principal: https://github.com/deadlylord/Sistemabomb-nrecu (conservar nombre actual).
- Aplicación Android en repositorio separado `deadlylord/Vestika-Android`.
- Flujo de trabajo: desarrollar/probar en `staging`; pedir aprobación antes de fusionar o desplegar en `main`.
- Mismas instrucciones `AGENTS.md` para ambas ramas una vez aprobadas; bases Firebase de staging y producción separadas.
- Carlos prefiere colaboración crítica, cercana y explicativa, autonomía equilibrada y protección explícita de funcionalidades existentes.
- No cambiar interfaces o flujos sin avisar; reportar impacto, riesgos, pruebas y regresiones.

## Estado Git verificado al iniciar esta documentación
- Se identificó el repositorio correcto tras confusión con otro de nombre parecido.
- `staging` estaba siete commits detrás de `main`, sin commits propios por delante; fue actualizada para coincidir con `main` en `4b228222`.
- Se conservó referencia de respaldo `backup/staging-before-sync-2026-10-26`.
- `staging-v2` era una rama histórica divergente y Carlos pidió eliminarla. **No consta eliminada**; no borrarla sin confirmar respaldo y disponer de la acción adecuada.
- Existían ramas históricas como `fix/pos-loading-regression`, `develop/safe-staging-performance` y `chore/vestika-agent-skills`. La existencia de una rama no prueba que su solución esté fusionada ni funcionando.
- `package.json` declara pruebas TypeScript, rendimiento y reglas Firestore; su ejecución y resultado actuales **no se han comprobado**.
- No se han validado variables reales de Netlify ni realizado pruebas E2E de navegador.

## Incidentes reportados anteriormente — verificar antes de tratarlos como abiertos
| Área | Síntoma reportado | Validación recomendada |
| --- | --- | --- |
| POS y carga inicial | Productos lentos o ausentes después de cambios en resúmenes; pantalla blanca en algunos casos | Reproducir con vendedor y administrador, revisar estados, listeners, errores y rama `fix/pos-loading-regression` |
| Login | Inicio de sesión de varios segundos y retraso al entrar | Medir por fases y roles, separar auth, datos y render |
| Resumen del Negocio | Carga visible de resúmenes y posibles regresiones en otras vistas | Comprobar dependencias compartidas y datos cargados |
| Inventario | Guardar borrador de verificación detallada tardaba 10–30 s | Perfilar lecturas/escrituras y probar datos representativos |
| Conciliación | Guardado lento, filtros que se pierden, paginación o interfaz móvil | Probar guardado, cambio de tienda, filtros, paginación y permisos |
| Ventas y abonos | Edición de precios/totales, saldos, inventario y controles móviles | Pruebas de cambios de precio, cantidad, devolución y pagos |
| Traslados | Riesgo de diferencias entre origen/destino y duplicaciones | Validar movimientos atómicos e inventario de ambos extremos |
| Etiquetas | Configuración de tamaño compartida entre empresas | Probar aislamiento por empresa/tienda y cambio de sesión |
| Multiempresa | Regresiones de permisos, caché o mezcla de datos | Pruebas Firestore y navegación entre empresas |
| Seguridad | Posible exposición de claves de IA en cliente | Inspeccionar Vite, bundle y configuración de servicios |

## Próximos trabajos recomendados
1. Revisar arquitectura real de login, resúmenes y carga del POS; identificar causa del incidente de productos no cargados.
2. Ejecutar y registrar `npm run lint`, `npm run build`, `npm run test:performance` y suites de reglas en emuladores donde sea viable.
3. Crear regresión automatizada de apertura del POS con vendedor y administrador; evaluar Playwright o alternativa compatible con la aplicación.
4. Comprobar configuración efectiva de Netlify para staging y producción antes de desplegar.
5. Ampliar cobertura de ventas, stock, traslados, conciliación y separación entre empresas.
6. Actualizar esta tabla tras cada diagnóstico: fecha, commit, reproducción, causa confirmada, solución, pruebas y estado.

## Criterio de cierre
Un problema solo se marca **resuelto y verificado** cuando se identifica el cambio, se ejecutan pruebas pertinentes y se confirma el comportamiento esperado en el entorno autorizado. Si no se pudo probar, registrar explícitamente «pendiente de verificación».
