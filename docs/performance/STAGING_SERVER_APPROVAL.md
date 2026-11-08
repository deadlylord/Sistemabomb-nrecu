# Aprobación de traslados por servidor — prototipo 1.1.214

## Estado y límites

Preparado exclusivamente en la rama staging para vestika-staging. Autorización de Carlos: preparar y probar el callable de traslados; producción y main quedan excluidos. El cliente conserva la ruta previa mientras VITE_SERVER_TRANSFER_APPROVAL no sea exactamente true. No se añadió esta variable a Netlify. No hay migración ni reparación de históricos.

El endpoint es vestikaStagingApproveTransfer. Recibe solo companyId, storeId (sede creadora), incidentId y diagnostics opcional. Actor/roles/Developer vienen de token verificado y documentos vigentes. Las cantidades, productos y ruta vienen de la solicitud persistida. La función usa Admin SDK: replica aislamiento/roles/categorías y no depende de controles visuales ni de reglas para autorizar sus escrituras. Usa transacción para usuario/rol/empresa/sedes/solicitud/productos/categorías/comprobante y búsqueda destino limitada a dos documentos. El stock de bodega no cambia.

El estado procesado y el recibo request_<incidentId> impiden una nueva aplicación, incluso entre administradores o tras respuesta perdida. Pendiente con recibo existente se rechaza para revisión, sin inventar una reparación. Completados históricos sin recibo siguen siendo no-op. Logs deterministas se crean atómicamente con stock y solicitud. Entradas admiten IDs ASCII de hasta 128 caracteres e IDs internos derivados hasta 256; evaluar manualmente IDs históricos ajenos a ese formato antes de cualquier extensión a producción.

La respuesta no contiene datos de producto/cliente. Si se mide, añade totalMs, attempts y operaciones de lectura observadas en servidor (no facturación). La etapa de servidor excluye arranque anterior al manejador y transporte. El cliente espera confirmación, ignora resultados fuera de contexto y nunca ejecuta el flujo cliente como respaldo al error/timeout. Un error de respuesta no demuestra que no se guardó: revisar la solicitud y reutilizar el mismo ID.

## Bloqueos externos actuales

El executor no tiene identidad de Firebase/GCP autorizada; la política de red vigente bloquea servicios Google de despliegue. El intento de emulador local no pudo descargar el JAR de storage.googleapis.com. La propuesta de dominios necesaria quedó guardada en el borrador del entorno Codex, sin aplicarse al runtime ni activar servicios.

Carlos aportó capturas de ubicación southamerica-east1 y del proyecto vestika-staging; no se consultaron el plan de facturación ni la configuración del servicio mediante API. No se desplegó ni activó el callable. No se midió latencia real y no se promete reducción. Wrapper y cliente usan southamerica-east1 (São Paulo), conforme a las capturas aportadas. Verificar también la ubicación mediante API antes del despliegue. minInstances=0 evita instancias mantenidas por este prototipo; medir también arranque frío. maxInstances=3. No habilitar facturación/APIs/cambiar IAM por suposición.

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

Las tres pruebas reales de emulador están preparadas, pero no se ejecutaron por bloqueo de descarga del JAR. Las pruebas sintéticas no reemplazan esa verificación ni una medición real del servicio desplegado.
