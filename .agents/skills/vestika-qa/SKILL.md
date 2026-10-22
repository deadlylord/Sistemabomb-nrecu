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
