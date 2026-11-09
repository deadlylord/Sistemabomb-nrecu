# Aprobación de traslados por servidor — prototipo 1.1.214

## Estado y límites

Preparado exclusivamente en la rama staging para vestika-staging. Autorización de Carlos: preparar y probar el callable de traslados; producción y main quedan excluidos. El cliente conserva la ruta previa mientras VITE_SERVER_TRANSFER_APPROVAL no sea exactamente true. El estado inicial no incluía esta variable; ver actualización reportada más abajo. No hay migración ni reparación de históricos.

El endpoint es vestikaStagingApproveTransfer. Recibe solo companyId, storeId (sede creadora), incidentId y diagnostics opcional. Actor/roles/Developer vienen de token verificado y documentos vigentes. Las cantidades, productos y ruta vienen de la solicitud persistida. La función usa Admin SDK: replica aislamiento/roles/categorías y no depende de controles visuales ni de reglas para autorizar sus escrituras. Usa transacción para usuario/rol/empresa/sedes/solicitud/productos/categorías/comprobante y búsqueda destino limitada a dos documentos. El stock de bodega no cambia.

El estado procesado y el recibo request_<incidentId> impiden una nueva aplicación, incluso entre administradores o tras respuesta perdida. Pendiente con recibo existente se rechaza para revisión, sin inventar una reparación. Completados históricos sin recibo siguen siendo no-op. Logs deterministas se crean atómicamente con stock y solicitud. Entradas admiten IDs ASCII de hasta 128 caracteres e IDs internos derivados hasta 256; evaluar manualmente IDs históricos ajenos a ese formato antes de cualquier extensión a producción.

La respuesta no contiene datos de producto/cliente. Si se mide, añade totalMs, attempts y operaciones de lectura observadas en servidor (no facturación). La etapa de servidor excluye arranque anterior al manejador y transporte. El cliente espera confirmación, ignora resultados fuera de contexto y nunca ejecuta el flujo cliente como respaldo al error/timeout. Un error de respuesta no demuestra que no se guardó: revisar la solicitud y reutilizar el mismo ID.

## Actualización reportada por Carlos desde Codex escritorio

- Función desplegada ACTIVE, Node22 segunda generación, vestika-staging/southamerica-east1. Rechazo anónimo 403. Flag activado exclusivamente en la rama staging de Netlify; producción permanece en main 524fd45. Despliegue aportado: https://app.netlify.com/projects/vestikapos/deploys/6af13c3281dc11fb903b564d.
- Prueba sintética: origen 5→3, destino 1→3, bodega 3 intacta; un comprobante, dos logs y una transición. Cinco reintentos devolvieron alreadyProcessed sin efectos adicionales.
- Desde interfaz con dos administradores: aprobación simultánea única; venta de última unidad gana y traslado pendiente sin comprobante/logs; respuesta perdida y cambio de sede no reenvían ni aplican respaldo local.
- Cinco aprobaciones nuevas: panel 320–520 ms (mediana 320), servidor 117–147 ms (mediana 125), clic a completado 395–1429 ms (mediana 402); un intento cada una. No constituye comparación controlada ni medición confirmada de arranque frío. Cuentas y datos de prueba eliminados según reporte.
- Evidencia aportada en la conversación, no repetida con acceso remoto por este executor. Las limitaciones de acceso de este executor descritas debajo no significan que el despliegue externo siga pendiente. Nada de esto instala funciones ni migra datos a factura2-6e811.

## Verificación del executor — 2026-11-08

- Recuperado staging en el commit exacto 77c578a, versión 1.1.214. main y producción intactos. Sin cambios al flag ni a Netlify.
- Política de red observada vigente y aplicada: los dominios Google requeridos están permitidos. GitHub y firebase.googleapis.com responden fuera del sandbox; dentro, la conexión al proxy:8080 falla. La respuesta HTTP 404 de la raíz de Firebase acredita conectividad, no autorización ni acceso a todas las APIs.
- Firebase CLI 15.34.0: login:list informa que no hay cuentas autorizadas; projects:list falla por autenticación. No hay identidad outbound, secretos, ADC ni FIREBASE_TOKEN configurados. Falta vincular una identidad administrativa limitada a vestika-staging por el mecanismo seguro del entorno. No introducir secretos en chat ni Git.
- Dependencias functions instaladas con npm ci --prefix functions --ignore-scripts. Pruebas focalizadas: 66/66 con --test-isolation=none (Node24.22.1 local; runtime declarado del servicio Node22). Build aprobado. Typecheck mantiene los tres errores previos de AppErrorBoundary.tsx.
- Emulador Firestore 1.22.0 descargado y ejecutado en demo-vestika-transfer-approval: 3/3 aprobadas (aplicación atómica única concurrente y bodega intacta; categoría ajena sin escrituras; destino ambiguo rechazado). Ningún dato remoto utilizado.
- Sin autenticación no se pueden verificar mediante API ubicación, facturación, cuenta de ejecución ni existencia/estado remoto de la función. No se intentó desplegar, habilitar APIs, cambiar IAM ni activar el cliente.

Estado inicial, previo al despliegue externo reportado: Carlos aportó capturas de ubicación southamerica-east1 y del proyecto vestika-staging; no se consultaron el plan de facturación ni la configuración del servicio mediante API. No se desplegó ni activó el callable. No se midió latencia real y no se promete reducción. Wrapper y cliente usan southamerica-east1 (São Paulo), conforme a las capturas aportadas. Verificar también la ubicación mediante API antes del despliegue. minInstances=0 evita instancias mantenidas por este prototipo; medir también arranque frío. maxInstances=3. No habilitar facturación/APIs/cambiar IAM por suposición.

## Verificaciones antes de activar

1. Aplicar y publicar la configuración del entorno de Codex para los dominios propuestos. Esto no despliega Vestika. Vincular autenticación administrativa limitada a vestika-staging por el mecanismo seguro del entorno, nunca por chat o Git. Comprobar conectividad y acceso reales después de aplicar.
2. Consultar la ubicación con `gcloud firestore databases describe --project=vestika-staging --database='(default)' --format='value(locationId)'` o en la consola Firestore de staging. Confirmar región de funciones, facturación y cuenta de ejecución. Si corresponde otra región, ajustar conjuntamente functions/src/transferApprovalCallable.mjs y services/serverTransferApproval.ts. No cambiar ubicación de la base.
3. Ejecutar pruebas unitarias y de emulador. Instalar dependencias de functions con su lockfile local (`npm ci --prefix functions --ignore-scripts`). Runtime del servicio: Node22. No ejecutar seeds ni copiar datos reales.
4. Desplegar solo el endpoint y siempre con proyecto explícito. Desde functions:

```sh
npx --yes firebase-tools@15.34.0 deploy --project vestika-staging --config firebase.transfer-approval-staging.json --only functions:vestikaStagingApproveTransfer --non-interactive
```

5. Verificar estado del servicio, región y rechazo anónimo. No desplegar reglas/índices/otras funciones. Si falta índice/permisos, detenerse y revisar el error exacto, sin habilitar accesos amplios.
6. Solo después, configurar VITE_SERVER_TRANSFER_APPROVAL=true en el contexto staging de Netlify y reconstruir la rama staging. No usar variables compartidas con production. Ambos guards appEnv y projectId bloquean producción.
7. En staging, aprobar una solicitud TEST creada en la sede activa: una salida, una entrada, un comprobante, dos logs y una transición. Repetir mismo ID y probar dos administradores, fallo de conexión, stock vendido concurrentemente y cambio de contexto. Sin movimientos reales de tiendas productivas.
8. Medir primera invocación y varias posteriores, misma red/equipo/registro comparable. Exportar JSON con etapa cliente y tiempo agregado de servidor. Comparar con 4–6 segundos observados antes; no atribuir mejora sin muestras.

Desactivar: quitar la variable o ponerla en false y reconstruir exclusivamente staging. Eso afecta nuevas aprobaciones; no revierte llamadas ya enviadas ni registros confirmados. Revisar solicitudes pendientes antes de volver a operar. Producción continúa con su código sin esta función.

## Pruebas locales

```sh
TZ=America/Bogota node --experimental-strip-types --test tests/serverTransferApproval.test.mjs tests/serverTransferClient.test.mjs tests/transferIdempotency.test.mjs
```

Emulador obligatorio local, proyecto demo, sin credenciales productivas:

```sh
XDG_CONFIG_HOME=/tmp/vestika-firebase-config FIREBASE_EMULATORS_PATH=/tmp/vestika-emulators npx --yes firebase-tools@15.34.0 emulators:exec --config firebase.staging.emulator.json --only firestore --project demo-vestika-transfer-approval 'TZ=America/Bogota node --test tests/firestore/serverTransferApproval.test.mjs'
```

Las tres pruebas con Firestore local se ejecutaron y aprobaron el 2026-11-08. Esto no reemplaza una validación autenticada en staging ni una medición real del servicio desplegado.
