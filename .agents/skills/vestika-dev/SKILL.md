---
name: vestika-dev
description: Diagnosticar y desarrollar cambios seguros en el POS Vestika React/Firebase.
---
# Vestika Dev

1. Identificar rama, entorno, módulo y comportamiento esperado.
2. Reproducir el problema; rastrear componentes React, servicios y consultas Firebase.
3. Comprobar companyId, tienda activa, roles y reglas de autorización en cada lectura/escritura.
4. Elegir el cambio mínimo y definir reversión; evitar refactors no relacionados.
5. Verificar cálculos de ventas, precios, descuentos, abonos y traslados; cuidar idempotencia.
6. Revisar comportamiento en móvil y escritorio, especialmente menús, historial y edición.
7. Ejecutar lint, build y pruebas relevantes; consultar vestika-qa.
8. Preparar PR con evidencia; no desplegar sin autorización.

Problemas históricos a vigilar: edición móvil de ventas/abonos, traslados duplicados, conciliación congelada, login lento, paneles de resumen ausentes y lecturas Firebase excesivas. Confirmar siempre si siguen presentes.

## Regla de negocio confirmada — V-VENTAS-001
Al editar una venta, cualquier unidad eliminada debe devolverse automáticamente al inventario de la tienda de origen. Calcular la diferencia entre cantidades originales y nuevas por producto, sin afectar otras tiendas y sin duplicar ajustes ante reintentos. Validar esta regla mediante pruebas antes de modificar el flujo actual. Anulaciones y devoluciones de clientes requieren reglas separadas.

## Regla de negocio confirmada — V-VENTAS-002
Al agregar prendas durante la edición de una venta, descontar automáticamente las unidades agregadas del inventario correspondiente a la tienda de la venta. Calcular el ajuste neto por producto frente a la venta original; evitar descontar dos veces ante reintentos. La política de existencias insuficientes queda pendiente de confirmación y no debe suponerse.

## Regla de negocio confirmada — V-VENTAS-003
Al editar una venta, no permitir agregar unidades de prendas si el inventario disponible de la tienda de origen es insuficiente. Validar disponibilidad al guardar contra el estado vigente, considerando el ajuste neto de la propia venta, y evitar que dos ediciones concurrentes consuman las mismas unidades. No permitir stock negativo por esta operación. No asumir excepciones de administrador sin confirmación.

## Regla de negocio confirmada — V-VENTAS-004
Al editar la cantidad de una prenda de una venta, ajustar el inventario exclusivamente por la diferencia entre cantidad original y nueva. Si aumenta, descontar únicamente el incremento y validar existencias suficientes al guardar; si disminuye, devolver únicamente la diferencia. Mantener el ajuste limitado a la tienda de la venta y prevenir duplicados por reintentos o concurrencia.

## Regla de negocio confirmada — V-VENTAS-005
Al cambiar exclusivamente el precio de una prenda durante la edición de una venta, recalcular el subtotal, descuentos/recargos aplicables y total de la venta; ajustar los pagos para que cuadren con el total nuevo, sin modificar existencias de inventario. Conservar coherencia de medios de pago, fechas y trazabilidad; el criterio exacto de redistribución cuando hay varios medios de pago queda pendiente de confirmación. Evitar movimientos de stock si no cambian productos ni cantidades.

## Análisis previo obligatorio para cada petición
1. Identificar archivos y flujos implicados y dependencias directas/indirectas (carga por tienda, navegación, estado local, filtros, Firestore, reportes, conciliación, traslados).
2. Separar intención del usuario de implementación propuesta; nunca asumir que optimizar lecturas autoriza perder estado de UI.
3. Enumerar invariantes aprobadas y posibles regresiones, con nivel de certeza (comprobado, probable, riesgo).
4. Explicar impactos en español no técnico antes de cambios importantes; preguntar solo por decisiones de negocio no inferibles.
5. Elegir implementación que preserve contratos anteriores, añadir pruebas de regresión y documentar nuevas reglas confirmadas.
6. Si un cambio nuevo contradice una regla existente, señalar la contradicción y pedir prioridad antes de actuar.
Ejemplo: cargar solo datos de tienda activa no debe borrar filtros de conciliación ni cerrar paneles al cambiar de sede. Separar el ciclo de vida de los datos por tienda del estado de navegación y búsqueda por usuario/empresa.
