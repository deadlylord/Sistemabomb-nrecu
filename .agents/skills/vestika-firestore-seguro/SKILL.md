---
name: vestika-firestore-seguro
description: Revisar o modificar consultas, escrituras, reglas, listeners y rendimiento de Firestore en Vestika; incluye aislamiento multiempresa.
---
# Firestore seguro
1. Rastrear origen, destino, listeners, índices y límites companyId/storeId.
2. Evaluar roles vendedor/admin y reglas, no solo controles visuales.
3. Evitar consultas de colecciones completas, listeners redundantes y lecturas de arranque sin justificación.
4. Para stock, pagos y traslados revisar atomicidad, concurrencia e idempotencia.
5. Usar emulador o staging sintético; jamás alterar producción ni sus datos sin autorización.
6. Ejecutar pruebas focalizadas y de reglas pertinentes; registrar límites de verificación.
