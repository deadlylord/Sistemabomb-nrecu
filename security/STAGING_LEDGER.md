# Conciliación 1.1.161: candidata pendiente de despliegue

Fecha: 16 de octubre de 2026. Alcance autorizado: `vestika-staging`, región `southamerica-east1`. La web de staging sigue en 1.1.160, con identidad verificada y la bandera financiera indexada apagada. Producción no se modifica. El usuario confirmó el ingreso desde su navegador.

## Cambios revisables

- El libro consulta una página de 50 movimientos de la cuenta y los resúmenes de la sede y del mes. No abre suscripciones al histórico de otras sedes ni descarga el detalle del mes al entrar.
- Cierres de Caja empieza cerrado. Su detalle mensual se consulta al abrir la sección y se cancela al cerrarla. Mientras carga, no se ofrecen botones de conciliación con un estado parcial.
- Abrir el historial de un cruce consulta 50 movimientos; Cargar más consulta la siguiente página. El saldo acumulado usa el resumen completo. Las exportaciones siguen leyendo el historial completo por páginas, con un máximo de cuatro consultas de sedes en paralelo, sin insertar todo lo exportado en la pantalla.
- Siguiente conserva la página al recibir nuevos movimientos cargados y muestra un error recuperable si falla. El modal de cruces muestra las sedes con saldo aunque su detalle todavía no se haya abierto. La búsqueda del modal indica que actúa sobre movimientos cargados.
- El procesador está ubicado junto a Firestore, en `southamerica-east1`. Lee la fuente actual dentro de una transacción y compara su versión para tolerar eventos repetidos o desordenados. Si un documento inválido impide actualizar, retira `ready` de los resúmenes afectados y registra el motivo privado. Una corrección elimina el diagnóstico, pero requiere una nueva verificación para activar el resumen.
- `verifyStagingFinancialLedger.mjs` compara en una transacción las versiones de las fuentes, estados privados, saldos, cruces y categorías mensuales. Antes de activar exige las reglas verificadas de staging. No reconstruye históricos ni acepta otra base/proyecto. Este verificador de pruebas tiene un límite explícito de 5.000 fuentes por sede; para historiales mayores hay que preparar la construcción paginada y una ventana de mantenimiento.

## Comprobado

- 36/36 pruebas focalizadas: proyección, páginas de cuenta/cruces, carga mensual a demanda, interfaz de paginación y aislamiento del escritor. La simulación de agregación mantiene separados 100 locales con 50.000 movimientos; la prueba de la interfaz renderiza 50 de 5.000 filas. Son pruebas controladas, no una medición de velocidad de las tiendas.
- Compilación con identidad verificada y proyección indexada activadas por entorno: aprobada, 8,24 segundos.
- Suite general: 122/130 aprobadas. Los ocho fallos son los mismos de navegación/recuperación registrados en 1.1.160. Typecheck conserva tres errores anteriores de `AppErrorBoundary`; no aparecieron errores nuevos.
- Consulta administrativa de staging: dos sedes, cero movimientos al revisar; sin contradicciones de empresa/sede. Verificación transaccional sin escrituras de `staging_store_01`: aprobada, cero fuentes y cero meses.
- Las reglas no se modifican en esta candidata. La función nueva no está desplegada; se verificó que permanecen activas únicamente las tres funciones de identidad existentes. No se activaron resúmenes ni se añadieron datos de carga ficticios.

## Autorización operativa pendiente

La primera ejecución de Firebase pidió `--force` para confirmar la política de reintentos de esta función. La revisión automática rechazó ese paso porque Firebase puede reintentar fallos transitorios durante hasta siete días, y cada intento puede facturarse. No se eludió el rechazo cambiando de herramienta o deshabilitando la política.

Autorización solicitada: desplegar **solo** `financialLedgerChanged` en `vestika-staging`, con `retry: true` y `maxInstances: 5`, aceptando esos reintentos y su posible facturación. Los errores permanentes de datos se registran y finalizan; los fallos transitorios se relanzan. El límite de instancias limita concurrencia, no garantiza un límite monetario.

Comando concreto, pendiente de esa autorización:

```sh
npx -y firebase-tools@latest deploy --config firebase.staging.json --project vestika-staging --only functions:vestika-identity:financialLedgerChanged --non-interactive --force
```

## Después de autorizar

1. Desplegar y comprobar la función, manteniendo la web indexada apagada.
2. Probar con empresa/sedes ficticias la actualización real de resúmenes, paginación y saldos tras crear, editar, borrar y restaurar contrapartes. Verificar bloqueo de otra empresa y de escrituras de clientes a la proyección. Limpiar los datos y cuentas temporales.
3. Volver a revisar los datos actuales de las sedes de staging, proyectar lo que falte y activar únicamente los resúmenes que superen la verificación transaccional.
4. Poner `VITE_FINANCIAL_LEDGER_INDEXED=true` solo en el contexto de staging, publicar esta versión allí y comprobar los archivos servidos y la interfaz. Registrar tiempo de confirmación de escritura y tiempo de actualización del resumen por separado.
5. Completar pruebas de ventas, abonos, cierres y permisos antes de decidir producción. Staging no contiene un histórico representativo: no se promete una velocidad definitiva ni capacidad ilimitada sin medir carga real, búsquedas, exportaciones y contención de resúmenes por sede.
