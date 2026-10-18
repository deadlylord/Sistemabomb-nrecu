# Conciliación paginada en producción en operación

## Estado y alcance

La activación del libro indexado es independiente del nuevo login. El despliegue conserva el menú, las pantallas, el acceso de las vendedoras y los movimientos originales. La versión 1.1.168 habilita el índice de producción después de construir y verificar las siete sedes. Los saldos y las entradas se compararon en Firebase real antes de la activación.

El proyector ahora admite hasta 50 fuentes por transacción, lee las fuentes y sus estados en una sola petición `getAll`, reutiliza lecturas de sedes y actualiza una sola vez los resúmenes compartidos. Se evita abrir 100 conexiones de lectura simultáneas por lote. La construcción recorre páginas por ID con cursor y permite continuar desde la última página confirmada. Un evento simultáneo y el constructor usan las mismas versiones de fuente y estados, por lo que no suman dos veces el mismo movimiento. El número de escrituras de cada lote tiene un límite explícito de 450. El procesador normal sigue aceptando un solo evento.

No se anuncia una ventana de cierre ni se bloquea la colección de movimientos. Cada lote del constructor puede contender brevemente por los documentos que procesa, como una actualización normal; los demás movimientos siguen disponibles. Los resúmenes se mantienen inactivos durante la construcción y la web conserva el libro actual por sede. La actualización de resúmenes es asíncrona: confirmar el guardado y ver el acumulado actualizado son pasos distintos.

## Verificación y activación

La auditoría paginada usa una transacción de solo lectura. Comprueba versiones actuales, copias de las fuentes, saldos por cuenta, deudas, categorías mensuales y cada entrada utilizada por páginas, cierres y exportaciones. También compara los saldos con una suma independiente de las fórmulas de la pantalla actual. Respeta fechas históricas diferentes y contrapartes que se eliminaron manualmente; no inventa compensaciones.

La activación únicamente escribe el resumen de la sede. Exige que el procesador exacto esté activo y que las reglas desplegadas coincidan con la revisión comprobada. Una precondición de versión impide activar a partir de un resumen modificado durante la auditoría. Se conserva el modelo asíncrono normal para cambios nuevos posteriores a la fotografía verificada. Los escritores de este procedimiento solo pueden escribir las rutas derivadas; rechazan fuentes, vendedores, contraseñas, tiendas e historial.

Referencia técnica: las transacciones de solo lectura no toman bloqueos sobre los documentos; la activación usa una escritura condicional separada. https://googleapis.dev/nodejs/firestore/latest/Firestore.html#runTransaction

## Permisos y despliegue aislado

`prepareCompatibleLedgerRules` acepta únicamente las dos formas históricas revisadas: el permiso global autenticado solo, o acompañado del catálogo público de inventario y categorías que existe en producción. Conserva esos dos accesos públicos cuando estaban presentes. Si producción tiene otra política, se detiene para revisarla y no la reemplaza automáticamente. La propuesta conserva los accesos de negocio existentes y excluye explícitamente los tres espacios derivados del permiso global. Los resúmenes y entradas quedan de escritura exclusiva del servidor y los estados/diagnósticos son privados. No se confunde esto con la migración de aislamiento por identidad: el acceso anónimo histórico conserva sus limitaciones, documentadas en la auditoría JSON.

El empaquetador genera un codebase local independiente que exporta únicamente `productionFinancialLedgerChanged`, en `us-central1` para la base `nam5`. No exporta login, identidad, usuarios, roles, tienda online o resúmenes del negocio. Un hash identifica el código preparado. El código original compartido no exporta este disparador a staging. Los archivos generados terminan en `.local` y no se guardan en git; son reproducibles desde las fuentes versionadas.

## Procedimiento de despliegue

1. `node functions/scripts/productionLedger.mjs --mode pack` prepara el paquete sin conexión y no despliega.
2. Con la sesión administrativa autorizada: ejecutar `--mode check`. Verifica proyecto, edición Standard, región y regla real; conserva localmente la regla anterior y su referencia de rollback. Actualizar el respaldo privado antes de aplicar cambios administrativos y conservar la revisión de reglas anterior fuera de archivos transitorios.
3. Instalar dependencias del codebase generado con `npm ci --prefix functions/.production-ledger.local --ignore-scripts`.
4. Desplegar solo las reglas revisadas y la función aislada:
   ```sh
   firebase deploy --config firebase.production-ledger.local --project factura2-6e811 --only firestore:rules
   firebase deploy --config firebase.production-ledger.local --project factura2-6e811 --only functions:vestika-ledger-production:productionFinancialLedgerChanged
   ```
   En modo no interactivo, el despliegue de esta función requiere `--force` para aceptar sus reintentos ya revisados e idempotentes. No ejecutar un despliegue global de funciones ni copiar las reglas de identidad de staging.

   Crear aditivamente el índice de `security/production-ledger.indexes.json` mediante Firestore Admin API y esperar `READY`. Este archivo declara únicamente el índice del libro: no desplegarlo como inventario completo de índices porque existen otros índices del negocio. El índice combina `ledgerTime ASCENDING` y `balanceAmount ASCENDING` en la colección `entries` para los saldos de consultas por fecha.
5. Volver a ejecutar `--mode check`; exigir reglas y procesador exactos activos. Ejecutar `--mode build`, por sedes secuencialmente. Para reanudar una página confirmada: `--mode build --store ID --after ULTIMO_ID`. Esto no sustituye una segunda pasada completa antes de verificar, porque la creación de un ID anterior al cursor debe recogerse por el disparador o una pasada nueva.
6. Ejecutar `--mode activate`: primero realiza la auditoría completa y solo activa la sede si aprueba. `--mode verify` permite ejecutar la misma auditoría sin activar. Reintentar la sede cuando cambien sus versiones o el procesador aún esté al día. Las verificaciones grandes no bloquean los guardados normales.
7. Solo después de coincidir los saldos: habilitar la consulta indexada del cliente de producción, publicar una versión nueva y comprobar páginas, ediciones, eliminación/restauración de cruces, cierres y exportación. Staging conserva su proyecto propio. No cambiar el resumen del negocio.

## Recuperación

La primera reversión es desactivar el indicador del cliente: vuelve a leer el histórico de la sede sin reescribirlo. Los datos derivados se pueden reconstruir desde las fuentes. Si es necesario revertir reglas o servidor, usar sus referencias exactas capturadas y conservar las fuentes; no restaurar un respaldo viejo sobre ventas o movimientos nuevos de las tiendas. No borrar en bloque estados o resúmenes mientras el disparador esté activo.

## Validación

- 177 pruebas generales aprobadas, incluidas las pruebas previas del proyector de staging y comprobaciones de construcción, límites de escrituras, reglas y saldos; el catálogo público anterior también está cubierto.
- 8 comprobaciones de integración aprobadas en Firestore Emulator: 1.005 movimientos y sus entradas; construcción de 21 lotes y segunda pasada sin duplicación; categorías/fechas; acceso actual de negocio; prohibición de escribir derivados; bloqueo de estado privado; rechazo de manipulación con totales iguales; edición durante auditoría y rechazo de activación obsoleta; activación válida sin modificar perfiles ni fuentes.
- Firebase de producción: siete sedes construidas y activadas tras la auditoría; 5.580 fuentes y 13.068 entradas derivadas verificadas. Coinciden saldos por cuenta, deudas, meses, versiones y copias completas de cada entrada. La herramienta no escribió fuentes, perfiles, contraseñas ni historial.
- SDK web real de producción: cuenta 50 + 50 y cruce 50 + 50 sin duplicados; resumen listo; mes legible; agregado por fechas con índice listo; catálogo público e ingreso histórico legibles; estado privado denegado.
- Ambas configuraciones de la web compilaron; el resumen completo del negocio y las consultas indexadas están incluidos en las dos compilaciones.

## Respaldo y reglas anteriores

El respaldo previo al despliegue se capturó a `2026-10-17T23:32:12.640Z`: 10.474 documentos, incluidos 5.580 movimientos, 4.859 registros de historial y 17 usuarios. Se guardó cifrado con AES-256-GCM y se volvió a abrir para verificarlo; la clave permanece en Secret Manager. No se guarda material de clave ni datos privados en git.

Reglas anteriores: `projects/factura2-6e811/rulesets/db3ec55b-7cad-41be-aa79-9308c3dd9629`, SHA-256 `c0b46843ecd3d6b3139cf2b118a7eab77a375391b7fe0a3b888d2c8fd71254b5`. Conservaban catálogo público de `inventory`/`categories` y acceso global autenticado. La regla compatible desplegada tiene SHA-256 `70ee86b72cfe7386bf02658516b5d857beaa3a63dc1dedc7f8e4f29f95021f97`.

La herramienta administrativa usa OAuth en memoria y la librería de autenticación de la versión de `google-gax` que utiliza Firestore; se comprueba el encabezado de autorización con una prueba sin red. No genera archivos de claves ni cambia las credenciales de las tiendas.

## Comprobación real de staging

El procesador `financialLedgerChanged` de `vestika-staging` fue actualizado con la misma lectura agrupada. El índice de saldos por fechas quedó en estado `READY`. Una prueba temporal de 140 movimientos aprobó 19 comprobaciones funcionales: acceso verificado, aislamiento entre empresas/sedes, páginas 50/30 y cruces 50/10 sin duplicados, saldos, edición de cuenta/fecha, borrado/restauración de las dos contrapartes e invalidación por fuente incorrecta. Los 140 movimientos, perfiles, identidades y las 989 rutas temporales de la prueba se eliminaron al terminar. Los tiempos sintéticos de esa prueba no son una medición de los dispositivos de las tiendas.

## Activación real de producción

La auditoría y activación concluyeron el 18 de octubre de 2026 UTC (17 de octubre en Colombia). El procesador activo corresponde al hash `eb6cbf0f39d67fd6878fb4cc3d06fb9c18623f86`, con cinco instancias como máximo, concurrencia cuatro, cero instancias mínimas y reintentos idempotentes. La construcción se reanudó desde un cursor confirmado tras un fallo de conexión de la herramienta; la auditoría posterior recorrió todas las fuentes y entradas, incluidos los lotes anteriores.

Los índices de `entries` quedaron `READY` en ambos proyectos. Se crearon aditivamente; no se reemplazó el inventario existente de índices. La nueva consulta conserva el modelo asíncrono del servidor: los resúmenes pueden reflejar un guardado después de confirmada su escritura. Búsquedas, cierres y exportaciones solicitan los datos completos que requieren; no se afirma que esas operaciones estén limitadas a 50 lecturas. El login verificado de producción sigue siendo una migración separada y esta versión conserva su acceso histórico.
