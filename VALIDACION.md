# Validación de monemy 2.1.3

24 de octubre de 2026.

## Cálculos y comportamiento

Las 12 pruebas de cálculo pasan: céntimos exactos, fines de mes y años bisiestos, periódicos sin duplicados, histórico de reglas, proyección, migración de datos, rechazo de versiones futuras, umbrales y criticidad de alertas, deduplicación y conservación de lecturas, presupuestos por categoría, media de tres meses, calendario, promedios con días vacíos y escala del ahorro positivo y negativo.

La regresión de interfaz en Chromium pasa: registro, persistencia, categorías, búsqueda normalizada, edición y deshacer, gestos sintéticos, presupuestos, periódicos, detalle de proyección, modo sin conexión y reversión de guardados fallidos. Sin desbordamiento horizontal en las tres pestañas a 320, 375, 390, 430, 768 y 1280 píxeles. Inspección visual de Proyección con datos positivos y negativos.

## Actualización desde la versión anterior publicada

Referencia: commit `8d3b6f9457d5a8dbc36538cc1b7895531a242384`.

Prueba sobre un mismo origen `/monemy/` y un perfil persistente por caso:

- Chromium con perfil móvil Pixel 7.
- WebKit con perfil móvil iPhone 13.

En ambos motores se registran datos con la versión anterior, incluyendo una categoría de color personalizado fuera de la nueva paleta, movimientos en céntimos, presupuestos, reglas y el registro de ocurrencias. Se simula además un CDN que sigue sirviendo archivos antiguos para las URL normales; la caché nueva los evita usando URL de versión. Se interrumpe una instalación nueva dejando un recurso sin descargar, se comprueba que sigue disponible la versión anterior y se completa después una actualización real del service worker mediante Actualizar.

Se comparan exactamente las cinco colecciones financieras antes y después de actualizar. Se comprueba la copia local previa, el estado leído de las alertas tras recargar, los ocho colores, conservación del formulario al cambiar de icono, las doce cantidades de ahorro, las celdas del calendario y sus detalles. Se vuelve a comparar el estado tras cerrar y abrir el mismo perfil.

Ambos casos pasan. Chromium también pasa con la opción de red offline del navegador. En WebKit Linux esa opción provoca un error interno del motor al recargar, pese a existir controlador y caché completa; se verifica en su lugar una recarga con el servidor rechazando todas las conexiones, que pasa. Esta limitación del entorno de pruebas queda pendiente de contrastar en Safari real.

## Alcance y comprobación en dispositivos físicos

Los perfiles móviles y WebKit/Chromium no son teléfonos físicos ni equivalen a validar el contenedor de una PWA instalada en iOS o Android. No se ha accedido al móvil del usuario.

Para comprobarlo en el mismo móvil: conservar instalada la app, actualizar mediante Actualizar, comparar los movimientos y presupuestos ya existentes, cerrar y reabrir desde su icono y repetir en modo avión. No borrar datos del sitio ni desinstalar para actualizar. El nombre que el sistema conserve para un acceso directo existente puede gestionarse de forma independiente del nombre de la aplicación en el manifiesto.

Se conservan la base IndexedDB, su versión, el origen y la identidad del manifiesto. Los datos permanecen locales, sin sincronización entre dispositivos.

## Revisión de conservación de cambios

Se contrastó el código de la rama main con la copia de trabajo: sin diferencias previas a esta revisión. Se descargaron por HTTPS los diez recursos de la aplicación publicada y coincidían byte por byte con el código y los iconos revisados.

La nueva prueba `tests/preservation.cjs` pasa en Chromium con perfil Pixel 7 y WebKit con perfil iPhone 13. Comprueba las tres pestañas y un único registro; selección inicial Sin definir y extras ocultos; distribución de controles, período dentro del neto y navegación de períodos; creación, modificación y eliminación de categorías; paleta de ocho colores; objetivos por categoría y de ingreso; edición de presupuestos por gesto y eliminación con deshacer; alertas amarillas y rojas, lectura y ausencia de duplicados tras recargar; ambos gráficos amplios con eje fijo; año junto a Proyección y ausencia de títulos retirados; calendario y detalle semanal; exportación, importación y persistencia exacta de las cinco colecciones financieras.

Se reprodujo un fallo anterior: editar solo el importe de una regla mensual del día 31 cuya próxima fecha cae el 28 de febrero cambiaba indebidamente el día a 28. Ocurría también en una regla anual del 29 de febrero. La corrección conserva el calendario si no se cambia la próxima fecha ni la frecuencia; el histórico no se modifica. La prueba falla con el código anterior y pasa después de la corrección en ambos motores. También se comprueba que cambiar expresamente la fecha actualiza la programación.

Tras la corrección vuelven a pasar las 12 pruebas de cálculo, la regresión completa del navegador y la actualización desde la versión anterior en ambos motores. Siguen vigentes las limitaciones de dispositivos físicos indicadas arriba.
