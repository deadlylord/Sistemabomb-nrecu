# Dos perfiles para la prueba manual del Bloque 1

Solo rama `develop/safe-staging-performance`, Firebase `vestika-staging`.
Carlos autorizó crear una cuenta sintética separada para Developer; no se cambia
el rol de empresa ni se concede Developer a `stagingadmin`.

Con las variables Firebase de staging en `.env.local` (ignorado por Git), ejecutar
desde la raíz del repositorio, en Bash:

```bash
git pull --ff-only origin develop/safe-staging-performance
read -r -s -p 'Contraseña nueva para stagingdeveloper (mínimo 12 caracteres): ' STAGING_DEVELOPER_PASSWORD
export STAGING_DEVELOPER_PASSWORD
node --env-file=.env.local scripts/seed-staging.mjs --developer-user
unset STAGING_DEVELOPER_PASSWORD
```

No incluir contraseñas en comandos, commits o mensajes. El modo es exclusivo de
staging: valida proyecto/dominio/bucket antes de inicializar Firebase y repite
esa validación en el helper antes de leer Firestore. Respeta las reglas existentes.
Si falta `.env.local`, configurar primero las variables del proyecto staging;
no sustituirlo por `.env.example` ni configuración de producción.

La transacción crea únicamente `sellers/staging_developer` y
`platformDevelopers/staging_developer`. Usa `staging_company`, `staging_store_01`
y el rol administrador existente. El grant explícito autorizado por Carlos usa
su identificador inmutable y activa el mecanismo existente, sin cambiar lógica
de permisos. No copia la identidad, contraseña ni datos operativos de producción.
No modifica tiendas, inventario, ventas, roles ni el usuario `stagingadmin`.
Una repetición conserva la contraseña inicial; una identidad conflictiva,
parcial, deshabilitada o un grant revocado se rechazan sin sobrescribir/reactivar.

Perfiles esperados:
- `stagingadmin`: administrador normal, sin Developer Center.
- `stagingdeveloper`: Developer Center y cambio de tienda/empresa autorizado,
  siempre dentro del Firebase de staging.

Si ya se concedió Developer a `stagingadmin` siguiendo la instrucción manual
anterior, en **vestika-staging** cambiar a boolean `false` su campo `active` en
`platformDevelopers/staging_admin`. No borrar el usuario ni cambiar sus datos.
El nuevo comando no revoca permisos de otras cuentas automáticamente.

Probar A → B → A con ambos perfiles en sesiones separadas. En Developer verificar
Developer Center; en administrador confirmar que no está disponible. No se crean
otras empresas automáticamente. Las pruebas de cambio de empresa requieren otra
empresa sintética de staging.

Esta máquina no dispone de variables/credenciales de staging, por lo que no se
ejecutó el seed real. Verificación local: pruebas sintéticas de creación aislada,
guard de producción, contraseña requerida, idempotencia y conflictos/revocación.
Resultados: 9/9 pruebas de seeds aprobadas con `TZ=America/Bogota`; sintaxis de
ambos scripts/service worker y `git diff --check` aprobados. Versión, historial y
service worker 1.1.142. No se inició BLOQUE 2 ni se cambió lógica de permisos del POS.
