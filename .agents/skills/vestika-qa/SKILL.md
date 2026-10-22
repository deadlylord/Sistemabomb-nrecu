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
