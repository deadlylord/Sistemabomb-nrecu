---
name: vestika-qa-dirigido
description: Seleccionar y ejecutar pruebas proporcionales al riesgo de cambios en Vestika; identificar regresiones y fallos preexistentes.
---
# QA dirigido
1. Clasificar SIMPLE, MEDIA o CRÍTICA según AGENTS.md.
2. Encontrar tests existentes en tests/ antes de inventar comandos.
3. SIMPLE: revisar diff y prueba focalizada si existe. MEDIA: probar flujo afectado. CRÍTICA: probar reglas, aislamiento y regresiones pertinentes.
4. Distinguir errores anteriores de los nuevos comparando contra la rama base cuando sea posible.
5. Reportar comandos ejecutados, resultados y qué no pudo comprobarse.
