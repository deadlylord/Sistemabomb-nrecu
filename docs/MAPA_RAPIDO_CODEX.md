# Mapa rápido para Codex — Vestika POS

Orientación inicial obtenida de los nombres de archivos en la rama `staging` el 2026-11-07. **No sustituye la lectura del código**; verificar imports, estado, consultas y dependencias antes de editar. No se ha auditado el comportamiento interno de cada archivo.

## Entrada y navegación
- `components/App.tsx`: aplicación principal (archivo grande; buscar símbolos antes de leerlo entero).
- `components/Header.tsx`: encabezado y controles asociados.
- `components/LoginView.tsx`: inicio de sesión. Tratar cambios de autenticación como CRÍTICOS.
- `components/SettingsView.tsx`: configuración.
- `components/RoleManagerView.tsx`: roles y permisos (CRÍTICO).

## Punto de venta y ventas
- `components/PosView.tsx`: interfaz POS.
- `components/CartPanel.tsx`, `components/ProductCard.tsx`, `components/ProductGrid.tsx`: carrito y presentación de productos.
- `components/PaymentModal.tsx`, `components/SalesView.tsx`, `components/EditSaleModal.tsx`: pagos, ventas y edición (CRÍTICO si cambia la lógica).
- `components/ReceiptModal.tsx`: recibos.

## Inventario, bodega y productos
- `components/InventoryView.tsx`, `components/InventoryTable.tsx`: vistas de inventario.
- `components/InventoryTransferView.tsx`: traslados (CRÍTICO).
- `components/InventoryVerificationModal.tsx`, `components/DetailedInventoryVerificationModal.tsx`: verificación.
- `components/AddProductForm.tsx`, `components/EditProductModal.tsx`: formularios de productos.
- `components/TagScanningView.tsx`, `components/LabelConfigPanel.tsx`, `components/LabelPrintModal.tsx`: escaneo y etiquetas.

## Finanzas, gestión y reportes
- `components/FinancialReconciliationView.tsx`: conciliación (CRÍTICO).
- `components/DashboardView.tsx`, `components/BusinessOverview.tsx`, `components/ReportsView.tsx`: paneles e informes.
- `components/PayrollView.tsx`: nómina.
- `components/PurchasesView.tsx`: compras.
- `components/DeveloperCenterView.tsx`: herramientas de desarrollo.

## Firebase y entorno
- `firebase.ts`, `services/firebaseConfig.ts`: inicialización y separación de entornos (CRÍTICO).
- `firebase.json`, `firebase.staging.json`: configuración.
- `tests/firestore/`: pruebas de reglas; revisar archivos reales antes de seleccionar casos.

## Comandos existentes en package.json de staging
- `npm run lint`: TypeScript completo; puede revelar errores preexistentes.
- `npm run build`: compila estilos y luego Vite.
- `npm run test:performance`: ejecuta `tests/*.test.mjs` (no asumir que es una prueba pequeña).
- `npm run test:firestore:rules`: emulador y pruebas de reglas.
- `npm run test:staging:rules`: emulador y pruebas específicas de staging.

Para una prueba Node focalizada, identificar primero el archivo exacto bajo `tests/` y ejecutar el comando apropiado para ese archivo; no inventar nombres.

## Ruta de decisión rápida
1. Identificar si es SIMPLE, MEDIA o CRÍTICA según `AGENTS.md`.
2. Verificar rama y cambios existentes. Trabajar fuera de `main`.
3. Buscar nombre de vista/componente y leer solo el código relacionado.
4. Editar lo mínimo; revisar diff.
5. Validar según riesgo y reportar qué quedó sin ejecutar.
6. Nunca fusionar ni desplegar sin autorización.
