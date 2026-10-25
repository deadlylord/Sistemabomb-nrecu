# Vestika 1.1.195

## Catálogo al ingresar

Se reprodujo con una prueba fallida el siguiente orden de entrega: el login verificado proporciona una sede inicial; llega el inventario activo del vendedor; llega después la lista completa de sedes de la empresa. El efecto de limpieza dependía de companyStoreKey y borraba el inventario ya recibido. El listener del vendedor seguía abierto con las mismas dependencias y no repetía un snapshot sin cambios. El catálogo quedaba vacío hasta un cambio posterior. Este efecto ya existía en 1.1.189; no lo introdujo el interruptor de medición de 1.1.194.

La limpieza completa se limita a cambios de usuario/empresa. Los cambios del listado de sedes solo retiran de la caché las sedes ya no autorizadas. Cambiar de sede sigue vaciando el catálogo anterior y no reutiliza productos de otra sede/empresa. El listener del administrador depende del conjunto efectivo de sedes consultadas, sin reconectarse al recibir metadatos de otras sedes.

Se conserva todo el catálogo de la sede, stock en vivo, búsquedas, categorías, edición, venta, abonos, informes, carrito y medios de pago. Las consultas originales del POS y los históricos siguen existiendo. No se habilita caché persistente ni se limita el historial. Esto corrige un borrado, no demuestra que toda la descarga inicial sea más rápida.

## Pantalla blanca móvil

El usuario precisó que aparece apenas abre el enlace, antes de ingresar, en celular. La apertura del login público 1.1.194 se observó correctamente en el navegador de prueba de escritorio. No se reprodujo el fallo de dibujo de su teléfono.

Como mitigación acotada, el formulario de entrada en dispositivos con hover:none y pointer:coarse no utiliza animación de opacidad ni backdrop-filter. El formulario tiene opacidad final 1 desde el primer dibujo. Se conservan los mismos campos, botones, textos, colores y distribución; el fondo de la tarjeta móvil ya no se desenfoca. El escritorio y las demás vistas conservan sus efectos. No se añaden recargas forzadas ni se borran sesiones/caché/carritos para intentar recuperar el dibujo. La corrección del blanco necesita confirmación en el dispositivo afectado.

## Validación y entorno

53 pruebas focalizadas pasan: regresión del vendedor y administrador con sedes tardías, inventario en vivo y cambio de sede, arranque, aislamiento por empresa/sede, categorías, borradores, scanner y navegación/recuperación. Compilaciones con la configuración de producción y staging. No se afirma una comprobación visual móvil ni una medición comparable de velocidad. Solo frontend, sin modificar fuentes, reglas, índices, IAM ni funciones. Staging no se publica en este cambio.

Reversión: frontend 1.1.194. No requiere restaurar datos.
