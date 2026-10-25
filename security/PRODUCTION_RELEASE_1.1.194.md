# Vestika 1.1.194

El Centro Developer incorpora «Medición de consultas e ingreso». Su interruptor muestra u oculta el medidor en el login y en el POS de ese navegador y persiste entre recargas. Desactivar borra la medición local. No cambia permisos, datos del negocio ni la configuración de otros dispositivos. La existencia del medidor no concede acceso al POS ni descarga registros nuevos.

«Compartir enlace para medir el ingreso» genera un enlace de la misma instalación con ?medir=1, sin copiar otros parámetros ni fragmentos. Copia al portapapeles cuando está disponible y muestra un campo seleccionable como alternativa. El enlace habilita el medidor en esa pestaña y sus recargas. La medición se inicia y detiene manualmente, continúa al ingresar y se limpia al cerrar sesión o reemplazar el usuario. Developer permite desactivar también un medidor habilitado por enlace.

Se eliminan los avisos generales de carga del resumen. Los importes y cantidades pendientes muestran — en sus tarjetas, sin ceros provisionales. Los errores de consulta siguen visibles. Se mantienen disposición, filtros, cálculos, reglas de acceso, consultas y fuentes de 1.1.193. No se conserva una cifra anterior como si perteneciera a otra sede o período.

Verificación: 19 pruebas focalizadas de visibilidad/persistencia, enlace por pestaña, desactivación, login y continuidad del medidor, instrumentación y restauración del dashboard. La prueba del dashboard coteja el árbol visible completo con las fuentes originales y compactas y comprueba edición/reimpresión con el documento original. Compilaciones de producción y staging. No se afirma una mejora de velocidad ni una medición visual en celular. Este cambio es de frontend: no despliega funciones, reglas, índices ni modifica fuentes en Firestore.

Reversión: desplegar el frontend 1.1.193. La preferencia local adicional no cambia credenciales ni requiere restaurar datos.
