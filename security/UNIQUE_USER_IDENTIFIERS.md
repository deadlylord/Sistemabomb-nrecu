# Identificadores únicos — 1.1.167

## Comportamiento

El acceso actual acepta nombre o username, normalizados con `trim().toLowerCase()`. Ambos identificadores deben ser únicos globalmente mientras el formulario no seleccione empresa. Se incluyen cuentas desactivadas para que reactivarlas no introduzca ambigüedad. Se mantienen acentos y espacios internos; no se cambian identificadores, contraseñas ni sedes existentes.

En producción, `commitUniqueLegacyUser` valida una lista obtenida del servidor al gestionar usuarios y coordina las operaciones mediante la revisión de `userManagementState/loginIdentifiers`. La revisión se lee antes de la lista y se comprueba y actualiza dentro de la transacción; si otro cliente actualizado creó, renombró o eliminó un usuario, se vuelve a consultar la lista antes de guardar. Las escrituras del administrador inicial y su empresa/sede/rol se confirman juntas. Todas las altas desde Equipo y Developer Center usan la misma operación, junto con las ediciones y eliminaciones. Las comprobaciones previas de empresa, sede, rol y propietario se conservan.

La lectura global es una compatibilidad temporal del acceso actual y solo ocurre al gestionar cuentas. No añade listeners ni consultas al login, arranque o cambio de sede. El coste de validar una modificación depende del número de cuentas, no del histórico de ventas. No se presentan cuentas de otras empresas ni datos privados en el mensaje de conflicto.

Esta coordinación protege las operaciones de los clientes actualizados; pestañas antiguas y escrituras directas que no incrementen la revisión no participan. Los administradores deben recargar después de publicar. No equivale a una restricción de unicidad impuesta por las reglas. La protección estricta en servidor corresponde al índice transaccional de identidad verificada, ya usado en staging, cuya activación en producción sigue siendo otra etapa. No se despliegan nuevas reglas, funciones ni el nuevo login con esta entrega. Staging conserva su flujo verificado y su rechazo transaccional de alias duplicados.

## Formulario

Espera la confirmación del guardado y bloquea envíos repetidos. Un conflicto deja el formulario abierto con todos los datos y un mensaje para elegir otro identificador. Borrar el username durante una edición envía una cadena vacía explícita para que no se conserve silenciosamente el anterior.

## Verificación

- 169/169 pruebas generales: normalización, colisiones nombre/username, cuentas desactivadas, otras empresas, exclusión de la propia cuenta, altas y ediciones simultáneas, lista desactualizada, validación de sede/empresa y escritura atómica de la empresa inicial.
- Formulario: doble envío bloqueado, datos conservados tras rechazo y reintento con usuario corregido.
- Producción: consulta real encontró 17 usuarios sin colisiones; el SDK real rechazó un intento de alias repetido antes de cualquier escritura de usuario. Un validador de solo comprobación impedía escribir incluso si la detección fallaba. Se inicializó únicamente el documento de coordinación con `revision: 0`, conservando todas las fuentes de usuarios.
- Compilaciones por entorno y revisión de tipos: la comprobación de tipos conserva los tres errores previos de `AppErrorBoundary`, sin errores nuevos.

Volver a la versión 1.1.166 revierte el cliente y deja de participar en la coordinación. El documento de revisión puede permanecer; no contiene credenciales ni datos de usuarios y no modifica su acceso.
