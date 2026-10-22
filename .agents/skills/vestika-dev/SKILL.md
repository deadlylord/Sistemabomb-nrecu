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
