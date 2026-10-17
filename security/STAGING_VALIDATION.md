# Conciliación 1.1.159: validación en staging

**Registro de la primera fase.** Después se activaron la identidad y las reglas verificadas de 1.1.160; véase `STAGING_IDENTITY.md`. La activación posterior de paginación y resúmenes de 1.1.161 se documenta en `STAGING_LEDGER.md`. Las referencias al login y reglas anteriores en este documento describen el estado de esa primera prueba.

Fecha: 16 de octubre de 2026. Proyecto de prueba: `vestika-staging`, Firestore Standard, base `(default)`, región `southamerica-east1`. Referencia anterior de staging: `ba19cf52959cb9307a1543516b41c85361afee37`.

## Disponible para probar en staging

Se incorporan la carga de conciliación por sede activa, páginas de 50 filas, borradores recuperables, bloqueo de doble envío, escrituras transaccionales de ambas contrapartes, detección de edición simultánea y reintentos con recibos de auditoría. Se conservan los cambios propios de staging, su configuración Firebase y su edición de ventas. La nómina sigue sumando las ventas del día completo de Colombia.

La proyección indexada queda explícitamente desactivada para staging. No se desplegaron funciones nuevas ni reglas, ni se ejecutó la construcción del histórico. No se tocó producción.

## Resultados

- 32/32 pruebas focalizadas de conciliación, aislamiento del escritor y carga por sede aprobadas.
- 9/9 comprobaciones con Firestore Emulator aprobadas, incluyendo la prueba contenedora. Cubren las consultas reales de resumen/cuenta, identidad verificada, bloqueo entre empresas y entre sedes para vendedores, lectura administrativa de otra sede propia, revocación y protección de la proyección. Incluyen también dos caracterizaciones que **confirman defectos actuales**, no una aprobación de seguridad de staging.
- Las transacciones del escritor real se ejecutaron contra Firestore Emulator: cruces, edición de ambas partes, rechazo de documentos ajenos, edición desactualizada, repetición con recibo estable y eliminación conjunta.
- Build de staging aprobado. Suite general: 112/120 aprobadas. Los ocho fallos de navegación/recuperación también se reprodujeron en staging anterior. Typecheck conserva los mismos errores previos de `AppErrorBoundary` e `ImportMeta.env`, sin diferencias nuevas.
- Prueba contra **las reglas desplegadas en staging** con dos empresas y sedes ficticias: un usuario anónimo pudo leer el registro de la otra empresa y cambiar el campo `ready` de un resumen. Esto confirma que las reglas actuales no separan empresas ni protegen la proyección. Se eliminaron los seis documentos de prueba y la cuenta anónima temporal y se verificó su eliminación. No se usaron datos de las sedes existentes.

## Bloqueo para reglas estrictas y proyección

El login actual autentica anónimamente en Firebase y después descarga `sellers` para comparar usuario/contraseña en el cliente. No existe una identidad de empresa/sede comprobada por el servidor. Además, hay suscripciones globales a vendedores, empresas, sedes y roles.

El prototipo `financial-read.prototype.rules` permite solamente lecturas financieras con identidad verificada, permisos vigentes y sede comprobada. Bloquea todas las escrituras de clientes a la proyección y cualquier acceso a credenciales/estado privado. Es deliberadamente **parcial**, de solo lectura y exclusivo del emulador: **no es un conjunto de reglas de todo el POS**. La prueba del login actual con ese prototipo devuelve `permission-denied`, como se esperaba. Desplegarlo sobre staging dejaría el login y otros módulos bloqueados.

Antes de usar reglas estrictas en el POS hay que completar la identidad verificada, el mantenimiento seguro de usuarios/contraseñas, las consultas acotadas y las reglas de los demás módulos. El servidor de identidad preparado en `functions/README.md` no está integrado ni activado. No debe publicarse esta proyección en producción mientras un cliente pueda modificarla o leer otra empresa.

## Repetir las pruebas

Con Java 21 y las dependencias de desarrollo instaladas:

```sh
npm run test:firestore:rules
```

La prueba real de reglas está restringida por código a `vestika-staging`; requiere credenciales administrativas ADC y la clave web pública de staging:

```sh
node functions/scripts/verifyFinancialStaging.mjs --run
```

`VESTIKA_STAGING_WEB_API_KEY` se suministra por entorno. El script no imprime tokens ni contraseñas. Crea y elimina únicamente documentos con identificadores aleatorios propios y una cuenta anónima temporal. No debe ejecutarse como sustituto de las pruebas de la interfaz.

Security Rules prototype notice: "I've set up prototype Security Rules to keep the data in Firestore safe. They are designed to be secure for verified financial reads by checking server-issued identity, current permissions and store ownership, and denying client writes to projections. However, you should review and verify them before broadly sharing your app. If you'd like, I can help you harden these rules."
