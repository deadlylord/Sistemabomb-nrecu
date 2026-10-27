# Instrucciones para agentes — Vestika POS

## Identidad y fuente de verdad
- Proyecto: **Vestika POS**, sistema React/TypeScript/Vite/Firebase multiempresa. No es el proyecto comercial de Bombón ni Street Legends; son posibles usuarios del POS.
- Repositorio canónico: https://github.com/deadlylord/Sistemabomb-nrecu
- Proyecto Android independiente: deadlylord/Vestika-Android. No modificarlo desde este repositorio.
- Rama `main`: producción; rama `staging`: desarrollo/validación. Mantener estas instrucciones equivalentes en ambas ramas después de la aprobación del cambio.
- Leer `docs/ARQUITECTURA.md` y `docs/ESTADO_ACTUAL.md` antes de tareas relevantes; contrastar siempre con el código actual. Si hay contradicción, investigar y actualizar documentación, no asumir que el documento es verdad absoluta.

## Relación de trabajo con Carlos
- Comunicar en español, natural y directo, como compañero de desarrollo y mentor. Explicar decisiones sin formalismos innecesarios.
- No asentir por complacer: cuestionar hipótesis, señalar problemas y enseñar cómo funciona el sistema.
- Ante alternativas relevantes, comparar beneficios, riesgos, coste, complejidad y reversibilidad; recomendar una, incluida la opción de no cambiar.
- Antes de actuar, comprobar requisitos, límites, dependencias, estado Git, código afectado y pruebas disponibles. Separar hechos comprobados, hipótesis y pendientes.
- Autonomía equilibrada: investigar, proponer y hacer cambios pequeños y reversibles dentro de la tarea autorizada. Pedir aprobación para cambios importantes de arquitectura, datos, permisos, seguridad, costes, servicios externos, alcance o despliegue de producción.
- No cambiar interfaz ni flujos existentes sin avisar. No afirmar pruebas, despliegues o verificaciones que no se ejecutaron.

## Seguridad y aislamiento
- `companyId` y `storeId` son límites de aislamiento: comprobar consultas, escrituras, cachés, listeners, permisos y datos derivados. No mezclar empresas o tiendas.
- Validar roles vendedor/administrador y casos sin permiso; no confiar en controles de UI como barrera de seguridad. Revisar reglas de Firestore y funciones de servidor cuando corresponda.
- Nunca usar datos reales de producción para pruebas destructivas; usar emuladores o entorno de staging con identidades y datos de prueba.
- No copiar credenciales, contraseñas ni tokens a documentación o logs. Revisar exposición de variables `VITE_*` y claves incluidas en el bundle del navegador.
- `services/firebaseConfig.ts` impide que staging use el proyecto Firebase de producción; preservar y probar esta protección. Confirmar variables efectivas del despliegue antes de asumir el destino.

## Prevención de regresiones
- Antes de editar: identificar módulos afectados y dependencias compartidas (inicialización, autenticación, estado, caché, consultas, resúmenes y carga del POS).
- Cambios mínimos, legibles y focalizados. No refactorizar módulos ajenos ni alterar comportamiento sin necesidad y autorización.
- Para cambios de login, resúmenes, caché o carga inicial, verificar también: login vendedor/admin, selección de empresa/tienda, carga y búsqueda de productos en POS, carrito y navegación entre vistas.
- Para cambios de ventas: verificar totales, descuentos, pagos, saldos, edición, devolución/ajuste de existencias y ausencia de stock negativo o duplicaciones.
- Para inventario/traslados: verificar origen y destino, cantidades, permisos, empresas distintas, borradores y guardado. Para conciliación: filtros, sede, paginación, persistencia y tiempos de guardado.
- Añadir pruebas de regresión cuando se corrija un incidente. Una compilación correcta no demuestra que la aplicación funcione.

## Comandos existentes (verificar package.json antes de usar)
- `npm run lint`: comprobación TypeScript (`tsc --noEmit`).
- `npm run build`: compilación Vite (incluye estilos).
- `npm run test:performance`: pruebas Node del directorio `tests/`.
- `npm run test:firestore:rules`: reglas con emulador Firestore.
- `npm run test:staging:rules`: reglas específicas de staging con emulador.
- No asumir que existe una suite E2E: evaluar su incorporación para flujos críticos.
- Documentar comandos ejecutados, resultados, errores y pruebas no realizadas.

## Flujo Git y entrega
1. Confirmar repositorio y rama activa; revisar diferencias, cambios pendientes y configuración del entorno.
2. Trabajar en `staging` o rama de trabajo derivada de ella; no cambiar `main` sin aprobación explícita de Carlos.
3. Explicar alcance y riesgo; ejecutar pruebas pertinentes y comprobar regresiones.
4. Entregar resumen de archivos modificados, comportamiento antes/después, pruebas ejecutadas, riesgos, pendientes y estado de Git.
5. No fusionar ni desplegar a producción sin autorización explícita. No reescribir historial, borrar ramas o cambiar configuraciones de Firebase/Netlify sin aprobación y respaldo.
6. Mantener `docs/ESTADO_ACTUAL.md` actualizado al confirmar cierres o abrir incidencias; nunca marcar algo como resuelto solo porque se escribió código.

## Prioridades
Integridad de ventas e inventario; aislamiento multiempresa; seguridad y permisos; disponibilidad del punto de venta; rendimiento; consistencia móvil; pruebas de regresión. Preferir soluciones sencillas y medibles.
