# Identidad verificada de Vestika — preparación, sin activar

Estado: servidor preparado; el POS 1.1.129 conserva su acceso actual. Este código no se importa en la aplicación ni modifica las reglas de producción. No representa aislamiento completo de Firebase todavía.

## Decisión

`vestikaLogin` verifica una contraseña con hash scrypt en el servidor y emite un token personalizado firmado por Firebase Admin. La identidad incluye usuario, empresa, sede, rol y autorización Developer. El cliente no elige esos datos. Carlos se identifica por su ID inmutable; otros developers necesitan una autorización activa emitida por Carlos.

La búsqueda usa un índice privado por usuario normalizado y lecturas puntuales. Nunca recorre ventas, inventario o historiales. El límite de intentos se aplica en una transacción compartida entre instancias y App Check es obligatorio. No registra contraseñas ni devuelve el documento completo de un vendedor.

## Requisitos antes de activar

1. Acceso administrativo al proyecto `factura2-6e811` para desplegar Cloud Functions y permitir a su cuenta de servicio firmar tokens.
2. Proteger `authCredentials`, `authLoginIndex` y `authLoginAttempts` contra toda lectura/escritura desde clientes. El Admin SDK usa el servidor. Las reglas actuales deben revisarse para impedir que un permiso global vuelva a autorizar estas colecciones; no basta añadir un `deny` si otro bloque concede acceso.
3. Registrar App Check para Vestika y añadirlo al cliente antes de probar la función desplegada.
4. Preparar credenciales privadas e índices únicos. `authCredentials/{sellerId}` contiene `passwordHash` con formato `scrypt-v1:salt:hash` y `disabled`. `authLoginIndex/{sha256(usuario normalizado)}` contiene únicamente `sellerId`. No copiar contraseñas sin hash. No modificar ni eliminar las contraseñas de los vendedores actuales mientras siga funcionando el acceso anterior.
5. Cambiar el login y carga inicial del POS: llamar al servidor antes de leer datos de empresa, entrar con `signInWithCustomToken`, dejar de descargar contraseñas y listas globales de vendedores, cerrar correctamente la sesión Firebase. Los cambios de contraseña/usuarios deben pasar por el servidor para mantener los hashes e índices. No habilitar una vuelta automática al login anterior si falla la autenticación verificada.
6. Probar bloqueo entre empresas, desactivaciones, cambios de roles, cambio de usuario entre pestañas, flujo Developer y tienda online. Las reglas finales deben verificar usuario/rol vigentes; las claims solas pueden quedar antiguas hasta renovar el token. No copiar permisos de empresa al rol Developer.
7. Activar conjuntamente el cliente nuevo y las reglas compatibles. Solo entonces poner `VESTIKA_IDENTITY_ENABLED=true`.

Despliegue del servidor, una vez cumplidos los requisitos administrativos:

```sh
npm --prefix functions ci
firebase deploy --only functions:vestika-identity --project factura2-6e811
```

El servidor deshabilitado rechaza solicitudes. No se incluye un archivo de reglas de producción ni un comando para reemplazarlas en este bloque.

## Lecturas

Un login válido normal usa 7 lecturas puntuales de identidad y 2 de límites de intentos; Carlos usa 6 y 2. Los intentos fallidos terminan antes. No añade suscripciones ni lecturas periódicas del POS. Estas cifras excluyen reintentos automáticos de transacciones. Los contadores pueden limpiarse con una política TTL sobre `expiresAt` al configurar Firebase.

Las pruebas de `tests/secureIdentity.test.mjs` ejecutan la decisión de identidad con documentos ficticios y un firmador simulado. No son pruebas de reglas en el emulador ni pruebas del despliegue real.
