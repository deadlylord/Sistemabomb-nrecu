# Vestika POS — Arquitectura y límites conocidos

**Repositorio canónico:** https://github.com/deadlylord/Sistemabomb-nrecu  
**Estado de esta documentación:** base inicial, 2026-10-26. Parcial; completar inspeccionando código antes de afirmar rutas y dependencias.

## Evidencia verificada en repositorio
- `package.json`: versión `1.1.195`; React 19, Firebase 12, TypeScript ~5.8, Vite 6; dependencias Recharts, Lucide, Motion, html5-qrcode.
- Scripts existentes: `dev`, `build`, `preview`, `lint` (`tsc --noEmit`), `test:performance`, `test:firestore:rules`, `test:staging:rules`, `build:styles`.
- `firebase.ts` inicializa la aplicación y Firestore; `services/firebaseConfig.ts` resuelve configuración desde variables de entorno y bloquea el uso del proyecto de producción en entornos no productivos.
- `netlify.toml` diferencia contextos production, staging, deploy-preview y branch-deploy. **No se han verificado aquí las variables reales configuradas en el panel Netlify**.
- `firebase.staging.emulator.json` apunta a reglas e índices específicos de staging; `tests/firestore/stagingIdentity.test.mjs` incluye casos de identidad, permisos y separación de datos por empresa/tienda.
- Firebase de producción configurado en código: proyecto `factura2-6e811`. Staging tiene configuración separada mediante variables de entorno; su identidad efectiva requiere verificación en Netlify.
- `main` y `staging` fueron sincronizadas en el commit `4b228222` antes de introducir estos documentos. El respaldo previo está en `backup/staging-before-sync-2026-10-26`.
- `staging-v2` es una rama histórica separada; no confundirla con `staging`.

## Modelo funcional reportado por Carlos — validar en código
- Sistema POS multiempresa, con empresas, tiendas, usuarios, roles, inventario, ventas, abonos, traslados, conciliación, reportes y nómina.
- Las operaciones deben aislar datos por empresa y tienda, especialmente inventario, configuración de etiquetas, consultas, caché y datos agregados.
- El POS debe funcionar con rol vendedor; permisos y carga inicial pueden diferir del administrador.
- En edición de ventas: retirar productos debe restaurar existencias; agregar productos debe descontar stock; cambiar cantidad debe aplicar diferencia; cambiar precio debe recalcular totales y pagos sin modificar inventario.
- Staging y producción deben compartir código cuando se sincronizan, **pero no compartir datos ni identidad Firebase**.

## Riesgos de arquitectura a investigar
1. Dependencias compartidas entre Resumen del Negocio, inicio de sesión y carga del POS; existió un incidente reportado de productos que no cargaban después de optimizar resúmenes.
2. Ciclo de vida de listeners, estado y caché por usuario/empresa/tienda.
3. Lecturas y escrituras Firestore en conciliación, verificación detallada y carga inicial.
4. Persistencia y aislamiento de configuración de etiquetas por empresa/tienda.
5. Seguridad de claves o variables inyectadas en el cliente; evaluar configuración Vite y uso de IA.
6. Cobertura E2E del flujo de vendedor: inicio de sesión, productos, búsqueda, carrito y venta de prueba.

## Mapa de código pendiente de verificar
No inventar rutas de componentes. Antes de intervenir, identificar archivos reales, propietarios del estado, consultas, funciones backend, reglas Firestore y tests relacionados. Documentar el recorrido de datos en una revisión posterior.
