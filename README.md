# monemy

Aplicación gratuita de finanzas personales con tres pestañas: **Resumen**, **Movimientos** y **Proyección**. Conserva la estructura del prototipo suministrado.

## Publicar en GitHub Pages

1. Crear un repositorio público llamado `monemy`, con un README inicial y rama `main`.
2. Subir los archivos de esta carpeta a la raíz del repositorio.
3. En **Settings → Pages**, elegir **Deploy from a branch**, **main**, **/(root)** y guardar.
4. Abrir el enlace que muestre GitHub cuando termine la publicación.

La aplicación no requiere compilación, servidor, claves ni cuenta para usarla. Las rutas relativas funcionan también en el subdirectorio del repositorio. El repositorio contiene exclusivamente código; no subir exportaciones personales.

## Instalar

- **iPhone:** abrir el enlace publicado en Safari → Compartir → Añadir a pantalla de inicio. Activar «Abrir como app web» si aparece.
- **Android:** abrir en Chrome → menú → Instalar aplicación o Añadir a pantalla de inicio.
- Abrir una vez con conexión para preparar el uso sin internet.

## Uso

- Registrar gastos e ingresos directamente en Resumen. La categoría inicial es «Sin definir».
- «Ver más» despliega categorías y su gestión sin salir de la pestaña.
- Deslizar filas hacia la izquierda para editar o eliminar. El botón de tres puntos permite las mismas acciones con teclado o ratón. Escape cierra las acciones.
- Los presupuestos son mensuales; el reloj permite editar, pausar y eliminar reglas periódicas.
- En Movimientos, la lupa busca por categoría o descripción sin distinguir mayúsculas, tildes ni puntuación.
- En Proyección, tocar un mes muestra sus importes.
- Ajustes permite exportar e importar una copia de los datos.

Los datos se guardan en IndexedDB, dentro del navegador y dispositivo utilizados. No hay sincronización entre dispositivos. Borrar los datos del sitio elimina ese almacenamiento; una exportación permite restaurarlo. Una actualización del código conserva los datos del mismo origen.

Los pagos periódicos pendientes se incorporan al abrir, reactivar o mantener abierta la aplicación; no requiere que esté ejecutándose en segundo plano. Las ocurrencias se identifican de forma estable para impedir duplicados, incluso tras borrar o editar un movimiento generado. Los cambios en una regla afectan a sus próximos pagos y conservan el histórico. Para los días 29–31, se usa el último día disponible del mes cuando sea necesario.

## Proyección

Los importes históricos se almacenan y suman en céntimos enteros. La previsión combina una media exponencial de hasta seis meses completos de movimientos variables con los periódicos pendientes. Se excluyen los movimientos ligados a reglas de esa media. Sin meses completos se toma el ritmo del mes actual y se indica que el historial es escaso. La base estimada se mantiene fija para los meses futuros; no se recalcula introduciendo meses todavía vacíos. Las cantidades futuras explícitas se tienen en cuenta sin repetir las de las reglas. Todas las series del gráfico comparten escala monetaria, incluido el ahorro negativo.

## Desarrollo y pruebas

```sh
python3 -m http.server 8000
# Abrir http://localhost:8000/
npm install
npx playwright install chromium
npm test
npm run test:browser
```

También puede indicarse `CHROMIUM_PATH` para usar un Chromium ya instalado. Las capturas de prueba se guardan en una carpeta temporal, o en `SCREENSHOT_DIR` si se especifica. Las pruebas del navegador arrancan su propio servidor en un puerto libre y comprueban el funcionamiento en `/mi-dinero/`.

Al publicar una nueva versión, mantener el mismo número en `RELEASE` de `sw.js`, `APP_VERSION` de `app.js`, el marcador `monemy-version` y las URL de recursos en `index.html`, y `package.json`. La app ofrece «Actualizar» cuando la versión está lista. El service worker solo limpia sus propias cachés y nunca elimina IndexedDB.

## Novedades 2.1.3

- Buzón dentro de Resumen, al lado del reloj y los ajustes, con contador de avisos sin leer y tarjetas amarillas o rojas. Los avisos se conservan localmente y pueden marcarse como leídos.
- Presupuesto de gasto global o por categoría: aviso al alcanzar el límite, aviso rojo al superarlo y aviso de gasto rápido al cruzar el 25%, 50% o 75% en menos de la mitad del tiempo proporcional del mes. Para el primer umbral se incluyen los tres primeros días. Se muestra un único aviso de ritmo por presupuesto; solo vuelve a marcarse sin leer si aumenta el umbral o la criticidad.
- Comparación con el gasto total medio de los tres meses naturales anteriores, cuando los tres tienen gastos registrados: amarillo al superarlo y rojo desde el 125%. Los objetivos de ingreso no generan avisos negativos por alcanzarse.
- Personalización de categorías mediante una paleta de ocho colores. Los colores antiguos se mantienen al actualizar; al editar una categoría se ofrece la paleta nueva.
- Proyección abre en Ahorro: cada mes tiene su importe visible, un eje ajustado a los valores y desplazamiento lateral con el eje fijo. Abre alrededor del mes actual. Todo conserva las cuatro series del gráfico original, también en grande y con desplazamiento lateral y eje fijo.
- Calendario del mes actual y promedios de lunes a domingo. El color representa ingresos menos gastos: verde positivo, rojo negativo; la intensidad representa su magnitud. Tocar una celda muestra ingresos, gastos y neto. Los días futuros no se cuentan. Los promedios incluyen los días sin movimientos dentro de los últimos tres meses, sin contar fechas anteriores al primer registro.

## Actualizar conservando los datos

Se conservan el origen, `manifest.id`, `start_url`, la base IndexedDB `mi-dinero-local` y la clave `state/main`. El nombre visible cambia a monemy; la identidad interna se mantiene por compatibilidad.

La versión 2.1.3 añade metadatos al formato 2 de los datos, sin convertir otra vez los céntimos ni borrar colecciones. Antes de migrar guarda una copia del estado anterior en `state/backup:before-2.1.3`, en una transacción local. El service worker solicita los archivos con una URL específica de la versión para evitar respuestas antiguas del CDN, valida los marcadores de versión del HTML y del JavaScript y prepara primero todos los archivos y solo aplica la versión completa al aceptar Actualizar. Una descarga incompleta deja funcionando la versión anterior. Su limpieza afecta exclusivamente a las cachés de archivos de su propio ámbito.

La app solicita almacenamiento persistente cuando el navegador lo permite; este puede concederlo o denegarlo. Las actualizaciones de código conservan los datos en el mismo navegador/perfil y origen. Borrar los datos del sitio, desinstalar o cambiar de origen/perfil puede eliminarlos o separarlos; las copias internas no sustituyen una exportación externa para esos casos.

Prueba reproducible de actualización, sobre un mismo perfil y origen:

```sh
# Desde un clon del repositorio:
git worktree add /tmp/monemy-previous 8d3b6f9457d5a8dbc36538cc1b7895531a242384
npx playwright install chromium webkit
BASELINE_DIR=/tmp/monemy-previous npm run test:upgrade
```

Pueden indicarse `CHROMIUM_PATH` y `WEBKIT_PATH` para usar ejecutables existentes.

Consultar `VALIDACION.md` para las comprobaciones realizadas y sus límites.

El registro evita etiquetas redundantes: iconos y Ver más bajo las categorías, importe directo y Registrar a todo el ancho. El período se muestra dentro de la tarjeta del neto. El desglose sigue el selector Gasto/Ingreso sin repetir un título. En Proyección el año comparte cabecera con el título y Tu semana habitual no añade subtítulos.

La auditoría de conservación se ejecuta con `npm run test:preservation` en Chromium y WebKit. Comprueba también que editar solo el importe de un pago mensual del día 31 o anual del 29 de febrero conserva su día previsto; cambiar la fecha o frecuencia sí actualiza la programación.


## Alertas 2.2.0

Cambio limitado al buzón y sus reglas. Se mantienen las tres pantallas, el registro, las gráficas, los cálculos monetarios, la programación de periódicos y la identidad de instalación.

- Amarillo: presupuesto al 80 % o exactamente agotado; ritmo del 25 % y 50 % demasiado pronto; gasto superior a la media de tres meses; día excepcional; pago previsto para mañana.
- Rojo: presupuesto superado; ritmo del 75 % demasiado pronto; gasto desde el 125 % de la media; previsión del mes con gastos superiores a ingresos, con ingresos y gastos registrados en los tres meses naturales anteriores.
- Lila: bienvenida sin registros, primer gasto e ingreso, Comida superior a 40 €, cinco gastos en el día, cuatro pequeños gastos de hasta 10 € que sumen al menos 15 €, Ventas, Extras, regreso después de cuatro días y celebraciones por objetivos de ingreso, ahorro mensual y presupuesto cumplido.

El aviso diario requiere al menos catorce días anteriores de historial, gasto de al menos 30 € y más del doble de la media diaria anterior; esa media incluye días sin movimientos y usa como máximo treinta días. Los gastos rápidos conservan los umbrales previos. Los mensajes del buzón emplean el tono vacilón acordado, con un dato breve debajo y variantes persistentes. Las celebraciones son lilas; no se añade un cuarto color.

Un vacile ordinario nuevo por día, con excepción del primer registro de cada tipo y celebraciones. Un aviso financiero nuevo o que aumenta de nivel tiene prioridad sobre el vacile del mismo movimiento. El contador prioriza rojo, después amarillo y finalmente lila. Las lecturas se guardan y no se reinician al cambiar los textos.

Al actualizar, los registros existentes inicializan los marcadores de interacción: no se generan bromas retrospectivas. Las compras antiguas, ediciones, deshacer e importaciones no se tratan como nuevas compras para esos mensajes. Las celebraciones de cierre empiezan después de activar esta versión y se refieren al último mes terminado observado por la app. Los pagos próximos y el resto de avisos se calculan al utilizar la app, dentro del buzón.

Se mantiene el formato financiero 2 y la misma base IndexedDB. Solo se añaden metadatos de alertas, además de aceptar el color lila en el historial. Antes de actualizar se conserva la copia local de seguridad de la versión anterior. Para validar el buzón: `npm run test:alerts` (Chromium y WebKit).
