# Vestika POS — Estado operativo y decisiones

**Actualizado:** 2026-10-26. Este documento distingue hechos verificados del repositorio y reportes históricos de Carlos. **No constituye una auditoría de producción ni certifica que un error siga abierto.**

## Cambio local 2026-10-27 — cruces entre sedes, versión 1.1.196

- Preparado en `staging`; Carlos autorizó publicar en staging. Subida a GitHub autorizada; despliegue y versión servida pendientes de verificación (el acceso al sitio y API de Netlify devuelve HTTP 403 desde este entorno). Solo presentación del libro de caja/conciliación: sede relacionada visible, pagos identificados por dirección y préstamos cuando el concepto los identifica expresamente. Los cruces ambiguos dicen «Cruce con [sede]»; no se infiere un préstamo solo por el signo del importe.
- Los pagos generados por la aplicación muestran una descripción corta y «Ver detalle del pago» con el concepto original completo. En la confirmación, las fechas quedan en «Ver deudas incluidas en el pago». Se conserva texto libre, registros históricos, referencias, exportaciones, saldos y lógica de guardado. No se añaden lecturas Firestore.
- Nuevos archivos: `services/financialRecordPresentation.ts`, `components/FinancialRecordConcept.tsx` y `tests/financialRecordPresentation.test.mjs`. Integración en `FinancialReconciliationView.tsx`; versión, historial y caché actualizados.
- Verificaciones con `TZ=America/Bogota`: suite completa 248/250 aprobadas; persisten los dos fallos de baseline (dependencia Functions `@google-cloud/firestore` ausente y empaquetado ESM de React en `sharedRecordAccess`). Las cinco pruebas nuevas aprueban. Build y `git diff --check` aprobados.
- Typecheck conserva exactamente tres errores previos en `AppErrorBoundary.tsx` (`setState`/`props`), comprobados también sobre la copia sin cambios; no se modificó ese componente.
- Sin cambios en Firebase, reglas, permisos, datos ni cálculos. Pendiente validación visual en móvil y PC tras publicar en staging: revisar cruces existentes, pagos salientes/entrantes, préstamos explícitos y abrir detalle sin seleccionar accidentalmente la fila. No se afirma una comprobación visual de navegador.

## Decisiones vigentes
- Repositorio principal: https://github.com/deadlylord/Sistemabomb-nrecu (conservar nombre actual).
- Aplicación Android en repositorio separado `deadlylord/Vestika-Android`.
- Flujo de trabajo: desarrollar/probar en `staging`; pedir aprobación antes de fusionar o desplegar en `main`.
- Mismas instrucciones `AGENTS.md` para ambas ramas una vez aprobadas; bases Firebase de staging y producción separadas.
- Carlos prefiere colaboración crítica, cercana y explicativa, autonomía equilibrada y protección explícita de funcionalidades existentes.
- No cambiar interfaces o flujos sin avisar; reportar impacto, riesgos, pruebas y regresiones.

## Estado Git verificado al iniciar esta documentación
- Se identificó el repositorio correcto tras confusión con otro de nombre parecido.
- `staging` estaba siete commits detrás de `main`, sin commits propios por delante; fue actualizada para coincidir con `main` en `4b228222`.
- Se conservó referencia de respaldo `backup/staging-before-sync-2026-10-26`.
- `staging-v2` era una rama histórica divergente y Carlos pidió eliminarla. **No consta eliminada**; no borrarla sin confirmar respaldo y disponer de la acción adecuada.
- Existían ramas históricas como `fix/pos-loading-regression`, `develop/safe-staging-performance` y `chore/vestika-agent-skills`. La existencia de una rama no prueba que su solución esté fusionada ni funcionando.
- `package.json` declara pruebas TypeScript, rendimiento y reglas Firestore; su ejecución y resultado actuales **no se han comprobado**.
- No se han validado variables reales de Netlify ni realizado pruebas E2E de navegador.

## Incidentes reportados anteriormente — verificar antes de tratarlos como abiertos
| Área | Síntoma reportado | Validación recomendada |
| --- | --- | --- |
| POS y carga inicial | Productos lentos o ausentes después de cambios en resúmenes; pantalla blanca en algunos casos | Reproducir con vendedor y administrador, revisar estados, listeners, errores y rama `fix/pos-loading-regression` |
| Login | Inicio de sesión de varios segundos y retraso al entrar | Medir por fases y roles, separar auth, datos y render |
| Resumen del Negocio | Carga visible de resúmenes y posibles regresiones en otras vistas | Comprobar dependencias compartidas y datos cargados |
| Inventario | Guardar borrador de verificación detallada tardaba 10–30 s | Perfilar lecturas/escrituras y probar datos representativos |
| Conciliación | Guardado lento, filtros que se pierden, paginación o interfaz móvil | Probar guardado, cambio de tienda, filtros, paginación y permisos |
| Ventas y abonos | Edición de precios/totales, saldos, inventario y controles móviles | Pruebas de cambios de precio, cantidad, devolución y pagos |
| Traslados | Riesgo de diferencias entre origen/destino y duplicaciones | Validar movimientos atómicos e inventario de ambos extremos |
| Etiquetas | Configuración de tamaño compartida entre empresas | Probar aislamiento por empresa/tienda y cambio de sesión |
| Multiempresa | Regresiones de permisos, caché o mezcla de datos | Pruebas Firestore y navegación entre empresas |
| Seguridad | Posible exposición de claves de IA en cliente | Inspeccionar Vite, bundle y configuración de servicios |

## Próximos trabajos recomendados
1. Revisar arquitectura real de login, resúmenes y carga del POS; identificar causa del incidente de productos no cargados.
2. Ejecutar y registrar `npm run lint`, `npm run build`, `npm run test:performance` y suites de reglas en emuladores donde sea viable.
3. Crear regresión automatizada de apertura del POS con vendedor y administrador; evaluar Playwright o alternativa compatible con la aplicación.
4. Comprobar configuración efectiva de Netlify para staging y producción antes de desplegar.
5. Ampliar cobertura de ventas, stock, traslados, conciliación y separación entre empresas.
6. Actualizar esta tabla tras cada diagnóstico: fecha, commit, reproducción, causa confirmada, solución, pruebas y estado.

## Criterio de cierre
Un problema solo se marca **resuelto y verificado** cuando se identifica el cambio, se ejecutan pruebas pertinentes y se confirma el comportamiento esperado en el entorno autorizado. Si no se pudo probar, registrar explícitamente «pendiente de verificación».
