# Conciliación 1.1.161: activación en staging

Fecha: 16 de octubre de 2026. Proyecto `vestika-staging`, región `southamerica-east1`. El servidor está desplegado y las dos sedes existentes tienen resúmenes verificados. Esta versión habilita `VITE_FINANCIAL_LEDGER_INDEXED=true` únicamente en el contexto Netlify de staging. Producción no se modifica. El usuario confirmó el ingreso con identidad verificada desde su navegador.

## Cambios

- El libro consulta una página de 50 movimientos de la cuenta y los resúmenes de la sede y del mes. No abre suscripciones al histórico de otras sedes ni descarga el detalle del mes al entrar.
- Cierres de Caja empieza cerrado. Su detalle mensual se consulta al abrir la sección y se cancela al cerrarla. Mientras carga, no se ofrecen botones de conciliación con un estado parcial.
- Abrir un cruce consulta 50 movimientos; Cargar más consulta la siguiente página. El saldo acumulado usa el resumen completo. Las exportaciones siguen leyendo el historial completo por páginas, con un máximo de cuatro consultas de sedes en paralelo, sin insertar todo lo exportado en la pantalla.
- Siguiente conserva la página al recibir los movimientos cargados y muestra un error recuperable si falla. El modal muestra las sedes con saldo aunque su detalle todavía no se haya abierto. Su búsqueda indica que actúa sobre movimientos cargados.
- El procesador lee la fuente actual dentro de una transacción y compara su versión para tolerar eventos repetidos o desordenados. Si un documento inválido impide actualizar, retira `ready` de los resúmenes afectados y registra el motivo privado. Una corrección elimina el diagnóstico, pero requiere una nueva verificación para activar el resumen.
- `verifyStagingFinancialLedger.mjs` compara en una transacción las versiones de fuentes, estados privados, saldos, cruces y categorías mensuales. Antes de activar exige las reglas verificadas de staging. No reconstruye históricos ni acepta otra base/proyecto. Tiene un límite explícito de 5.000 fuentes por sede; para historiales mayores hay que preparar la construcción paginada y una ventana de mantenimiento.

## Configuración aplicada y reintentos

El usuario autorizó expresamente desplegar solo `financialLedgerChanged` en staging con reintentos y un máximo de cinco instancias. La revisión automática anterior quedó resuelta con esa autorización. La primera creación falló mientras se propagaba Eventarc; se comprobó por lectura que su agente ya tenía el rol necesario y el siguiente despliegue funcionó, sin añadir permisos IAM.

Configuración final leída de Google Cloud: segunda generación, Node.js 22, `maxInstances: 5`, `minInstances: 0`, `concurrency: 4`, 256 MiB y 60 segundos por ejecución. Las instancias son copias del mismo procesador compartidas por las sedes; no definen su separación de datos. Los límites son de capacidad, no un presupuesto monetario.

Se corrigió el aviso genérico del CLI: la documentación oficial establece **24 horas para segunda generación**, frente a siete días para primera generación. La suscripción creada confirmó `messageRetentionDuration: 86400s`, con esperas de reintento entre 10 y 600 segundos. Referencia: https://firebase.google.com/docs/functions/retries . Los errores permanentes de datos detectados se registran y terminan; los fallos transitorios se relanzan. Cada ejecución y las operaciones de base de datos pueden facturarse. No se midió ni se estimó una factura.

## Pruebas y mediciones

- 36/36 pruebas focalizadas: proyección, páginas de cuenta/cruces, carga mensual a demanda, interfaz de paginación y aislamiento del escritor. La simulación de agregación mantiene separados 100 locales con 50.000 movimientos; la interfaz renderiza 50 de 5.000 filas. No son mediciones de dispositivos de la tienda.
- Compilación con identidad verificada y proyección indexada activadas por entorno: aprobada, 8,24 segundos. Suite general: 122/130 aprobadas, con los mismos ocho fallos anteriores de navegación/recuperación. Typecheck conserva los tres errores anteriores de `AppErrorBoundary`.
- Cuatro ejecuciones desplegadas con empresas/sedes ficticias: cada una creó 60 cruces (120 contrapartes) y 20 gastos. Pasaron las mismas 19 comprobaciones: login de prueba, saldos históricos, páginas 50+30 de cuenta y 50+10 de cruces, ausencia de duplicación entre páginas, permisos de vendedor/administrador, bloqueo entre sedes/empresas, protección del estado privado y de los resúmenes, edición de cuenta/fecha/monto, eliminación y restauración, invalidación por datos incorrectos y reactivación solo tras verificar. Se eliminaron los registros, cuentas y documentos temporales creados.
- La configuración predeterminada de 80 eventos por instancia dejó 49.203 ms y 31.432 ms de espera observada del lote, con errores de contención. Una prueba con concurrencia 1 dejó 34.789 ms y respuestas temporales 429 al alcanzar capacidad. Se mantuvieron cinco instancias y se ajustó a concurrencia 4.
- Resultado final con concurrencia 4: confirmación de escritura mediana 355 ms y máxima 3.352 ms; observación del cambio individual de un cruce en 1.429 ms; lote completo observado 10.160 ms después de confirmar el último guardado; primera página de cuenta 202 ms y de cruce 243 ms. Estas cifras incluyen la red del entorno y sondeo. El último sondeo fue cada segundo; las primeras pruebas, cada cuatro segundos. Son muestras orientativas, no una garantía de latencia ni un estudio de capacidad.
- Se volvió a verificar y activar transaccionalmente `staging_store_01` y `staging_store_02`: cero fuentes históricas y cero meses. No hubo que migrar ni modificar movimientos de estas sedes. Las reglas verificadas no se cambiaron.

## Límites antes de producción

Staging no contiene un histórico representativo. Faltan pruebas visuales completas de ventas, abonos, cierres, exportaciones concurrentes, perfiles Developer, nuevas empresas y tienda online. Las búsquedas, cierres mensuales y exportaciones completas pueden leer más de 50 registros cuando se solicitan; el límite de 50 corresponde a las páginas del libro y del detalle de cruces. La proyección es asíncrona: confirmar el movimiento y actualizar el resumen son pasos distintos.

Antes de producción hay que revisar sus datos y consultas históricas, preparar y verificar la construcción por sede, medir carga real y evaluar la contención de resúmenes. No se promete capacidad ilimitada ni se publica automáticamente esta configuración en producción. Si una sede no tiene `ready: true` y el esquema esperado, el cliente conserva la lectura histórica acotada a esa sede.
