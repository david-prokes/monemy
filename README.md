# Mi dinero

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

Al publicar una nueva versión, cambiar el sufijo de `CACHE` en `sw.js`. La app ofrece «Actualizar» cuando la versión está lista. El service worker solo limpia sus propias cachés y nunca elimina IndexedDB.

Consultar `VALIDACION.md` para las comprobaciones realizadas y sus límites.
