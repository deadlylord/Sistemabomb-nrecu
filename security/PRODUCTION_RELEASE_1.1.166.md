# Entrega compatible de producción 1.1.166

## Alcance

Se publica el resumen del negocio completo original, las correcciones de edición de ventas, los controles de conciliación con borradores y operaciones de contrapartes, el historial de producto corregido y la carga operativa limitada a la sede activa. Esta última se desacopla de la identidad verificada para que funcione con el acceso actual de producción. Los informes y búsquedas multisede conservan su activación explícita. No se cambian pantallas ni controles respecto a la vista aprobada en staging.

La publicación de cliente no migra identidades ni despliega reglas o funciones. `VITE_VERIFIED_IDENTITY=false` y `VITE_FINANCIAL_LEDGER_INDEXED=false` quedan explícitos en producción; `VITE_STORE_SCOPED_LOADING=true` conserva la carga acotada. La conciliación usa su lectura compatible de fuentes por sede, con paginación de la tabla, sin afirmar que las consultas de ese histórico se reduzcan a 50 documentos. El nuevo login y los acumulados indexados siguen pendientes de migración y activación; no se declara completado ese trabajo.

La configuración pública del Firebase de producción que ya usaba main se conserva como respaldo y se fija en el contexto de producción. El cliente rechaza conectar producción a staging y no permite emuladores. Staging conserva sus servicios e identidad verificados, con su proyecto dedicado.

## Datos y recuperación

Se actualizó la revisión de producción y se consultó la auditoría de los 35 pares con fechas diferentes y de las dos referencias faltantes. En los dos casos faltantes existe evidencia de eliminación y estado anterior; no se restauran automáticamente ni se igualan fechas históricas. El alias compartido de AMVER permanece sin modificar.

Se creó y abrió de nuevo un respaldo cifrado de 10.473 documentos de nueve colecciones de fuentes: empresas, sedes, roles, vendedores, credenciales/índices privados y grants existentes, movimientos y su auditoría. La copia cifrada está guardada de forma privada y su clave se custodia separadamente en Secret Manager del proyecto. Para ello se habilitó esa API y se creó una clave privada de recuperación; no se concedieron roles IAM adicionales ni se cambiaron documentos fuente. El respaldo no equivale a una exportación de toda la base y debe actualizarse antes de una futura migración de identidad. No se guardan datos privados, claves ni enlaces de descarga en el repositorio.

Referencia previa de cliente: `c60fe773bb5e1fdd63e3685c0763aa3ac7144774` (main, 1.1.158). Para revertir esta entrega de cliente basta volver a publicar esa referencia; esta entrega no reescribe usuarios, contraseñas, saldos o históricos. La API de custodia y el respaldo no se eliminan al revertir el cliente.

## Validación

- 28 pruebas focalizadas: configuración correcta de proyectos, resumen completo, carga por sede con identidad actual y verificada, edición de ventas, conciliación, recepción e historial de productos.
- 159/159 pruebas generales aprobadas. Dos expectativas antiguas de texto se actualizaron a las etiquetas ya presentes en la interfaz (`Traslados` y `Reintentar pantalla`), sin cambiar el producto.
- Compilaciones de producción y staging aprobadas; diff sin errores de espacios.
- La comprobación de tipos conserva tres errores previos de `AppErrorBoundary`; no se introducen errores nuevos. La compilación no usa esa comprobación como puerta de publicación.
- El respaldo real se descifró con la clave recuperada del almacén privado y se comparó su huella completa. No hubo escrituras de fuentes de negocio durante captura o auditoría.
