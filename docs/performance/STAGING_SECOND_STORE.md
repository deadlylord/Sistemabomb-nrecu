# Preparar A → B → A (solo vestika-staging)

Desde `develop/safe-staging-performance`, con las variables `VITE_FIREBASE_*`
del proyecto staging cargadas de forma segura, ejecutar:

```bash
node scripts/seed-staging.mjs --second-store
```

No necesita `STAGING_SEED_PASSWORD`: valida la identidad y el rol existentes sin
reescribirlos. No ejecutar el modo original sin `--second-store`, destinado al
seed inicial y que sobrescribe documentos iniciales.

El comando valida proyecto, authDomain y storageBucket antes de inicializar
Firebase. Usa Auth anónimo y las reglas existentes, sin service account, cambios
de reglas ni credenciales incluidas. Si Firestore rechaza la transacción, detener
la prueba y revisar los permisos de staging; no desactivar las reglas.

Crea solo documentos ausentes de `stores/staging_store_02` y tres productos
`inventory/staging_store_02_product_01..03`, con SKU `TEST2-001..003`. Todos usan
`companyId=staging_company`; los productos usan `storeId=staging_store_02`.
No copia datos de la primera sede. Reejecutar no reinicia stock ni numeración.
No escribe empresa, rol, vendedor, categoría, primera tienda, inventario original
o ventas. Valida que `stagingadmin` sea administrador de la empresa con POS e
Inventario; ese rol ya permite seleccionar ambas tiendas, sin elevar permisos.

Prueba manual: entrar con `stagingadmin`, abrir selector, comprobar Tienda Pruebas
con sus datos actuales, cambiar a Tienda Pruebas 2 y comprobar únicamente los
tres TEST2. Volver a Tienda Pruebas: inventario y venta de prueba originales
intactos, caché visible mientras sincroniza. Repetir A → B → A cinco veces.

El comando no se ejecutó contra Firebase desde este workspace: faltan las
variables de staging. Las verificaciones locales usan datos sintéticos y un
adaptador transaccional simulado; no conectan a Firestore.

Verificaciones: `TZ=America/Bogota node --test tests/stagingSeed.test.mjs`,
5/5 aprobadas (protecciones, preservación de venta/datos/credenciales, aislamiento,
idempotencia y rechazo atómico de conflictos). `node --check` aprobado para ambos
scripts y service worker; versiones package/lock consistentes y `git diff --check`
sin errores. No se repitió la suite del POS ni la compilación: no cambió su lógica.
Versión/historial/service worker actualizados a 1.1.141.
