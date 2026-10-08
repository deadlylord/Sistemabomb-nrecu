# BLOQUE 2 — POS progresivo y funciones bajo demanda (1.1.143)

Rama exclusiva: `develop/safe-staging-performance`, base `93c9df4` (1.1.142).
El usuario autorizó continuar el Bloque 2 y dejar pendiente la medición exacta
del login. No se cambió el login, autenticación, backend, reglas, índices,
configuración Firebase ni datos. No se inició BLOQUE 3.

## Línea base y alcance

La base se comprobó antes de editar: 95/95 pruebas y build optimizado aprobados,
con `TZ=America/Bogota`. El POS mantenía 16 listeners iniciales para el fixture
administrador con 3, 50 o 1.000 sedes, aun sin abrir funciones secundarias.
Es el mismo controlador real y escenario simulado documentado en BLOQUE 1;
no son mediciones de latencia del móvil, facturación o conexión Firebase real.

Dependencias identificadas en el POS:

| Datos | Uso real | Carga después del cambio |
| --- | --- | --- |
| Inventario/categorías | Búsqueda, stock, precios, productos | Inmediata, tienda activa; categorías del tenant |
| Empresa/tienda/rol/identidad/vendedores | Configuración, selector vendedor, medios de pago y recargos | Se conserva la carga esencial y sus validaciones |
| Compras | Categoría de novedades y rendimiento de productos | Progresiva después del frame de inventario; explícita al pedir rendimiento |
| Apartados | Avisos de encargos y reporte | Progresiva; explícita al abrir reporte |
| Incidents | Avisos, resumen de pendientes y reporte | Progresiva; explícita al abrir resumen/reporte |
| Held carts | Ventas en espera y retomar | Progresiva, sin ocultar permanentemente la funcionalidad |
| Sales | Orden de negocio, rendimiento, reporte, historial de una novedad/bono | Tras la acción correspondiente |
| Customers | Autocompletar en venta/apartado, novedad y venta de bono | Al abrir la función; entrada manual de cliente sigue disponible |
| Gift vouchers | Consultar o redimir un bono | Consulta explícita o foco/escritura del código en cobro; efectivo no los solicita |
| DailyNotes | Reporte diario | Al abrir reporte; ahora se solicita su colección de tienda explícitamente |
| Daily_notes CEO | El POS escribe un registro, pero no consume su historial | Listener desactivado en POS; otros módulos conservan su carga |

Después del primer frame con inventario disponible se agenda una única tarea
ociosa para compras, apartados, incidents y held carts. Usa requestAnimationFrame
y requestIdleCallback (timeout configurado de 1.500 ms, no tiempo medido); fallback
setTimeout de una sola ejecución. No añade polling. Se cancela al salir/cambiar
contexto y no espera historias para mostrar catálogo o abrir el cobro.

Los datos pedidos quedan conectados durante esa visita al POS, para conservar
sus actualizaciones. Al salir se eliminan las demandas del POS; otras pantallas
retienen únicamente sus propias dependencias. Cambiar tienda/empresa/usuario
invalida demandas, tareas y callbacks de la visita anterior, incluso A → B → A.
Los listeners siguen compartidos por storeSubscriptions y tenant/store/type.
No se alteraron assertTenantData ni validaciones previas a escrituras.

## Cambios de interfaz y sincronización necesarios

- Reporte, consulta de bono, rendimiento y formulario de novedades esperan los
  datasets correspondientes con un estado explícito y botón Cerrar. Un resultado
  pendiente o fallido no se muestra como lista vacía confirmada.
- Cobro puede operar en efectivo sin historial de ventas, compras o bonos.
  Clientes llegan para autocompletar; su falla no bloquea introducir datos
  manualmente. Un cliente tardío rellena únicamente un nombre todavía vacío.
- Redimir queda bloqueado mientras los bonos no están sincronizados o hubo error,
  evitando declarar falsamente inexistente un bono que aún no llegó.
- Avisos, encargos, ventas en espera y novedades de productos muestran estado
  progresivo; el resumen automático espera incidents y apartados para no marcarlo
  como revisado antes de recibirlos.
- El POS se remonta por contexto operativo para cerrar todos los formularios al
  cambiar sede. Búsqueda, categoría y orden se conservan mediante ViewFiltersProvider
  dentro del mismo usuario/empresa. Si el usuario ya eligió un orden de negocio,
  al cambiar sede se carga el historial de esa sede para conservar ese orden.
- useStoreCollection marca pendiente una nueva activación, aunque una visita
  anterior de esa misma colección hubiera quedado sincronizada.

Se separaron mediante lazy/Suspense los modales de cobro, reporte, rendimiento,
novedad, venta/consulta de bono y edición de producto/imagen. Los formularios no
montan componentes pesados al entrar. Existe feedback de carga con cierre;
AppErrorBoundary sigue manejando errores de módulos. No se rediseñaron ventas,
abonos, conciliación ni formularios de escritura.

## Comparación verificable

Conteos de conexiones Firestore **vivas** con Auth simulado, no peticiones HTTP.
El fixture es administrador ordinario con orden alfabético; Carlos propietario
no necesita el listener de su grant y tendrá uno menos.

| Momento | Antes | Después, 3 / 50 / 1.000 sedes |
| --- | ---: | ---: |
| Antes de login | 0 | 0 / 0 / 0 |
| POS esencial, antes de la tarea progresiva | 16 | 8 / 8 / 8 |
| POS después de la tarea progresiva | 16 | 12 / 12 / 12 |
| Segunda sede / regreso a primera, tras tarea progresiva | 16 | 12 / 12 / 12 |
| Inventarios vivos | 1 | 1 / 1 / 1 |
| Lecturas puntuales de login del fixture | 7 | 7 / 7 / 7 |

El modo global explícito conserva 12 listeners en el escenario y añade consultas
puntuales proporcionales a las sedes solicitadas (3/50/1.000), igual que el
adaptador del BLOQUE 1. No se cambió ni optimizó ese cargador: es BLOQUE 3.

Los resultados compactos están en `block2-measurements.json`; los archivos completos
de esta ejecución quedaron en `/tmp/vestika-block2-after-{3,50,1000}.json`.
El helper ahora captura la fase `essential` antes de ejecutar determinísticamente
la tarea ociosa. Reproducir los mismos comandos de measureStartup del BLOQUE 1.

Build Vite (tamaño de cada archivo, no suma de todas sus dependencias):

| Archivo | Base | Después |
| --- | ---: | ---: |
| PosView | 103,19 kB; gzip 24,07 kB | 56,62 kB; gzip 14,17 kB |
| App | 1.173,15 kB; gzip 286,94 kB | 1.177,18 kB; gzip 288,35 kB |
| PaymentModal | Dentro de importación del POS | Archivo diferido de 15,63 kB; gzip 4,59 kB |
| DailySalesReportModal | Dentro de importación del POS | Archivo diferido de 13,49 kB; gzip 3,61 kB |
| ProductPerformanceModal | Dentro de importación del POS | Archivo diferido de 13,82 kB; gzip 3,97 kB |

Son tamaños de la compilación final, después de comprobar la preservación de
filtros. App continúa alrededor de 1,17 MB y mantiene la advertencia
de chunks grandes: no se afirma que toda la aplicación tenga el tamaño de PosView.
No se inventan milisegundos/porcentajes de mejora del login.

## Verificación

- Suite completa: 103/103 pruebas, ninguna omitida o cancelada.
- Typecheck aprobado: `TZ=America/Bogota npm run lint` (`tsc --noEmit`), salida 0.
- Build aprobado: `TZ=America/Bogota npm run build`, salida 0.
- `git diff --check` aprobado, salida 0.

Logs finales: `/tmp/vestika-block2-final-{tests,typecheck,build}.log`.
Las 8 pruebas nuevas ejercitan controlador y POS/cobro/reporte reales con Firestore
simulado: esenciales antes de idle, carga por acción, deduplicación, contexto
A-B-A/cambio de empresa/logout, caché offline/error, cobro efectivo sin historias,
escrituras scoped, reporte pendiente, bonos filtrados y filtros persistentes.
Las dos pruebas existentes que esperaban histories/incidents de inmediato ahora
solicitan esos datos antes de sus mismas aserciones de aislamiento y callbacks.
No se deshabilitaron pruebas ni se relajaron las validaciones de tenant.

## Límites y comprobaciones manuales de staging

La medición exacta de los ~4 segundos del login sigue pendiente. El handler no
cambió; este bloque mejora el trabajo posterior al login. La red del workspace
bloquea Netlify y no hay variables Firebase de staging inyectadas, por lo que las
pruebas no certifican una sesión real ni reglas Firestore. No se conectó producción.

Las consultas bajo demanda siguen leyendo la colección relevante de la tienda;
no requieren nuevos índices Firestore.
no se añadieron paginación o filtros que recorten historial funcional. Hay costo
al solicitarlo y cuatro datasets progresivos se mantienen vivos en POS. Un informe
necesita confirmación de servidor para considerarse listo; ante fallo permanente
de listener puede ser necesario cambiar sede o recargar para reintentar.

POS conserva su comprobación histórica del nombre de rol `Administrator` para
ciertas opciones visuales (orden/edición); no se modificó ese permiso en este bloque.
El fixture del test de orden usa ese rol; un administrador con otro nombre que no
vea esas opciones tiene un comportamiento previo a este cambio, no una autorización
Developer que deba añadirse.

En el despliegue **staging** conectado a vestika-staging, después de incorporar
estos cambios (no se desplegaron desde este workspace):

1. stagingadmin: catálogo de la sede actual; observar carga progresiva de avisos,
   encargos, ventas en espera y categoría de novedades, sin inventario de otra sede.
2. Venta de prueba en efectivo y con QR: cliente manual/autocompletado, vendedor,
   descuento, quitar/restaurar recargo por pago, guardar y confirmar recibo/stock.
3. Apartado/encargo, retomar venta en espera, reporte diario/notas y crear novedad:
   confirmar que las funciones reciben sus datos y el guardado confirma éxito.
4. Bono de prueba: consultar, abrir cobro, ingresar código y esperar sincronización
   antes de redimir. Un código de otra tienda/empresa nunca debe aparecer.
5. Repetir A → B → A con búsqueda/categoría/orden elegidos; abrir un modal y cambiar
   sede: modal cerrado, filtros conservados y datos de la nueva sede. Developer debe
   conservar sus permisos al cambiar empresas de prueba.

El usuario autorizó publicar este bloque exclusivamente mediante commit y push a
`develop/safe-staging-performance`. El despliegue automático de staging debe
comprobarse en Netlify. No hay merge a main ni despliegue de producción; no se
modificaron reglas, datos históricos, cuentas de prueba ni seeds. BLOQUE 3 no se
ejecutó.
