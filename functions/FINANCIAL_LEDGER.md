# Conciliación por sede y proyección de saldos

## Estado de esta entrega

La aplicación funciona sin activar servicios nuevos: el libro y auditoría se suscriben a la sede activa; el resumen global se carga al abrirlo; ventas, apartados y novedades de conciliación se reciben únicamente de la sede activa. La tabla dibuja páginas de 50 filas y conserva los saldos completos del histórico en la ruta existente.

Las mutaciones financieras pasan por una transacción en `createTenantWriter`: lectura actual, comprobación de empresa/sedes, detección de edición simultánea, actualización de ambas contrapartes y auditoría de ambas. Los cruces antiguos con vínculo ausente o contradictorio se bloquean para revisión; no se emparejan por importe/nombre/fecha. La restauración de eliminaciones nuevas recupera la contraparte exacta guardada en auditoría. Las eliminaciones antiguas sin esa captura no pueden reconstruirse automáticamente.

Los formularios de lote/pago conservan un borrador por usuario/empresa/sede con identificadores estables. Su auditoría es el comprobante de una operación completa. Reintentar el mismo borrador no lo duplica; cambiar los datos de un borrador ya confirmado se rechaza. Los horarios de nómina no se modifican en esta entrega.

La ruta de lecturas acotadas por fecha/cuenta está implementada y permanece desactivada por defecto (`VITE_FINANCIAL_LEDGER_INDEXED`). Requiere desplegar la proyección y verificar el histórico. No se ha ejecutado la migración ni cambiado reglas, servicios o datos de Firebase desde este workspace.

## Proyección del servidor

`financialLedgerChanged` observa **todos** los cambios en `financialRecords`, también los producidos desde Contabilidad o clientes anteriores. Dentro de una transacción lee el documento fuente actual y su última proyección, calcula el delta y actualiza únicamente las sedes/meses/cuentas/pares involucrados. Los eventos duplicados o desordenados no duplican importes; la versión de origen conserva segundos y nanosegundos.

- `financialLedgerCompanies/{companyId}/stores/{storeId}`: saldos por cuenta, deuda por contraparte, conteo, revisión y estado de verificación.
- `.../months/{YYYY-MM}`: categorías del mes y conteo.
- `.../months/{YYYY-MM}/entries/{recordId}`: detalle del mes necesario para conciliación y comprobación de cierres.
- `.../accounts/{account}/entries/{recordId}`: libro paginado por cuenta, ordenado por `ledgerTime` normalizado a Colombia.
- `.../peers/{peerId}/entries/{recordId}`: detalle de un par de sedes, consultado al abrirlo/exportarlo.
- `financialLedgerState/{recordId}`: estado privado para aplicar/revertir el delta exactamente una vez.
- `financialLedgerErrors/{recordId}`: diagnóstico privado de datos históricos inválidos; no incluye el documento fuente.

El servidor determina la empresa a partir de `stores`, comprueba la empresa declarada del movimiento y la de su contraparte. Los registros antiguos sin companyId pertenecen a la empresa real de la sede; una sede histórica sin companyId usa `default_company`. Los movimientos con `affectsCashBalance=false` afectan su deuda, pero no el saldo físico. Los resúmenes no incluyen el saldo inicial de configuración: la interfaz lo añade al leerlo, por lo que cambiarlo no requiere reconstrucción.

Las escrituras y lecturas adicionales dependen del movimiento, no de todas las sedes de una empresa. No hay un contador único compartido por todas las empresas o todas las sedes. Las deudas por contraparte están contenidas en el resumen de cada sede: si el número de contrapartes aproxima el límite de tamaño de documento de Firestore, habrá que repartir ese mapa en documentos; la prueba de esta entrega cubre 100 sedes, no una escala ilimitada.

## Activación

1. Con acceso administrativo al proyecto correcto, revisar las reglas **existentes** y las identidades reales del POS. Permitir la lectura de la proyección solo a usuarios autorizados para su empresa/sede. Denegar escrituras de clientes a toda la proyección y acceso a `financialLedgerState`/`financialLedgerErrors`. Las comprobaciones del cliente no sustituyen reglas del servidor. Esta entrega no incorpora ni reemplaza reglas de producción y no activa el login nuevo.
2. Desde `functions`, instalar sus dependencias y desplegar solo el observador:

   ```sh
   npm ci
   firebase deploy --config firebase.ledger.json --only functions:financialLedgerChanged --project PROJECT_ID
   ```

   Si hay un codebase distinto en la configuración actual del proyecto, ajustar el destino de despliegue antes de ejecutar. No desplegar `vestikaLogin`, reglas ni funciones ajenas como parte de este cambio.
3. Ejecutar una comprobación de una sede sin escrituras, usando credenciales administrativas ADC y el proyecto/empresa/sede explícitos:

   ```sh
   node scripts/buildFinancialLedger.mjs --project PROJECT_ID --company COMPANY_ID --store STORE_ID
   ```
4. Construir la proyección y verificarla:

   ```sh
   node scripts/buildFinancialLedger.mjs --project PROJECT_ID --company COMPANY_ID --store STORE_ID --write --activate
   ```

   La construcción procesa páginas de 200 y es reanudable. No altera los movimientos originales. El script valida propiedad, versión fuente, saldos y categorías y solo después marca `ready=true`. La validación final usa una transacción de lectura del histórico de **una** sede; para históricos que excedan el tiempo/límites de esa transacción habrá que verificar por particiones antes de activar, no omitir la validación. Corregir datos inválidos y repetir si no coincide. Hacer una sede de prueba primero y después las demás. Las sedes nuevas necesitan su propia verificación antes de usar la ruta indexada.
5. Establecer `VITE_FINANCIAL_LEDGER_INDEXED=true` en el entorno de pruebas y compilar/publicar. Una sede sin resumen verificado sigue usando su fuente original. Comprobar saldos, cambios retroactivos de mes/cuenta, exportaciones, desconexión y dos ventanas simultáneas. Después activar el entorno de producción.

La proyección se actualiza después de confirmar el movimiento fuente; puede existir un breve retraso hasta que llegue el evento del servidor. El mensaje de confirmación se refiere al guardado del movimiento. Una caída de la función no debe interpretarse como un fallo del guardado original ni motivar repetir el movimiento.

## Lecturas y límites prácticos

Al abrir el libro indexado se leen un resumen de sede, el resumen/detalle del mes seleccionado y 50 movimientos de la cuenta. No se abren suscripciones al histórico completo mientras se espera el resumen. El detalle mensual permanece completo para conservar la comprobación de cierres; una sede con un volumen excepcional en un solo mes requerirá además resúmenes de cierres y paginación de ese detalle.

Las fechas se filtran en la consulta de cuenta. Para calcular el saldo de filas históricas se suma en el servidor el importe físico posterior al límite final, sin descargar esas filas. La búsqueda de texto parcial recorre el rango seleccionado de una cuenta porque Firestore no ofrece aquí un índice de texto parcial; una búsqueda sin fechas o exportación completa puede leer todo ese libro, solo bajo demanda. Las exportaciones consultan el conjunto completo correspondiente y comprueban que la revisión no cambió durante el recorrido. No exportan silenciosamente una página como si fuera todo el libro.

Los historiales de cruces y de auditoría se abren bajo demanda y se restringen a la sede activa. La proyección de pares se obtiene en páginas de 200 para exportación/consulta; todavía se mantiene el detalle del par solicitado en memoria. Medir historiales especialmente grandes antes de activar a mayor escala.

## Validación local

- Pruebas de mutación atómica, restauración, idempotencia y aislamiento con Firestore simulado.
- Proyección bajo eventos repetidos/desordenados; cambio de mes/cuenta; creación/eliminación/restauración; empresa de fuentes históricas; 100 sedes y 50.000 movimientos simulados.
- Pantalla con 5.000 movimientos: solo 50 filas y saldo completo, bloqueo de doble envío, borrador conservado ante error y reintento con los mismos IDs.
- Carga real del hook con la proyección activada/desactivada: no descarga el histórico antes de conocer el estado del resumen, ni carga otras sedes al abrir el libro; no elimina cruces autorizados al reducir el alcance de lectura.

Estas pruebas no son mediciones de red de producción ni sustituyen la comprobación de reglas y del histórico real. El comando TypeScript de la base ya reporta tres errores en `AppErrorBoundary.tsx`; la suite base también contiene fallos de mocks de navegación/recuperación que deben compararse antes de atribuirlos a este cambio.

Resultado de la suite completa de esta candidata: 101/109 pruebas aprobadas. Los ocho fallos restantes también están presentes en la base `c60fe77`; una prueba antigua de suscripción se actualizó al contrato real de `docChanges()` y pasó. Las 32 comprobaciones focalizadas de conciliación/carga/aislamiento pasaron. La compilación de producción pasó.
