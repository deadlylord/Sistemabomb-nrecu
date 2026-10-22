# Vestika POS — reglas para agentes

Proyecto React 19 + TypeScript + Vite 6 + Firebase 12. Antes de trabajar, inspeccionar los archivos reales y el estado de la rama. No confundir este repositorio con Vestika-Android.

## Seguridad y alcance
- Proteger el aislamiento por empresa (companyId), tienda y rol en UI, consultas, escrituras y reglas Firestore.
- No editar datos reales, secretos, producción, main ni staging sin autorización específica.
- Trabajar en rama separada y mediante PR. No fusionar ni desplegar automáticamente.
- Preferir cambios pequeños; preservar ventas, abonos, apartados, inventario, traslados, conciliación, nómina y reportes.
- Evitar duplicaciones por reintentos, concurrencia y operaciones no idempotentes.
- No afirmar que algo está corregido sin pruebas; registrar límites de verificación.

## Verificaciones disponibles
- npm run lint (TypeScript)
- npm run build
- npm run test:performance
- npm run test:firestore:rules (requiere emuladores)
- npm run test:staging:rules (requiere emuladores)
Confirmar prerequisitos antes de ejecutarlos; no usar bases reales para pruebas.

## Skills
- .agents/skills/vestika-dev/SKILL.md
- .agents/skills/vestika-qa/SKILL.md
- .agents/skills/vestika-git-deploy/SKILL.md

En cada entrega: causa, archivos cambiados, riesgos, pruebas realizadas/no realizadas y plan de reversión.

## Regla obligatoria: análisis de impacto antes de cada cambio
Antes de implementar cualquier petición, explicar en lenguaje sencillo: (1) qué cambiará, (2) qué módulos, datos y estados podrían verse afectados, (3) qué comportamientos ya aprobados deben conservarse, (4) riesgos y mitigaciones, (5) pruebas de regresión y (6) si se requiere aclaración o autorización. No responder solo «listo» sin evaluar dependencias. Distinguir causa comprobada, causa probable y riesgo hipotético; no atribuir regresiones a peticiones del usuario sin evidencia. El usuario define el comportamiento deseado; el agente es responsable de analizar consecuencias técnicas. Documentar cada nuevo requisito confirmado y sus invariantes, sin redefinir comportamientos existentes que ya funcionan. Para cambios con riesgos significativos, presentar alternativas y solicitar decisión antes de implementar.
