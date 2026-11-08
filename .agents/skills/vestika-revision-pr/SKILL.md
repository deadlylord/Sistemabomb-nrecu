---
name: vestika-revision-pr
description: Revisar una rama o pull request de Vestika antes de integrarlo en staging, con foco en seguridad, regresiones y cambios no solicitados.
---
# Revisión de cambios
1. Comparar rama de trabajo con staging, no con main salvo indicación expresa.
2. Confirmar alcance, archivos cambiados, dependencias y ausencia de cambios ajenos.
3. Evaluar permisos, aislamiento companyId/storeId, stock, pagos y costos de lecturas cuando aplique.
4. Seleccionar verificaciones según riesgo; no asumir que build equivale a prueba funcional.
5. Entregar hallazgos ordenados por gravedad y recomendación de integrar o corregir.
6. No fusionar ni desplegar sin autorización.
