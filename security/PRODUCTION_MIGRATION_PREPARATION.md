# Preparación de migración de producción

Estado: preparación local; sin despliegue, activación ni escrituras remotas.

## Evidencia disponible

La revisión de solo lectura de `factura2-6e811` (Firestore Standard, nam5) del 16 de octubre de 2026 a las 22:35 de Bogotá cubrió 3 empresas, 7 sedes, 17 perfiles y 5.580 movimientos. Encontró un alias de acceso compartido, 3 roles y un usuario desactivado sin empresa explícita, y 5.082 movimientos con empresa deducible desde su sede. En los cruces hubo 35 pares con fecha distinta (32 en días distintos; 3 con otra hora) y 2 referencias a contrapartes ausentes. Es una fotografía histórica: debe repetirse antes de activar la migración.

No se deben incluir contraseñas, tokens, datos de acceso, descripciones privadas ni copias de producción en el repositorio.

## Trabajo que puede adelantarse sin cambiar los usuarios

`functions/src/financialMigrationPlan.mjs` calcula un plan local desde una fotografía completa. No contiene conexión a Firebase ni genera operaciones de escritura. Reutiliza los cálculos del proyector del libro para obtener los saldos y meses esperados, preservando monto, cuenta, fecha y efecto contable de cada fuente.

- La empresa se obtiene de la sede confiable cuando falta en la fuente; una empresa explícita contradictoria bloquea la construcción. Esta resolución solo corresponde al acumulado derivado: no propone reescribir la fuente.
- Los pares históricos con otra fecha se registran como excepciones. Cada lado conserva su fecha original, también cuando pertenecen a meses diferentes. La discrepancia no prueba por sí sola qué fecha sería correcta.
- Las contrapartes ausentes quedan pendientes de revisar la auditoría. No se crea, elimina ni compensa un movimiento para cuadrar el plan.
- Monto/cuenta/fecha inválidos, sedes inexistentes, vínculos entre empresas y documentos repetidos bloquean la construcción.
- La salida siempre indica `canActivate: false`. Un cálculo local no demuestra que los datos sigan vigentes ni verifica reglas, índices, servidor, respaldo o integraciones.
- La huella permite detectar cambios en los campos usados en el cálculo. No sustituye la comparación transaccional de versiones durante la activación.

Las fuentes y referencias de la auditoría privada se conservan fuera del repositorio. La consulta adicional de sus historiales quedó pendiente porque la sesión administrativa ya no está disponible. El script local de consulta preparado solo permite GET y la operación de lectura `runQuery`; no se ejecutó una lectura nueva exitosa en esta fase.

## Pendientes antes de producción

1. Resolver el alias compartido con la decisión del administrador; releer los perfiles para no sobrescribir cambios posteriores. No elegir automáticamente una cuenta ni modificar sus contraseñas.
2. Recuperar la conexión y consultar la auditoría de los cruces. Preparar propuestas concretas para los casos que requieran corrección; conservar los históricos mientras no haya evidencia suficiente y autorización para modificarlos.
3. Adaptar y probar los servicios de identidad para producción, incluyendo cuentas de plataforma, nuevas empresas y tienda online. Los servicios actuales de prueba siguen limitados a staging.
4. Diseñar un respaldo privado verificable de los campos y documentos afectados y una recuperación que cubra identidad, reglas, servidor y cliente. No se ha creado todavía un respaldo de producción.
5. Construir y verificar los acumulados derivados mediante lectura paginada y control de versiones; probar que coincidan con el saldo del sistema actual, no solo con el proyector nuevo. Revisar compatibilidad de consultas, permisos e integraciones.
6. Definir la ventana y el orden de activación. No copiar las reglas de staging ni habilitar sus indicadores en producción como consecuencia de este plan.

## Validación local

`node --test tests/financialMigrationPlan.test.mjs tests/financialProjection.test.mjs`

Resultado: 11 pruebas aprobadas. Incluyen fechas diferentes, cambio de mes, contraparte ausente, propiedad entre empresas, fuentes incompletas o repetidas, exclusión de efectivo, separación de cuentas y una simulación de proyección de 50.000 fuentes. Son pruebas locales, no una validación de los historiales reales pendientes.

## Respaldo y recuperación preparados (17 de octubre)

Se añadieron herramientas locales, sin conexión a Firebase:

- `migrationBackupCapture.mjs` pagina las colecciones explícitamente declaradas mediante un lector inyectado, usando la misma fecha de lectura. Una página fallida, inválida o repetida invalida la captura. Conserva los valores wire de Firestore: enteros grandes, marcas de tiempo y campos privados no se convierten a tipos con pérdida de precisión.
- `migrationBackup.mjs` crea un manifiesto con conteos y huellas, comprueba su integridad y cifra el contenido con AES-256-GCM. El archivo cifrado no expone perfiles ni campos privados en texto legible. El guardado exige un directorio privado y crea el archivo con permisos 0600. La clave no se guarda junto al archivo.
- El plan de recuperación exige una captura completa del estado actual y un diario de las versiones exactas escritas por la migración. Un cambio posterior causa un conflicto. Solo puede proponer retirar documentos nuevos incluidos en ese diario; no elimina otros usuarios o movimientos. Las acciones tienen precondiciones de versión o de inexistencia y referencian las entradas del respaldo, sin incluir sus datos privados en el plan.
- `rehearseMigrationRecovery.mjs` prueba el recorrido completo con datos ficticios: captura, cifrado, apertura, restauración del perfil anterior y retirada de una credencial creada por la migración, únicamente en memoria. Comprueba también que un cambio posterior quede protegido.

La captura preparada cubre documentos directos de las colecciones declaradas, no es una exportación completa de Firestore. Las subcolecciones derivadas del libro no se restauran desde una copia antigua: se deben reconstruir y verificar desde las fuentes. El alcance real debe incluir, como mínimo, todos los documentos que el cambio de identidad pueda modificar (`sellers`, `roles`, `stores`, `companies`, `authCredentials`, `authLoginIndex`, `platformDevelopers`) y las fuentes e historial necesarios para verificar conciliación (`financialRecords`, `financialRecordsHistory`). Si el diseño de migración incluye otras escrituras, su respaldo y diario deben ampliarse antes de ejecutarlas.

El lector administrativo `migrationBackupReader.mjs` ya está preparado: solo permite GET al proyecto y base explícitos, con fecha fija y páginas limitadas; exige un proveedor de credenciales inyectado y no las guarda ni las incluye en errores. Todavía faltan la reconexión real, el adaptador al inicio de sesión disponible y la política de custodia de la clave real, el respaldo real y su prueba de apertura. No hay ejecutor remoto de restauración en estas herramientas y ningún plan permite activar o ejecutar automáticamente. La recuperación de servicios, reglas y cliente requiere su propio orden verificado: el respaldo de documentos no los despliega ni los revierte. No se ha conectado producción ni se han guardado datos reales en este repositorio.

Validación: `node --test tests/migrationBackup.test.mjs tests/financialMigrationPlan.test.mjs tests/financialProjection.test.mjs` — 21 pruebas aprobadas. Ensayo adicional: `node functions/scripts/rehearseMigrationRecovery.mjs` — recuperación en memoria aprobada, cero lecturas y cero escrituras remotas.
