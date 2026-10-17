# Conciliación paginada: preparación para producción en operación

## Estado y alcance

La web de producción permanece en 1.1.167 con el libro compatible. Este trabajo prepara una activación independiente del nuevo login. No se desplegaron reglas, funciones ni resúmenes de producción en esta fase: el entorno no conserva la sesión administrativa anterior. No se cambia el menú, las pantallas, el acceso de las vendedoras ni los movimientos originales.

El proyector ahora admite hasta 50 fuentes por transacción, reutiliza lecturas de sedes y actualiza una sola vez los resúmenes compartidos. La construcción recorre páginas por ID con cursor y permite continuar desde la última página confirmada. Un evento simultáneo y el constructor usan las mismas versiones de fuente y estados, por lo que no suman dos veces el mismo movimiento. El número de escrituras de cada lote tiene un límite explícito de 450. El procesador normal sigue aceptando un solo evento.

No se anuncia una ventana de cierre ni se bloquea la colección de movimientos. Cada lote del constructor puede contender brevemente por los documentos que procesa, como una actualización normal; los demás movimientos siguen disponibles. Los resúmenes se mantienen inactivos durante la construcción y la web conserva el libro actual por sede. La actualización de resúmenes es asíncrona: confirmar el guardado y ver el acumulado actualizado son pasos distintos.

## Verificación y activación

La auditoría paginada usa una transacción de solo lectura. Comprueba versiones actuales, copias de las fuentes, saldos por cuenta, deudas, categorías mensuales y cada entrada utilizada por páginas, cierres y exportaciones. También compara los saldos con una suma independiente de las fórmulas de la pantalla actual. Respeta fechas históricas diferentes y contrapartes que se eliminaron manualmente; no inventa compensaciones.

La activación únicamente escribe el resumen de la sede. Exige que el procesador exacto esté activo y que las reglas desplegadas coincidan con la revisión comprobada. Una precondición de versión impide activar a partir de un resumen modificado durante la auditoría. Se conserva el modelo asíncrono normal para cambios nuevos posteriores a la fotografía verificada. Los escritores de este procedimiento solo pueden escribir las rutas derivadas; rechazan fuentes, vendedores, contraseñas, tiendas e historial.

Referencia técnica: las transacciones de solo lectura no toman bloqueos sobre los documentos; la activación usa una escritura condicional separada. https://googleapis.dev/nodejs/firestore/latest/Firestore.html#runTransaction

## Permisos y despliegue aislado

`prepareCompatibleLedgerRules` acepta únicamente la forma exacta de la regla histórica global autenticada. Si producción tiene otra política, se detiene para revisarla y no la reemplaza automáticamente. La propuesta conserva los accesos de negocio existentes y excluye explícitamente los tres espacios derivados del permiso global. Los resúmenes y entradas quedan de escritura exclusiva del servidor y los estados/diagnósticos son privados. No se confunde esto con la migración de aislamiento por identidad: el acceso anónimo histórico conserva sus limitaciones, documentadas en la auditoría JSON.

El empaquetador genera un codebase local independiente que exporta únicamente `productionFinancialLedgerChanged`, en `us-central1` para la base `nam5`. No exporta login, identidad, usuarios, roles, tienda online o resúmenes del negocio. Un hash identifica el código preparado. El código original compartido no exporta este disparador a staging. Los archivos generados terminan en `.local` y no se guardan en git; son reproducibles desde las fuentes versionadas.

## Procedimiento autorizado pendiente de conexión

1. `node functions/scripts/productionLedger.mjs --mode pack` prepara el paquete sin conexión y no despliega.
2. Con la sesión administrativa autorizada: ejecutar `--mode check`. Verifica proyecto, edición Standard, región y regla real; conserva localmente la regla anterior y su referencia de rollback. Actualizar el respaldo privado antes de aplicar cambios administrativos y conservar la revisión de reglas anterior fuera de archivos transitorios.
3. Instalar dependencias del codebase generado con `npm ci --prefix functions/.production-ledger.local --ignore-scripts`.
4. Desplegar solo las reglas revisadas y la función aislada:
   ```sh
   firebase deploy --config firebase.production-ledger.local --project factura2-6e811 --only firestore:rules
   firebase deploy --config firebase.production-ledger.local --project factura2-6e811 --only functions:vestika-ledger-production:productionFinancialLedgerChanged
   ```
   No ejecutar un despliegue global de funciones ni copiar las reglas de identidad de staging.
5. Volver a ejecutar `--mode check`; exigir reglas y procesador exactos activos. Ejecutar `--mode build`, por sedes secuencialmente. Para reanudar una página confirmada: `--mode build --store ID --after ULTIMO_ID`. Esto no sustituye una segunda pasada completa antes de verificar, porque la creación de un ID anterior al cursor debe recogerse por el disparador o una pasada nueva.
6. Ejecutar `--mode verify` y después `--mode activate`, reintentando la sede cuando cambien sus versiones o el procesador aún esté al día. Las verificaciones grandes no bloquean los guardados normales.
7. Solo después de coincidir los saldos: habilitar la consulta indexada del cliente de producción, publicar una versión nueva y comprobar páginas, ediciones, eliminación/restauración de cruces, cierres y exportación. Staging conserva su proyecto propio. No cambiar el resumen del negocio.

## Recuperación

La primera reversión es desactivar el indicador del cliente: vuelve a leer el histórico de la sede sin reescribirlo. Los datos derivados se pueden reconstruir desde las fuentes. Si es necesario revertir reglas o servidor, usar sus referencias exactas capturadas y conservar las fuentes; no restaurar un respaldo viejo sobre ventas o movimientos nuevos de las tiendas. No borrar en bloque estados o resúmenes mientras el disparador esté activo.

## Validación

- 175 pruebas generales aprobadas, incluidas las pruebas previas del proyector de staging y seis comprobaciones nuevas de construcción, límites de escrituras, reglas y saldos.
- 8 comprobaciones de integración aprobadas en Firestore Emulator: 1.005 movimientos y sus entradas; construcción de 21 lotes y segunda pasada sin duplicación; categorías/fechas; acceso actual de negocio; prohibición de escribir derivados; bloqueo de estado privado; rechazo de manipulación con totales iguales; edición durante auditoría y rechazo de activación obsoleta; activación válida sin modificar perfiles ni fuentes.
- Estas son pruebas locales. No equivalen a una construcción o activación en Firebase de producción.
