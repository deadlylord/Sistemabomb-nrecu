# Producción 1.1.192: resumen sin alerta de diferencias

Petición: retirar la alerta de diferencias y las cargas prescindibles conservando el resto del funcionamiento.

Se retiran el acceso «Descuadre» de la barra móvil, el aviso «Descuadre Detectado» de escritorio y su cálculo sobre conteos e incidencias. El resumen deja de suscribirse a stockTakes y de recibir/procesar su historial. La única suscripción a esa colección permanece al abrir Conteos.

El historial completo conserva el filtro por sede y las acciones de aplicar, eliminar y añadir notas. Los controles de verificación de inventario permanecen en móvil y escritorio. Guardar borradores, aplicar verificaciones y las alertas propias de las otras vistas mantienen su implementación.

La medición suministrada observó 496 documentos de conteos en el resumen de la sede 2. Se elimina esa consulta del inicio; la reducción real de lecturas facturadas y la variación de tiempo requieren otra medición comparable. No se borra ningún conteo ni se modifica el stock.

Las novedades y los apartados siguen cargándose porque participan en ingresos, ajustes y abonos de registros antiguos, además de otras funciones. No se recortan por fecha de creación. Se conservan el resumen, el gráfico, el historial de ventas y sus filtros; el login verificado de 1.1.191 y la configuración de producción permanecen activos. No se despliegan cambios de reglas, índices, funciones o datos.

Validación: 17 pruebas focalizadas aprobadas y compilaciones de producción y staging aprobadas. Las pruebas montan el resumen con discrepancias pendientes y comprueban la ausencia del aviso y la presencia de los controles de verificación. Con 496 conteos comprueban cero consultas al entrar en el resumen, carga íntegra al abrir Conteos, cambio de sede y cierre del listener al volver. También comprueban edición de ventas, abonos antiguos, cálculo del gráfico, inventario bajo demanda y navegación.

La validación de interfaz fue funcional mediante el árbol de componentes; no se realizó una revisión visual manual en un dispositivo. La siguiente medición del usuario debe confirmar que stockTakes no aparece mientras solo se ingresa al resumen.

Recuperación del cliente: 1786594da74fe5b604caab7ed1b46593486a993d (1.1.191). Volver a esa versión restaura el aviso y la consulta de conteos sin restaurar datos ni alterar el login.
