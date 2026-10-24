# Medición de consultas por acción

El medidor es optativo y solo se muestra a usuarios con acceso Developer. Se
preparó en una rama de diagnóstico; requiere desplegar esa rama para usarlo en
la aplicación. No se activó en producción.

## Prueba controlada

Usar una sede y un dispositivo de prueba, preferiblemente en staging. Mantener
el mismo usuario, datos y secuencia para las comparaciones.

1. Entrar al POS como Developer y pulsar **Medir consultas**.
2. Escribir la acción, por ejemplo **Reposo POS, 30 segundos**.
3. Iniciar, esperar 30 segundos sin acciones y detener. Descargar el resultado.
   Este control muestra actividad de fondo que no debe atribuirse a navegar.
4. Desde POS, iniciar **Abrir conciliación, primera vez**, cerrar el panel,
   abrir conciliación, esperar a que termine la carga y detener. Descargar.
5. Repetir la misma ruta como **Abrir conciliación, segunda vez**. Registrar
   cuánto tiempo transcurrió y mantener el mismo dispositivo.
6. Medir por separado **Buscar en conciliación**, **Abrir inventario**,
   **Abrir reportes** y **Guardar borrador de verificación**.
7. Para comparar un cambio, repetir los pasos con los mismos datos. Confirmar
   que resultados, saldos, productos y permisos sean los mismos.

El botón queda disponible al navegar. No es necesario regresar al Centro
Developer para detener, lo que añadiría nuevas consultas a la prueba.

## Qué significan los contadores

- **Solicitudes puntuales:** llamadas a getDoc/getDocs, variantes de servidor y
  agregaciones. Una solicitud no equivale a una lectura facturada.
- **Servidor, caché y pendientes:** documentos añadidos o modificados en los
  snapshots que entrega el SDK. Se clasifican por fromCache y hasPendingWrites.
  No se suman todos los documentos del resultado ante cada actualización.
- **Mayor resultado:** tamaño máximo de un resultado observado en ese grupo,
  útil para detectar consultas que traen miles de filas. No es costo acumulado.
- **Listeners:** aperturas, cierres y registros existentes al comenzar. Las
  suscripciones compartidas se instrumentan una vez en su conexión de origen.
- **Transacciones:** intentos del callback y sus get observados, incluidos los
  reintentos. El SDK sigue controlando la transacción original.

No modifica filtros, opciones, callbacks ni resultados del SDK. No solicita
eventos adicionales de metadatos ni vuelve a abrir consultas para medirlas.
Por tanto, una confirmación de servidor que el SDK no entrega al callback no
aparecerá. Los conteos del cliente no se deben llamar lecturas facturadas ni
usarse como un límite inferior o superior garantizado de la factura.

Las pantallas identifican el contexto activo. Una consulta global puede incluir
varias sedes: este dato no identifica por sí solo la empresa propietaria de cada
documento. Los paths se anonimizan y no se guardan filtros ni documentos.

## Confirmación con Firebase

Contrastar las ventanas de prueba con la métrica document/read_ops_count de
Cloud Monitoring. En producción, esos valores incluyen actividad de otros
dispositivos y procesos, por lo que no permiten atribuir una lectura individual
a una pantalla. Para una comparación aislada, usar staging con actividad
controlada y consultar después de que las métricas estén disponibles.

El medidor no observa Cloud Functions, lecturas de reglas, entradas de índices
ni operaciones hechas por otros clientes. El inicio de sesión ocurre antes de
acceder al panel y requiere una prueba aparte. Las agregaciones solo registran
la solicitud porque no exponen los índices facturados al cliente.

## Privacidad y alcance

No hace consultas para medir, no envía telemetría y no conserva datos en disco.
Retiene una sesión en memoria, con un máximo de 500 grupos; si se supera, la
interfaz indica que el resultado es parcial. No guarda contenido de documentos,
IDs de productos/clientes/ventas, contraseñas, claves ni mensajes de error. El
contexto sí incluye los identificadores técnicos de la empresa y sede
seleccionadas. La exportación se genera solo cuando el operador la solicita.

Al salir del acceso Developer se detiene la medición; al cambiar de usuario se
debe descartar la sesión anterior. No se cambiaron las reglas, caché, funciones
de servidor ni consultas operativas.

## Validación de la rama

- Cinco pruebas del medidor y su interfaz aprobadas, incluida preservación de
  callbacks/opciones, privacidad del resultado, caché, transacciones con
  reintentos y respuestas tardías entre sesiones.
- Suite completa: 183/184 aprobadas. El fallo restante de
  `sharedRecordAccess.test.mjs` (Dynamic require of react) también se reproduce
  sobre `8c5b4e6` sin cambios, usando las mismas dependencias.
- Compilación de producción y revisión de espacios aprobadas.
- TypeScript: tres errores de AppErrorBoundary, reproducidos también en la
  versión base. No hay errores adicionales por este cambio.

## Tiempos del guardado (1.1.172)

La exportación incluye `timings`: duración de la transacción completa (hasta
que el SDK confirma o rechaza), cada ejecución de su callback y etapas del
escritor financiero: comprobación de recibo, lecturas, preparación y validación.
El lote manual también mide desde el comienzo del procesamiento hasta actualizar
el estado de confirmación del formulario. No mide el renderizado posterior ni la
actualización asíncrona de los resúmenes. Las fases se anidan: no se suman al total.
La diferencia entre transacción completa y callbacks incluye arranque, esperas,
reintentos y confirmación; no atribuirla exclusivamente al servidor o a la red.

Iniciar antes de guardar y detener después de la confirmación. Una operación en
curso al detener se marca incompleta. Los resultados tardíos no cambian la sesión
terminada ni contaminan otra. Se retienen como máximo 200 etapas con etiquetas
fijas, contexto de empresa/sede y tiempos, sin mensajes, montos ni documentos.
No cambia las comprobaciones de duplicación ni agrega consultas o escrituras.
