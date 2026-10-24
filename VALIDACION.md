# Validación

Verificado el 24 de octubre de 2026.

## Comprobado

- Ocho pruebas de cálculo: céntimos exactos; fechas de fin de mes y años bisiestos; pagos semanales; recuperación de pagos pendientes sin duplicados; eliminación de ocurrencias; cambios de reglas sin alterar el histórico; proyección sin contabilizar dos veces periódicos; pocos datos; años anteriores; migración del formato anterior y rechazo de importaciones incorrectas.
- En Chromium, con emulación táctil y zona horaria Europe/Madrid: registro de gastos e ingresos, actualización inmediata de neto y categorías, creación de categorías, «Ver más» en la misma pantalla, búsqueda normalizada, edición, eliminación y deshacer.
- Gestos: eventos táctiles sintéticos del navegador ejercitan el deslizado. Edición y eliminación también mediante botón accesible.
- Presupuestos: creación y edición del importe mensual.
- Periódicos: creación, recarga sin duplicar, pausa, reanudación y edición sin modificar los movimientos anteriores.
- Proyección: doce meses, detalle interactivo, estilos distintos para datos reales y estimados y ausencia de explicaciones técnicas en la interfaz.
- Ausencia de desbordamiento horizontal en las tres pestañas a 320, 375, 390, 430, 768 y 1280 píxeles. Inspección visual de las tres pantallas.
- IndexedDB: datos conservados tras recargar y tras cerrar y reabrir el navegador con el mismo perfil.
- Modo sin conexión: recargar, registrar y volver a recargar con la red desactivada, desde un subdirectorio como el de GitHub Pages.
- Error de almacenamiento: la operación fallida se revierte y se informa al usuario.

## Pendiente de comprobar

- Publicación y respuesta HTTPS de GitHub Pages: requieren crear/configurar el repositorio.
- Instalación y uso en iPhone/Safari y Android/Chrome reales. La emulación de Chromium no equivale a probar Safari ni un dispositivo real.
- Comprobación manual tras publicar: instalar desde el menú del navegador, registrar un movimiento, cerrar y abrir desde el icono, activar modo avión y volver a abrir.

El repositorio y la URL pública se comunicarán únicamente cuando estén creados y verificados.
