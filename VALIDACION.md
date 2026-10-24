# Validación de monemy 2.1

24 de octubre de 2026.

## Cálculos y comportamiento

Las 12 pruebas de cálculo pasan: céntimos exactos, fines de mes y años bisiestos, periódicos sin duplicados, histórico de reglas, proyección, migración de datos, rechazo de versiones futuras, umbrales y criticidad de alertas, deduplicación y conservación de lecturas, presupuestos por categoría, media de tres meses, calendario, promedios con días vacíos y escala del ahorro positivo y negativo.

La regresión de interfaz en Chromium pasa: registro, persistencia, categorías, búsqueda normalizada, edición y deshacer, gestos sintéticos, presupuestos, periódicos, detalle de proyección, modo sin conexión y reversión de guardados fallidos. Sin desbordamiento horizontal en las tres pestañas a 320, 375, 390, 430, 768 y 1280 píxeles. Inspección visual de Proyección con datos positivos y negativos.

## Actualización desde la versión anterior publicada

Referencia: commit `8d3b6f9457d5a8dbc36538cc1b7895531a242384`.

Prueba sobre un mismo origen `/monemy/` y un perfil persistente por caso:

- Chromium con perfil móvil Pixel 7.
- WebKit con perfil móvil iPhone 13.

En ambos motores se registran datos con la versión anterior, incluyendo una categoría de color personalizado fuera de la nueva paleta, movimientos en céntimos, presupuestos, reglas y el registro de ocurrencias. Se interrumpe una instalación nueva dejando un recurso sin descargar, se comprueba que sigue disponible la versión anterior y se completa después una actualización real del service worker mediante Actualizar.

Se comparan exactamente las cinco colecciones financieras antes y después de actualizar. Se comprueba la copia local previa, el estado leído de las alertas tras recargar, los ocho colores, conservación del formulario al cambiar de icono, las doce cantidades de ahorro, las celdas del calendario y sus detalles. Se vuelve a comparar el estado tras cerrar y abrir el mismo perfil.

Ambos casos pasan. Chromium también pasa con la opción de red offline del navegador. En WebKit Linux esa opción provoca un error interno del motor al recargar, pese a existir controlador y caché completa; se verifica en su lugar una recarga con el servidor rechazando todas las conexiones, que pasa. Esta limitación del entorno de pruebas queda pendiente de contrastar en Safari real.

## Alcance y comprobación en dispositivos físicos

Los perfiles móviles y WebKit/Chromium no son teléfonos físicos ni equivalen a validar el contenedor de una PWA instalada en iOS o Android. No se ha accedido al móvil del usuario.

Para comprobarlo en el mismo móvil: conservar instalada la app, actualizar mediante Actualizar, comparar los movimientos y presupuestos ya existentes, cerrar y reabrir desde su icono y repetir en modo avión. No borrar datos del sitio ni desinstalar para actualizar. El nombre que el sistema conserve para un acceso directo existente puede gestionarse de forma independiente del nombre de la aplicación en el manifiesto.

Se conservan la base IndexedDB, su versión, el origen y la identidad del manifiesto. Los datos permanecen locales, sin sincronización entre dispositivos.
