# Producción 1.1.189: mejoras compatibles

## Cambios activos

- Borrador detallado: una consulta de productos por sede y categoría en el batch, conservando aislamiento, referencias, conteos, foto del sistema e historial. Las transacciones conservan lecturas propias y detección de conflictos; guardar borrador no aplica stock.
- Conciliación: fuentes de cierres bajo demanda; cuenta seleccionada y panel de cierres conservados al cambiar sede dentro del mismo usuario/empresa. Guardado con las validaciones, idempotencia y confirmación existentes.
- Registro de varios movimientos en móvil: modal en portal con pie visible, área desplazable y adaptación al teclado; tarjetas compactas.
- Inicio: compras, bonos y notas se cargan en las vistas que los consumen. El resumen conserva su diseño anterior.
- Firebase Auth: conserva la persistencia y sincronización entre pestañas, omitiendo preparación de ventanas/redirecciones externas que el POS no utiliza. Producción mantiene su acceso anónimo y comparación de credenciales actual.
- Medidor disponible para Developer durante la sesión. No expone el medidor previo al login en producción.

## Cambios todavía sin activar

`VITE_VERIFIED_IDENTITY`, `VITE_DASHBOARD_SUMMARY`, `VITE_DASHBOARD_MONTHLY_SALES`, `VITE_DASHBOARD_MONTHLY_CHART` y `VITE_DASHBOARD_INVENTORY_SUMMARY` son falsos en producción. El libro indexado y la carga por sede existentes siguen activos.

El login verificado y sus servicios de gestión aún apuntan exclusivamente a staging. Activarlo exige una migración de identidad y reglas compatible con los usuarios, sesiones y aplicaciones conectadas; no es un cambio de indicador. Esta publicación no cambia contraseñas, perfiles, reglas ni servicios remotos.

Los resúmenes de negocio requieren procesadores de producción, construcción paginada, cotejo de totales y protección de las rutas derivadas. Los procesadores actuales de negocio están restringidos a staging. La consulta mensual necesita el índice de producción y debe conservar también pagos recientes de ventas creadas en meses anteriores; hasta comprobar esos casos, se conserva la consulta histórica actual, incluido el gráfico. No se anuncia la reducción de lecturas de staging como resultado de esta publicación.

## Revisión de producción

Consulta administrativa de solo lectura: Firestore Standard, nam5; 3 empresas, 8 sedes, 18 vendedores y 7 roles. Sin colisiones de alias y sin contradicciones de empresa/sede/rol en esa fotografía. Reglas activas: `projects/factura2-6e811/rulesets/f3f02fcf-74b5-425a-8ea0-e9ff0d6dd891`. No se registraron credenciales ni datos privados en este documento.

## Recuperación

Referencia de cliente anterior: `8c5b4e68604cd3b53746448314971ea9f6cc51c8`. Publicarla de nuevo revierte esta entrega sin restaurar fuentes antiguas sobre ventas nuevas. Ningún paso de esta entrega exige escribir fuentes o migrar identidades.

## Validación

43 pruebas focalizadas aprobadas: configuración de producción, persistencia de Auth, aislamiento de escritura, borrador detallado, conciliación, cierres, modal móvil y carga inicial. Validación funcional automatizada; no equivale a pruebas manuales con sesiones reales de las tiendas. Los tiempos de staging no garantizan los de producción.

Compilaciones de producción y staging aprobadas. Suite general: 227/229 inicialmente; el fallo de OAuth se debía a dependencias de Functions ausentes en el checkout aislado y sus seis pruebas pasaron al enlazar las dependencias instaladas. Queda el fallo previo de `sharedRecordAccess.test.mjs` por carga dinámica de React. TypeScript conserva sus tres errores previos de `AppErrorBoundary`, sin nuevos errores.

Aplicaciones confirmadas por el propietario: POS y tienda web deben conservar su funcionamiento; Copilot es una prueba que no bloquea la siguiente migración. Las reglas y credenciales del catálogo deben revisarse antes de activar identidad verificada.
