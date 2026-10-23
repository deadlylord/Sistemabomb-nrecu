---
name: vestika-qa
description: Validar cambios y prevenir regresiones de Vestika POS.
---
# Vestika QA & Testing

1. Definir comportamiento anterior, esperado, escenario de error y criterios de aceptación.
2. Preparar casos positivos, negativos, permisos, concurrencia y repetición de acciones.
3. Comprobar separación entre empresas y tiendas; evitar usar información de clientes reales.
4. Validar desktop y viewport móvil; revisar navegación, modales y edición.
5. Revisar regresiones en ventas, abonos, inventario, traslados, conciliación, nómina y reportes según impacto.
6. Ejecutar los scripts existentes según alcance: npm run lint, npm run build, npm run test:performance, npm run test:firestore:rules, npm run test:staging:rules.
7. Si una prueba no puede ejecutarse, explicarlo; nunca marcarla aprobada por suposición.
8. Entregar matriz de resultados con pasos para reproducir, evidencia y riesgos pendientes.

## Principio confirmado — preservar comportamiento aprobado
No rediseñar ni redefinir flujos existentes solo por documentar Skills. Ante cambios, conservar estados de interfaz, filtros, paneles abiertos, navegación y contexto entre sedes salvo petición explícita. Comparar comportamiento anterior y posterior y agregar pruebas de regresión antes de aceptar cambios.

### Caso reportado: conciliación (regresión por paginación)
Comportamiento esperado que el usuario quiere recuperar: al cambiar de sede, el panel/libro de conciliación que estaba expandido permanece abierto y el texto de búsqueda se conserva y se aplica en la nueva sede. La paginación no debe reiniciar esos estados. Es un requisito de preservación, no una corrección implementada ni validada aún.

## Matriz de impacto y regresión obligatoria
Por cada cambio registrar: petición, módulos afectados, dependencias, comportamiento previo que debe mantenerse, escenarios de cambio de tienda/rol, pruebas y resultado. Especial atención a remounts de componentes, persistencia de filtros y paneles, carga por tienda, paginación, edición móvil y conciliación. Las pruebas estáticas de código no sustituyen la comprobación funcional. Ante una regresión, rastrear commits y diferenciar causalidad demostrada de hipótesis.

### Incidente de rendimiento confirmado por usuario — borrador de verificación detallada
En la verificación detallada por categoría, «Guardar borrador» tarda habitualmente entre 10 y 30 segundos antes de confirmar. Ruta inspeccionada: DetailedInventoryVerificationModal.handleDraftSave -> InventoryVerificationModal.handleSaveDraftWithSnapshot -> App.handleSaveDetailedDraft -> writeBatch con pendingDetailedVerifications y detailedVerificationHistory -> await batch.commit(). El botón permanece cargando hasta resolver esa promesa. La causa del tiempo de espera NO está demostrada. Antes de optimizar, instrumentar tiempos de preparación, tamaño del payload y duración de commit en staging, comprobar reglas/índices y conectividad; no registrar conteos ni datos sensibles en logs. Mantener confirmación real, historial, consistencia de inventario y aislamiento multiempresa. No confundir guardar borrador con aplicar ajustes al stock real.
