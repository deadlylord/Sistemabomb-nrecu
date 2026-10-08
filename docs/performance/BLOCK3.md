# BLOQUE 3 — Compras global/multitienda bajo demanda

Rama: `develop/safe-staging-performance`. Base: `b7220c9`.
Versión: `1.1.144`. El usuario autorizó commit y push de este bloque únicamente a
`develop/safe-staging-performance` para activar el despliegue automático de staging.
La finalización del despliegue y la versión visible no se pudieron verificar desde
este entorno: la URL staging y la API de GitHub devuelven 403 por acceso de red.

## Causa y alcance

El BLOQUE 1 ya había sustituido la precarga por consultas puntuales. Sin embargo,
el efecto reconstruía toda la búsqueda al cambiar cualquier selección: añadir o
quitar una sede volvía a consultar las que seguían seleccionadas. El modo global
también consultaba la sede activa aunque POS/Compras ya tenían su listener.

Al guardar una compra, `findCompanyProducts` consultaba cada sede accesible para
buscar el nombre del producto, y el handler volvía a buscarlo en las destinatarias.
Con N sedes autorizadas y K destinatarias eran N+K consultas de inventario por
producto, aparte de las lecturas de validación del writer.

La pantalla ya se desmontaba por la key de `main` al cambiar sede/módulo. El riesgo
pendiente estaba en solicitudes y handlers asíncronos conservados por el controlador.
Se mantiene ese desmontaje y se validan contexto y visita antes de solicitar datos
y antes de preparar/confirmar una escritura.

Solo se aborda este bloque. Login, ventas, conciliación, reglas, seeds y datos
históricos no se modifican. Dashboard/CEO conservan su activación explícita; no se
rediseñan sus listeners de historial (BLOQUE 4).

## Implementación

- Controlador de consultas puntuales con un máximo de cuatro solicitudes en curso.
  Añadir sedes consulta únicamente las nuevas; quitar una invalida su solicitud.
  Un fallo individual se muestra y permite terminar otras consultas válidas.
- La sede activa utiliza su listener existente en POS/Compras. Si un consumidor
  como CEO no tiene ese listener, conserva su consulta puntual para obtener stock
  fresco al activarse. No se crea un listener por cada sede del modo global.
- Caché de sesión existente por usuario/empresa/sede/tipo: LRU de 20 entradas,
  50.000 filas y 16 MiB, TTL de cinco minutos. Las consultas comienzan mostrando
  caché como pendiente y luego sincronizan. Datos offline no renuevan el caché ni
  se etiquetan como confirmados. La consulta puede actualizarse explícitamente.
- Resultados fuera del tenant/sede solicitados se descartan antes de mostrarse o
  cachearse. Respuestas de jobs cancelados/contextos anteriores no escriben caché.
  SDK Firestore no permite abortar estas llamadas ya enviadas: se ignoran los
  resultados y se detiene la cola. No se añade polling.
- `activeStoreIds`, `allInventoryForSearch` y `onMultiStorePurchase` se preservan.
  La búsqueda de Compras utiliza las sedes seleccionadas más el catálogo activo;
  filtros y búsqueda persisten en la misma empresa. Lotes/modales no pasan a otra sede.
- Mientras la consulta está pendiente o falla, Compras no afirma que un producto
  no existe, no permite seleccionar datos sin confirmar ni finalizar el lote.
- Guardar busca cada producto únicamente en K destinatarias, con `limit(1)` y
  concurrencia cuatro. Se reutiliza ese resultado al preparar el batch; no hay
  segundo escaneo por destino. Tenant writer y todas sus validaciones permanecen.
  Tras confirmar el batch se invalida el caché de destinos y se actualiza la
  consulta activa. Un cambio de sede/empresa/módulo durante la búsqueda cancela
  el guardado anterior antes de enviar el batch.

Compatibilidad de metadatos: se reutiliza el primer producto encontrado en las
destinatarias; si no existe allí, el catálogo activo/solicitado puede aportar
imagen, descripción y SKU. Ya no se inspeccionan tiendas no solicitadas para buscar
esos metadatos. Comprobar SKU/imagen/categoría al comprar en otra sede donde el
producto todavía no existe. No se modifica ningún documento histórico.

## Medición verificable

Controlador App real, React test renderer y SDK simulado. Son conteos de consultas
y conexiones, **no tiempos reales de red ni lecturas facturadas por Firebase**.
Datos: `block3-measurements.json`.

| Escenario | Base | Después |
| --- | ---: | ---: |
| Pre-login: listeners de negocio | 0 | 0 |
| Login / Compras normal: consultas de inventarios inactivos | 0 | 0 |
| Seleccionar A1 → añadir A2 → quitar A2: consultas acumuladas | 4 | 2 |
| Luego activar global en esas tres sedes: consultas acumuladas | 7 | 3 |
| Global recién activado: 3 / 50 / 1.000 sedes | 3 / 50 / 1.000 | 2 / 49 / 999 |
| Listeners vivos de inventario en POS/Compras | 1 | 1 |
| Consultas por producto comprado en K de N sedes | N+K | K |

Con 3, 50 y 1.000 sedes el arranque conserva 8 listeners esenciales, 12 después
de la tarea progresiva del POS, uno de inventario y cero consultas puntuales de
inventarios ajenos. El modo global de todas las sedes sigue teniendo costo O(N)
porque fue solicitado explícitamente; su catálogo completo no se descarga al login.
Si se quita y después se vuelve a pedir una sede, aparece caché y se revalida; no se
presenta ese caché como definitivo. El caso de compra con N=1.000 y K=2 verifica
exactamente dos consultas de producto; las lecturas de validación de documentos y
categorías del writer se conservan y no se incluyen en ese conteo.

## Archivos

- `components/App.tsx`: demanda por contexto, integración, selección de queries y
  guardado limitado a destinatarias.
- `components/PurchasesView.tsx`: selección autorizada, estado de búsqueda y filtros.
- `services/requestedInventory.ts`, `services/useRequestedInventory.ts`: cola,
  sincronización, validación y descarte de solicitudes anteriores.
- `services/storeCache.ts`: invalidación puntual después de una compra confirmada.
- `tests/requestedInventory.test.mjs`: once regresiones de cola, caché, tenant,
  guardado, cambios de contexto y compatibilidad CEO.
- `tests/helpers/developerSession.mjs`: soporte del módulo real y escrituras simuladas.
- `tests/startupIsolation.test.mjs`: expectativa global N−1 y comprobación adicional
  de caché de una sede inactiva después de cambiar de empresa.
- `package.json`, `package-lock.json`, `constants.ts`, `public/sw.js`: versión,
  historial y caché del service worker.
- Este informe y `block3-measurements.json`.

## Verificación final

Baseline aprobado: 103/103. Verificación final, incluida compatibilidad CEO:

- `TZ=America/Bogota npm run test:performance`: **114/114 aprobadas**, cero fallos,
  omisiones o cancelaciones; salida 0.
- `TZ=America/Bogota npm run lint` (`tsc --noEmit`): aprobado, salida 0.
- `TZ=America/Bogota npm_config_cache=/workspace/.npm-cache npm run build`:
  aprobado, salida 0. Permanece la advertencia existente de chunks mayores de 500 kB.
- `git diff --check`: aprobado, salida 0.

El primer build falló al acceder al caché predeterminado de npm fuera del workspace;
se repite usando el caché permitido, sin cambiar dependencias ni omitir pasos.
Logs: `/tmp/vestika-block3-final-{tests,typecheck,build}.log`.

No se requieren índices nuevos: las consultas de búsqueda usan el `storeId` ya
existente y las de compra conservan los filtros `storeId + name` y `limit(1)`.
No se modifican Firebase/Netlify/configuración/reglas. No hay credenciales Firebase
de staging inyectadas en este workspace: las verificaciones usan mocks y no
certifican reglas ni una sesión real en `vestika-staging`.

## Pruebas manuales, exclusivamente en vestika-staging

Después de incorporar estos cambios al despliegue de la rama staging:

1. Ingresar con stagingadmin en Tienda Pruebas; comprobar versión 1.1.144. Abrir
   Compras en modo normal: catálogo de esa sede. Seleccionar Tienda Pruebas 2:
   esperar sincronización y buscar sus tres productos TEST. Quitarla: sus productos
   exclusivos deben salir de los resultados; volver a seleccionarla sincroniza.
2. Activar/desactivar el botón global/casa. Ver únicamente productos de las dos
   tiendas staging. Con el global activo, cambiar A → B → A: inventario activo
   actualizado, sin duplicados; los filtros de Compras se conservan y el lote/modal
   de la visita anterior se cierra.
3. Comprar **un producto TEST** para ambas sedes, con cantidades diferentes. Esperar
   confirmación; comprobar el incremento correcto en cada inventario y su historial
   de Compras después de recargar. Para un TEST que aún no existe en B, comprobar
   imagen/SKU/categoría. No borrar la venta de prueba existente.
4. Mantener el global abierto y, en otra sesión staging, cambiar el stock de un TEST
   de la sede inactiva con una operación normal. La consulta indica su hora; pulsar
   **Actualizar consulta** y comprobar el cambio. La sede activa sigue en vivo.
5. Con conexión desconectada, pedir una sede no consultada: debe aparecer estado
   pendiente/error, no “producto nuevo” como resultado definitivo ni guardado de
   lote habilitado. Reconectar y pulsar Actualizar consulta. Durante carga, cambiar
   sede/empresa o salir del módulo; no deben reaparecer resultados anteriores.
6. Como stagingdeveloper, repetir cambios de empresa solo entre empresas de prueba
   autorizadas. CEO Center permanece en pausa hasta pulsar **Cargar y analizar**;
   debe mostrar stock actualizado de la sede elegida y funcionar en “todas”.

Pendiente: validación real de staging, medición del login móvil y paginación/búsqueda
de catálogos globales enormes. Una consulta completa de todas las sedes sigue
descargando todos los productos solicitados; concurrencia limitada no elimina ese
costo explícito. El lote de varios productos sigue procesándose por producto como
antes; no se rediseña atomicidad global ni conciliación. BLOQUE 4 no se ejecutó.
