---
name: vestika-git-deploy
description: Gestionar ramas, pull requests, sincronización y despliegues de Vestika sin afectar producción.
---
# Vestika Git & Deploy

1. Inspeccionar rama actual, diferencias con main/staging y cambios pendientes antes de escribir.
2. Trabajar en rama de tarea; evitar commits directos a main o staging.
3. No asumir que main y staging comparten base de datos, variables de entorno o reglas Firebase.
4. Antes de sincronizar ramas, comparar commits y resolver conflictos de forma explícita; nunca sobrescribir trabajo sin revisión.
5. Confirmar que lint, build y pruebas pertinentes pasen; solicitar validación móvil y escritorio.
6. Preparar PR con alcance, riesgos, pruebas, impacto en Firebase y reversión.
7. Solicitar autorización explícita antes de fusionar, desplegar o modificar reglas de seguridad.
8. Tras despliegue autorizado, verificar funcionamiento y documentar versión; no afirmar éxito sin comprobación.

## Revisión de impacto en cada PR
El PR debe incluir sección «Impacto en otras funciones», «Comportamientos existentes preservados», «Pruebas de regresión», «Causa comprobada/probable/riesgo» y «Pendientes de validación». No fusionar cuando una dependencia crítica o contradicción funcional esté sin resolver; explicar alternativas al usuario antes de desplegar.
