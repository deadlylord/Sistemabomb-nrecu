---
name: vestika-cambio-rapido
description: Cambios visuales pequeños y aislados en Vestika sin modificar datos, permisos ni lógica crítica. No usar para ventas, inventario o Firebase.
---
# Cambio rápido
1. Confirmar rama y estado de Git; nunca modificar main.
2. Usar docs/MAPA_RAPIDO_CODEX.md para localizar el componente y verificarlo en código.
3. Leer solo el fragmento pertinente y sus dependencias directas.
4. Aplicar parche mínimo; revisar diff.
5. Ejecutar comprobación focalizada disponible; no correr build/suite completa por rutina.
6. Reportar archivos, verificación y pruebas omitidas. Si toca datos, permisos o lógica compartida, escalar a revisión crítica.
