# Producción 1.1.191: activación del acceso verificado

## Alcance

Activa el servicio de identidad de producción preparado y probado en staging. Conserva el formulario, los identificadores de usuario, las contraseñas actuales, las sedes, los roles y el resumen del negocio original. El acceso comprueba una identidad en el servidor en lugar de descargar todos los vendedores y comparar su contraseña en el navegador.

La preparación de módulos al enfocar el formulario, la separación de tiempos y las validaciones del login siguen las rutas ya verificadas. El medidor previo al ingreso es opcional con `?medir=1`. No se modifica la interfaz operativa.

La sesión Firebase conserva su persistencia y sincronización entre pestañas. La caché Firestore del modo verificado permanece en memoria, como en staging, y se intenta limpiar la caché persistente anterior. Cada recarga puede volver a consultar datos; no se promete una reducción del costo total ni un tiempo de ingreso concreto sin medir el mismo dispositivo, sede y red.

## Activación de servidor

Proyecto factura2-6e811, Firestore Standard nam5. Los cuatro servicios productionPosLogin, productionPosUsers, productionPosRoles y productionPosPlatform están activos en us-central1 con build `7a7ffc67792af43ea33ff4cbfcb33c0e3e3531d6`.

Se concedió roles/iam.serviceAccountTokenCreator a 1038601908493-compute@developer.gserviceaccount.com únicamente sobre esa misma cuenta, después de autorización explícita. Se comprobaron el permiso y la conservación de los demás bindings. IAM Credentials API ya estaba habilitada.

Las reglas de transición de identidad, hash SHA-256 `a8a4eb79a418c108d77ab8242715eea1522b53ba6bd7ba603692dc5d9ca4ad09`, compilaron y se publicaron después de autorización explícita. Protegen authCredentials, authLoginIndex y authLoginAttempts, y reservan las modificaciones de vendedores, roles y grants de Developer a los servicios del servidor. Conservan el catálogo público de inventario/categorías para la tienda web y las reglas operativas heredadas. Son reglas de transición revisadas; no representan una reescritura completa ni una garantía de aislamiento de todos los datos operativos por empresa.

Se verificó que los 58 documentos del respaldo permanecían sin cambios antes de migrar. La migración atómica aplicó 66 escrituras para 18 cuentas y 25 alias, con precondiciones de versión y existencia. Conservó los campos originales y normalizó únicamente los metadatos necesarios. Las contraseñas en perfiles se sustituyeron por hashes scrypt privados, compatibles con las contraseñas anteriores. No se escribieron ventas, productos, apartados, gastos ni conciliaciones.

## Recuperación

Respaldo y diario de migración cifrados y guardados; la clave permanece en Secret Manager. El diario conserva las versiones y los campos exactos posteriores a la migración. La comprobación posterior verificó las 18 cuentas y todas las escrituras registradas.

No basta con volver al cliente 1.1.190: el acceso antiguo esperaba contraseñas en perfiles. Una recuperación completa requiere verificar que ninguna identidad haya cambiado, ejecutar la recuperación con precondiciones, restaurar las reglas anteriores desde identity-rules-rollback.json y publicar el cliente anterior. El script se niega a sobrescribir cambios posteriores a la migración. Las operaciones de negocio nuevas no se restauran desde copias antiguas.

## Validación

27 pruebas focalizadas aprobadas: credenciales, identidad firmada, migración y conservación de metadatos, gestión de plataforma, formulario y rangos mensuales. Compilación de producción aprobada con identidad activa. Las pruebas con emulador de las reglas y servicios corresponden a las mismas fuentes revisadas antes de la activación.

Pruebas reales del servicio: las 17 cuentas activas ingresaron con sus credenciales anteriores y una cuenta deshabilitada fue rechazada. Se intercambiaron los tokens firmados con Firebase Auth y se comprobaron sus claims, el perfil sin contraseña y la lectura del resumen de la sede. Las lecturas de credenciales privadas se rechazaron. Carlos pudo leer los resúmenes de las ocho sedes; los tres servicios de gestión validaron solicitudes inválidas sin escribir datos. Inventario y categorías públicos siguieron accesibles para la tienda web.

Tiempos internos observados del servicio: 345–1.000 ms. Las solicitudes HTTP desde el entorno de comprobación tardaron 2.966–6.977 ms; no incluyen todo el ingreso del navegador ni son comparables directamente con una medición anterior del móvil. No se presentan como una mejora de velocidad demostrada en el dispositivo del usuario.

La suite general conserva el fallo previo de sharedRecordAccess por carga dinámica de React y tres errores TypeScript previos de AppErrorBoundary. La validación de servidor y de módulos no equivale a una revisión visual ni a una medición de velocidad en el móvil del propietario.
