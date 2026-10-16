# Identidad verificada de staging: 1.1.160

Proyecto autorizado para esta prueba: **vestika-staging**, Firestore Standard, región `southamerica-east1`. Producción `factura2-6e811` no se cambia. La versión 1.1.160 activa el login verificado mediante `VITE_VERIFIED_IDENTITY=true` únicamente en el contexto de staging. La proyección de conciliación conserva su bandera apagada.

## Preparado

- El formulario conserva nombre/usuario y contraseña. El servidor normaliza con `trim().toLowerCase()` y busca un índice privado, compara un hash scrypt y obtiene empresa, sede y rol desde documentos confiables. No descarga la colección de vendedores al ingresar ni vuelve al login anterior si falla la verificación nueva.
- El servidor emite un token personalizado para un UID distinto por vendedor. El cliente comprueba que la identidad firmada coincida con el perfil devuelto.
- Crear, editar, renombrar, cambiar contraseña, desactivar, activar y eliminar usuarios actualiza perfiles públicos, hashes e índices privados dentro de una transacción. Los alias se reservan de forma transaccional. Se comprueban empresa, sede, rol, cuentas de plataforma y límites de licencias. El cliente no escribe identidades, credenciales, roles ni autorizaciones Developer directamente.
- Los roles de empresa se mantienen por un endpoint separado. No permite Developer, permisos fuera de los módulos contratados, sobrepasar licencias ni editar los permisos del propio rol. El alcance de los endpoints de esta prueba no incluye crear empresas, autorizar developers ni editar la cuenta del propietario.
- Cambiar credenciales, sede o rol y desactivar/activar una cuenta incrementa `authVersion`. Las reglas consultan el perfil y rol actuales para bloquear inmediatamente tokens anteriores. El cliente cierra su sesión al recibir una revocación y evita que una pestaña antigua cierre la nueva identidad abierta en otra pestaña.
- Las consultas iniciales de empresa, sedes, roles y perfiles se acotan al usuario verificado. El administrador conserva acceso a sus sedes; el vendedor conserva los módulos compartidos de novedades/apartados. Los perfiles no contienen contraseñas.
- Con identidad verificada, staging usa caché de Firestore en memoria, intenta eliminar la persistencia anterior y recarga al cerrar sesión. Una pestaña antigua puede impedir limpiar su caché anterior; debe cerrarse. No se promete borrar remotamente datos que clientes antiguos ya descargaron.
- La proyección de conciliación y los documentos privados son de escritura exclusiva del servidor. Los cruces requieren contrapartes coherentes dentro del mismo guardado y la auditoría es de creación solamente.

Las revisiones finales de `vestikaStagingLogin`, `vestikaStagingUsers` y `vestikaStagingRoles` se desplegaron en staging el 16 de octubre de 2026. Se configuró eliminación de imágenes de compilación a los siete días. No se desplegó `vestikaLogin` ni `financialLedgerChanged` como parte de esta fase.

El endpoint de prueba no exige App Check porque staging no lo tiene configurado; sí exige contraseña, límites compartidos de intentos y tokens firmados. **Está restringido por código a vestika-staging**. No debe copiarse como política de producción: el endpoint preparado para producción mantiene App Check obligatorio.

## Verificación previa

- Comprobación administrativa sin escrituras: un usuario existente, dos alias válidos, sin colisiones ni contradicciones entre usuario/sede/rol. No se imprimen contraseñas ni hashes.
- Pruebas del servidor, protocolo del cliente y formulario: nombre/usuario con mayúsculas mixtas, contraseña incorrecta, ausencia de contraseña/hash en la respuesta, incompatibilidad de claims, revocación, cambio de cuenta entre pestañas y edición de usuario conservando contraseña.
- Firestore Emulator prueba las consultas iniciales reales, accesos entre empresas/sedes, rechazo de identidad anónima, credenciales privadas, impedimento de cambios directos de identidad/rol, altas concurrentes, límites de licencias y operaciones de usuarios/roles del servidor.
- El escritor real de conciliación se ejecuta con las reglas nuevas en el emulador: creación de dos contrapartes con sus auditorías, edición con auditoría, rechazo de cambios parciales, eliminación, restauración y lote de 50 movimientos con 50 recibos de auditoría.
- La suite general conserva los ocho fallos anteriores de navegación/recuperación. Typecheck conserva tres errores anteriores de `AppErrorBoundary`; la declaración de tipos de Vite corrige los errores previos de `ImportMeta.env`.

El 16 de octubre de 2026 se desplegaron las reglas y se migró atómicamente el usuario existente (dos alias, sin colisiones). El login desplegado y el intercambio del token personalizado funcionaron con sus credenciales anteriores; se verificaron los claims firmados y la lectura de su empresa. Los perfiles públicos ya no contienen el campo `password`. Pasaron 54 comprobaciones desplegadas: usuario anterior y normalización de alias; credenciales incorrectas; creación de roles/usuarios; lectura de empresa y sede; bloqueos entre empresas y entre sedes para vendedores; contraseñas privadas; escritura directa de perfiles/roles; consultas acotadas; límites simultáneos de licencias; alias duplicados; edición sin cambiar contraseña; cambio de contraseña; desactivación, reactivación y eliminación; rechazo de tokens anteriores. Se verificó la eliminación de los datos ficticios. El primer login medido desde este entorno tardó 5386 ms y el siguiente 4938 ms; incluyen red y no constituyen una medición de la experiencia de los dispositivos de la tienda ni una promesa de velocidad. La web sirve 1.1.160 con el formulario de ingreso habilitado. La prueba visual completa de venta, inventario, conciliación y abonos sigue pendiente de iniciar sesión en el navegador seguro. Las reglas son un prototipo de staging y requieren revisión adicional antes de migrar producción, especialmente sus datos y consultas históricos, las cuentas Developer, los flujos de nuevas empresas y el acceso de la tienda online.

## Permiso de firma autorizado y aplicado

El usuario autorizó expresamente el 16 de octubre de 2026 otorgar `roles/iam.serviceAccountTokenCreator` a `serviceAccount:686332412850-compute@developer.gserviceaccount.com` sobre esa misma cuenta de servicio en `vestika-staging`. Se aplicó y releyó la política para verificar la vinculación, conservando el resto de permisos y su etag. La API `iamcredentials.googleapis.com` ya estaba habilitada y no se volvió a habilitar. No se asignó este rol a nivel de proyecto ni se modificó producción.

## Procedimiento de activación y comprobaciones

1. Aplicar únicamente el permiso de firma de la cuenta de staging sobre sí misma y verificarlo. Conservar todas las demás vinculaciones IAM.
2. Desplegar las revisiones finales de estas tres funciones, con los selectores explícitos de codebase:

   ```sh
   firebase deploy --config firebase.staging.json --project vestika-staging --only functions:vestika-identity:vestikaStagingLogin,functions:vestika-identity:vestikaStagingUsers,functions:vestika-identity:vestikaStagingRoles
   ```

3. Ejecutar de nuevo el chequeo de migración sin escrituras. Anunciar la breve actualización de staging y aplicar **solo en staging** las reglas `security/firestore.staging.rules`.
4. Ejecutar `functions/scripts/migrateStagingIdentity.mjs --write` con credenciales administrativas. El script comprueba que las reglas desplegadas coincidan con este archivo antes de guardar credenciales privadas. Reemplaza atómicamente los perfiles por sus campos públicos, conserva las contraseñas como hashes y comprueba que los perfiles no mantengan el campo `password`. Ante cualquier colisión se detiene antes de escribir.
5. Activar `VITE_VERIFIED_IDENTITY=true` exclusivamente en el contexto Netlify de staging, publicar esta candidata y verificar un ingreso real con el usuario existente. No imprimir contraseñas, hashes, custom tokens ni ID tokens.
6. Probar altas/cambios/desactivación y rechazo entre dos empresas ficticias en el backend desplegado; limpiar únicamente las pruebas creadas. Probar venta, inventario, conciliación, abonos y cierre de sesión en la web. Registrar tiempos en frío y caliente.
7. Mantener `VITE_FINANCIAL_LEDGER_INDEXED=false` hasta completar las pruebas. Después validar y activar por separado la proyección de conciliación. Decidir el paso a producción con los resultados, sin copiar automáticamente la configuración de staging.

No se debe volver a habilitar una regla global autenticada para resolver un `permission-denied`, ni reactivar lectura de contraseñas en el navegador. Si una prueba falla, corregir el flujo y repetirla antes de publicar en producción.
