# BLOQUE 1 — arranque por tienda (1.1.140)

Trabajo local exclusivo en `develop/safe-staging-performance`, basado en `7ffd25d`.
Sin merge, push, despliegue, conexión de pruebas a producción, cambio de reglas,
seed, eliminación o migración de datos. Los cambios pendientes de Novedades de
la rama anterior se preservaron en stash y en un respaldo separado.

## Causa raíz y solución

El arranque esperaba Auth anónimo **y** una rutina que consultaba la empresa
original y vendedores, e incluso creaba datos si faltaban. Luego abría cuatro
directorios sin tenant antes del login. El administrador abría un listener de
inventario por cada sede accesible; Dashboard agregaba tres colecciones por
sede, y Traslados mantenía otro listener por sede aun fuera del módulo.
La caché anterior duraba mientras esos listeners seguían conectados.

Ahora el formulario aparece antes de leer negocio y habilita el envío al estar
Auth disponible. No existe bootstrap automático. Al enviar credenciales se
consultan candidatos concretos y, una vez verificados, tres documentos:
sede asignada, rol y empresa. Se valida su coherencia antes de iniciar sesión.
No se reescribe la identidad histórica al entrar. El formulario y el controlador
bloquean envíos simultáneos y el registro de acceso se envía una sola vez.

El inicio abre POS cuando está permitido. Un rol sin POS conserva su primer
módulo permitido, sin activar analítica empresarial durante el login. Dashboard
empresarial se activa al navegar explícitamente al módulo/abrir reportes.
CEO conserva su botón de activación. No se modificaron ventas, conciliación,
traslados, Novedades ni abonos como operaciones de escritura.

En operación normal se escucha el documento de la tienda activa, el documento
de empresa, el rol e identidad propios y vendedores de la sede activa. La lista
de tiendas de la empresa llega al abrir el selector o una función que la necesita
(por ejemplo, destinos de Novedades, administración, Compras o analítica).
Los directorios completos solo llegan a Developer Center autorizado. Cada
suscripción de directorio tiene su propio ciclo: cambiar de tienda no vuelve a
leer el documento de empresa ni su lista ya solicitada de sedes.

El inventario de administradores usa el mismo listener compartido que el de
vendedores, únicamente para la sede activa. Caché de inventario en memoria:
clave `[usuario:companyId, storeId, colección]`, LRU, 20 entradas, 50.000 registros,
16 MiB de tamaño serializado estimado y caducidad de cinco minutos. Los límites
no incluyen el conjunto de trabajo que necesita la vista activa. Un inventario
que excede los límites funciona sin retener una copia para futuras visitas.
Se filtran tenant/sede y se conserva `assertTenantData` antes de publicar/cachear
inventario. Cambiar empresa o salir limpia la caché. Los callbacks de listeners
cerrados y consultas canceladas no pueden repoblarla.

Volver a una sede muestra su caché, indica sincronización y conecta un listener
fresco. Un snapshot local de Firestore sigue marcado como pendiente hasta la
confirmación del servidor. Una falla tiene aviso; no se presenta la copia como
sincronizada. Esto **no** promete cero lecturas en la revisita: se conserva la
sincronización sin listeners permanentes de las sedes inactivas.

Para conservar las funciones que consumían la precarga eliminada se añadió un
cargador puntual de compatibilidad: modo global explícito, sedes seleccionadas
en Compras, analítica abierta por el usuario y CEO activado. Máximo cuatro
consultas simultáneas; ningún listener de inventario por sede inactiva.
`activeStoreIds`, `allInventoryForSearch` y `onMultiStorePurchase` se conservan.
La sede activa sigue actualizando stock en tiempo real incluso en modo global;
las demás son una consulta puntual, con hora y botón de actualización. La
paginación/búsqueda para empresas muy grandes corresponde al BLOQUE 3.

## Línea base reproducible

Las mediciones usan el controlador React real, Header y Developer Center real,
Firebase simulado y pantallas operativas que exponen sus props. Cada sede contiene
un producto sintético; se verifica qué query/listener se abrió, no una latencia ni
una factura Firestore. Los números son **listeners Firestore vivos**, excluyen el
observador de Auth y cuentan la deduplicación efectiva de `storeSubscriptions`.
La tabla usa un administrador de empresa, no el propietario de plataforma.

| Momento | Antes: 3 sedes | Antes: 50 sedes | Después: 3 / 50 / 1.000 sedes |
| --- | ---: | ---: | ---: |
| Antes del login | 4 | 4 | 0 / 0 / 0 |
| Después del login | 26 | 261 | 16 / 16 / 16 |
| POS en primera sede | 20 | 114 | 16 / 16 / 16 |
| Segunda sede | 20 | 114 | 16 / 16 / 16 |
| Regreso a primera sede | 20 | 114 | 16 / 16 / 16 |
| Modo global explícito | 20 | 114 | 16 / 16 / 16 |
| Inventarios vivos en POS | 3 | 50 | 1 / 1 / 1 |

Antes había dos consultas iniciales, además de las cuatro suscripciones sin
filtro. Después: ninguna consulta de negocio antes de enviar login. El fixture
`admin` realiza cuatro búsquedas limitadas de candidatos y tres lecturas por ID:
siete operaciones de consulta. Según las variantes de identificador puede haber
hasta seis búsquedas más los tres documentos. No se descarga el directorio para
hallar al usuario. La lectura de inventario normal es un único listener de sede.

El escenario abre el selector antes de cambiar sede. Se cierran A y B al salir;
A → B → A produce tres conexiones de inventario acumuladas, una viva, y el
regreso usa caché antes de recibir el snapshot. Activar global después de ese
recorrido agrega 3 / 50 / 1.000 consultas puntuales, respectivamente; no agrega
listeners. Es un costo explícito aún proporcional a las sedes solicitadas.

Los JSON `block1-baseline-*` se capturaron antes de modificar App.
Los `block1-after-*` registran el mismo recorrido después. Reproducir:

```bash
TZ=America/Bogota node --experimental-strip-types tests/helpers/measureStartup.mjs 3
TZ=America/Bogota node --experimental-strip-types tests/helpers/measureStartup.mjs 50
TZ=America/Bogota node --experimental-strip-types tests/helpers/measureStartup.mjs 1000
```

No se midieron latencias de red, documentos facturados, tiempos de un Firebase
real ni concurrencia de 1.000 usuarios. Los tests verifican también pausando las
respuestas para observar la caché antes de la resincronización.

## Inventario de suscripciones y trabajo pendiente

| Fuente | Clasificación y alcance después de este bloque |
| --- | --- |
| Auth | Imprescindible global, sin datos de negocio; anónimo heredado |
| `platformDevelopers/{usuario}` | Permiso de sesión; solo tras identificar usuario, omitido para Carlos |
| `platformDevelopers` | Solo Carlos al abrir Developer Center |
| `stores` | Documento activo; directorio por empresa tras solicitarlo; global solo Developer |
| `companies` | Documento de empresa; directorio global solo Developer Center |
| `roles` | Documento del rol propio; directorio empresarial en gestión de roles/usuarios; global solo Developer |
| `sellers` | Identidad propia y vendedores de sede; empresa en gestión/analítica/global solicitado; global solo Developer |
| `categories` | Directorio de empresa, esencial para productos; compatibilidad original descrita abajo |
| `inventory` | Un listener de sede activa compartido; consultas multitienda puntuales explícitas |
| `sales`, `purchases`, `layaways`, `giftVouchers` | Tienda activa según módulo; secundarios POS aún presentes, BLOQUE 2 |
| `customers`, `heldCarts` | Tienda activa en POS/módulos correspondientes; BLOQUE 2 |
| `incidents` | Tienda activa en vistas operativas; queda diferir por módulo en BLOQUE 2/4 |
| `dailyNotes`, `stockTakes`, `productHistory`, `loginHistory`, `payrollHistory` | Según módulo y sede, vía suscripción compartida |
| `daily_notes` | Por empresa; empresa original solo sede activa + `all`, sin bucle por sedes al login; diferir en BLOQUE 2/4 |
| `inventoryTransfers` | Bucle por sedes únicamente dentro de Traslados; rediseño escalable pendiente BLOQUE 4 |
| Dashboard/reportes | `sales`, `layaways`, `incidents` por sede solo al abrir analítica; fanout pendiente BLOQUE 4 |
| CEO | Cuatro colecciones de sedes seleccionadas tras activación, patrón preservado |
| Conciliación | `financialRecords` por sedes; historial solo en modal; no se rediseñó |
| Contabilidad | Gastos, categorías, nómina, movimientos, préstamos y documento chat de sede, al abrir módulo |
| Lector etiquetas | Documento `tagScanningSessions/active_{storeId}` dentro del módulo, validado y con cleanup |

La deduplicación por usuario/empresa/sede/colección se conserva. No se añadió
polling. La inspección de `onSnapshot`/hooks en `components` y `services` identifica
los puntos anteriores; los otros bloques no se ejecutaron.

## Compatibilidad y riesgos concretos

- La autenticación sigue siendo anónima + comprobación heredada de contraseña
  en el cliente. No se habilitó ni desplegó la migración segura de `functions`.
  La solución definitiva es el índice normalizado privado y token con tenant/rol
  del servicio de autenticación ya documentado en `functions/README.md`.
- El esquema no tiene un índice normalizado existente. Se consultan usuario y
  nombre exactos, en las variantes escrita, minúsculas y título, conservando
  comprobación de contraseña y usuarios desactivados. Una capitalización antigua
  irregular o espacios almacenados en el identificador puede exigir escribirlo
  exactamente como fue registrado; no se hace un fallback que descargue todos
  los vendedores ni una migración de identidades. Credenciales ambiguas se
  rechazan en lugar de elegir una empresa arbitraria. Validar usuarios antiguos
  antes de cualquier futura promoción fuera de staging.
- Las búsquedas que alcanzan 20 candidatos se rechazan: un SaaS con nombres de
  usuario repetidos necesita un identificador global único o un selector de tenant
  en el servicio de autenticación, además del índice normalizado.
- Directorios empresariales usan `companyId`. La identidad conocida de usuario,
  sede y rol puede inferir la empresa original en documentos heredados. Listas
  históricas sin `companyId` no se incorporan con una consulta global de directorio.
  Normalizar esas listas requiere una solicitud aparte; no se tocaron documentos.
- Categorías usan query por `companyId`, también en la empresa original. Las
  categorías antiguas sin etiqueta se leen solo por IDs referenciados en
  inventario activo y se validan antes de publicarlas; no se descarga el directorio
  completo de otras empresas. Su actualización sin etiqueta es puntual, al
  entrar/reabrir la sede; no hay un listener por categoría ni migración automática.
- Abrir Dashboard/Conciliación/CEO/Traslados puede aún producir fanout. Activar
  global sigue materializando los inventarios solicitados; requiere paginación
  en el BLOQUE 3 para conjuntos grandes. No ocurre en el arranque normal.
- El build mantiene advertencias por chunks grandes; optimización pendiente del
  BLOQUE 2. No se ajustó el umbral para silenciarlas.
- Typecheck usa la configuración de tipos actual del repositorio. Se corrigieron
  errores preexistentes de `ImportMeta.env` con `vite/client` y de props declaradas
  de AppErrorBoundary. Una evaluación de agregar `@types/react` reveló otros
  errores heredados de contratos de componentes fuera de este bloque; no se
  hizo esa actualización general de dependencias ni se usó `ts-ignore`.
- Esta máquina no tiene las variables Firebase de staging inyectadas. El build
  compila el código, no valida una sesión Firebase real. No se abrió producción
  ni se simularon credenciales de staging. La conexión y las reglas reales quedan
  para la validación manual de staging configurado por el usuario.

## Archivos y validación

- `components/App.tsx`: sesión, directorios, suscripciones activas y adaptador de consultas explícitas.
- `services/storeCache.ts`, `storeSubscriptions.ts`, `useStoreCollection.ts`: caché, deduplicación y estado de sincronización.
- `Header.tsx`, `PosView.tsx`, `PurchasesView.tsx`: solicitudes explícitas de sedes/inventarios; formulario de login en `LoginView.tsx`.
- `AppErrorBoundary.tsx`, `tsconfig.json`: dos correcciones de tipos preexistentes necesarias para el check existente.
- `constants.ts`, `package*.json`, `public/sw.js`: versión, historial y caché 1.1.140.
- Helpers y tests: medición y regresiones de login/caché/tenant/navegación.

### Cierre verificado del código — 2026-10-08

La ejecución interrumpida dejó 67/86 pruebas aprobadas y 19 fallidas. Al reemplazar
el efecto de Novedades se eliminó accidentalmente la declaración que estaba
inmediatamente después: `hasDataAccess = !!currentUser && canAccessCurrentView`.
No había una condición equivalente nueva. Se restauró porque protege la carga
de tienda con identidad y permisos de vista, además de las condiciones de Auth,
empresa/sede autorizada y contexto operativo de `canLoadStore`. No se quitó el
control ni se capturó el ReferenceError para ocultarlo.

El typecheck del cierre detectó otra regresión del mismo efecto: inferencia de
`Set<unknown>` al reunir IDs de sedes. Se declaró `Set<string>` y el tipo `Store`
del callback; no se suprimieron errores ni se alteraron las validaciones tenant.
Las sedes referenciadas por Novedades se consultan puntualmente con `companyId`
y document ID, se validan y cachean como `storeMetadata` dentro de los mismos
límites. No requieren precargar inventarios o el directorio completo.

Resultados finales, todos con `TZ=America/Bogota`:

| Comando | Resultado |
| --- | --- |
| `npm run test:performance` | 86/86 aprobadas; 0 fallidas, canceladas u omitidas |
| `npm run lint` (`tsc --noEmit`) | Aprobado, salida 0 |
| `npm run build` | Aprobado, salida 0; advertencia existente de chunks >500 kB |
| `git diff --check` | Aprobado, salida 0 |

Logs de este cierre en `/tmp/vestika-block1-closure-{tests,typecheck,build}.log`.
La suite verifica cero listeners y cero consultas de negocio antes de login;
un listener de inventario activo en login/POS/cambio/revisita/global;
coste de listeners de arranque constante con 3, 50 y 1.000 sedes; aislamiento
de empresa/sede/usuario, caché, permisos, deduplicación y callbacks tardíos.
No se declararon pruebas obsoletas, se eliminaron tests o se redujeron aserciones.

Incluyen pruebas existentes de ventas, validaciones de escrituras,
conciliación y callbacks tardíos; nuevas pruebas de 3/50/1.000 sedes, caché antes
de red, LRU/TTL/tamaño, aislamiento por usuario/empresa/sede, deduplicación,
doble login, rechazo de credenciales ambiguas y tenant inválido, activación
explícita global, actualización de stock activo, consulta tardía tras cambiar
empresa y cambios de rol del Developer fuera de su empresa original.

### Configuración Firebase y límite de la verificación

`firebase.ts`, reglas, configuración Firebase y datos no se modificaron. Firebase
se inicializa exclusivamente desde las variables `VITE_FIREBASE_*`; no existe
fallback de configuración de producción. El guard existente rechaza configuración
incompleta, y rechaza el proyecto de producción en un entorno no productivo si
`VITE_FIREBASE_PRODUCTION_PROJECT_ID` está definido. Este guard no constituye una
comprobación positiva de que el proyecto sea `vestika-staging`.

En este workspace están ausentes `VITE_APP_ENV` y las siete variables Firebase
necesarias. No se puede certificar el destino del despliegue staging ni una sesión
Firebase real desde aquí. El build aprobado es una compilación optimizada, no un
despliegue ni una conexión a Firebase. Las 86 pruebas usan Firebase simulado.
La comprobación del proyecto real queda pendiente de los pasos manuales siguientes;
no se inventaron credenciales ni se accedió a producción.

Rama de trabajo confirmada: `develop/safe-staging-performance`, HEAD `7ffd25d`.
La referencia local `main` continúa en `30e818fddeab20eeac39271d905fbc8b9fc511e4`,
sin commits, merge, push ni despliegue de este trabajo. El cierre conserva la
versión local aún no publicada 1.1.140 y su historial/cache de service worker.

## Qué probar manualmente en staging

1. Antes de abrir la aplicación, verificar en la configuración del despliegue
   **de staging**: `VITE_APP_ENV=staging`, emuladores desactivados,
   `VITE_FIREBASE_PROJECT_ID=vestika-staging`,
   `VITE_FIREBASE_AUTH_DOMAIN=vestika-staging.firebaseapp.com` y
   `VITE_FIREBASE_STORAGE_BUCKET=vestika-staging.firebasestorage.app`.
   Confirmar que las demás variables corresponden a ese mismo proyecto, sin
   publicar sus valores. En DevTools → Network, las solicitudes Firestore deben
   referir `projects/vestika-staging/databases/(default)`; si aparece otro proyecto,
   detener la prueba. Usar únicamente la URL staging, no la URL de producción.
   Entrar con
   `stagingadmin`; solo `Vestika Staging`, `Tienda Pruebas` y los tres productos TEST.
   POS permite una venta de prueba sin necesitar inventarios de otras sedes.
2. Abrir el selector de sede y confirmar que el directorio aparece sin quedar
   bloqueado. Para A → B → A se necesitan dos sedes **sintéticas** de staging;
   no se crearon aquí ni se copiaron datos reales. Primera visita espera datos
   propios; revisita muestra caché con aviso hasta confirmar servidor.
3. Con Developer autorizado y dos empresas sintéticas, repetir cambios de
   empresa/sede. Ningún frame, modal, cliente, stock o vendedor pertenece a la
   empresa anterior. Un vendedor ordinario no puede abrir Developer ni cambiar
   a sedes fuera de su permiso.
4. Activar global directamente tras login: consulta solo sedes de la empresa
   actual. Desactivarlo devuelve inventario local. En Compras seleccionar otra
   sede conserva el reparto por `activeStoreIds`. Actualizar consulta refresca
   las sedes inactivas, sin listeners permanentes por inventario.
5. Cambiar stock en otra sesión de prueba: sede activa actualiza en vivo. Probar
   pérdida de red y posterior reconexión: caché avisa que falta sincronizar;
   un fallo no se presenta como éxito.
6. Validar identificadores heredados con mayúsculas/nombres y permisos de rol;
   abrir Dashboard/reportes/CEO explícitamente y comprobar sus datos solicitados.

No se publicó esta rama ni se desplegó staging o producción. El código del bloque
queda validado automáticamente; la conexión Firebase real y las pruebas manuales
de staging permanecen pendientes. No se inició BLOQUE 2.
