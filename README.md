# GTA RIG GAME

Juego 3D en tercera persona (a pie + camioneta) para recorrer el EXERTION 01 (pulling/workover SK-575): caminar la
locación, subir al piso de trabajo y al piso de enganche, operar válvulas (registro propio, ilustrativo) y jugar misiones
de reconocimiento. Referencia digital, no as-built: es ilustrativo, no es simulación ni validación de seguridad.

Repo **público** (autorizado por el dueño del visor, ver `NOTICE.md`). Consume los GLB del visor `exertion-solutions/visor-equipo-de-torre` (commit fijado en
`assets.lock.json`). Restricciones de uso y licencias: ver [`NOTICE.md`](NOTICE.md).

## Cómo correr

Requiere Node 22+.

```sh
npm install
npm run dev            # http://localhost:5173 (predev verifica los assets contra assets.lock.json)
```

Si faltan assets o cambió un hash: `npm run sync-assets` (usa `gh` con acceso al visor).

## Controles

Al abrir el juego hay una pantalla de título: un clic en **Jugar** empieza (y captura el ratón). La ayuda de teclas también
está siempre visible en pantalla (pantallas anchas) y en el menú de pausa.

### Teclado y ratón

| Tecla | A pie | En la camioneta |
| --- | --- | --- |
| W A S D | caminar (aceleración suave) | acelerar / girar / frenar y reversa |
| Shift (o V para fijar) | correr; V alterna correr fijo | |
| Espacio | saltar (~0,68 m; admite pulsar un instante antes de tocar el suelo) | freno |
| C o Ctrl izq. (mantener) | agacharse (más lento, cámara más baja) | |
| E | interactuar: subir/soltar una escalera (mástil, carrier, casilla del maquinista), operar una válvula, el comando de izaje o la llave de potencia, subir a la camioneta si está cerca | bajar |
| Ratón (clic en la escena) | mirar | mirar |
| M | panel de misiones | |
| Tab | mapa completo | |
| F | ficha del sector | |
| N | silenciar / activar el audio | |
| P | modo foto (ver abajo) | |
| Esc | cerrar el panel abierto; si no hay ninguno, pausa y ajustes | |

El juego arranca en la base operativa, a 20 km de camino del equipo: hay que subir a la camioneta (E) y manejar. `?inicio=locacion` arranca directamente en la locación.

Pausa (Esc): sensibilidad del ratón, invertir eje Y, volumen general, calidad gráfica (automática, alta, media, baja) y,
si hay una misión en curso, salir de ella. Los ajustes se guardan en este navegador. El juego queda congelado mientras
está abierta.

### Mando

Cualquier mando "estándar" conectado (Gamepad API): stick izquierdo mueve, stick derecho mira, **A** salta, **X** interactúa
(igual que E), gatillo derecho o clic del stick izquierdo corre. Solo está probada la lógica de mapeo (tests unitarios), no un mando físico.

Solo escritorio (táctil y móvil fuera de alcance por ahora).

### Modo foto y clip

**P** entra al modo foto: se oculta el HUD y queda solo una barra inferior (que no sale en la imagen).

- **Intro** o el botón: descarga un PNG de lo que se ve (`foto-locacion.png`).
- **R** o el botón: graba hasta 10 s (cuenta regresiva en pantalla) y descarga un `.webm` (`clip-locacion.webm`); **R** otra vez
  lo corta antes. Necesita `MediaRecorder` y `canvas.captureStream`; si el navegador no los tiene, el botón dice "Clip no disponible".
- La marca "Referencia digital, ilustrativo" va dentro de la foto y del video.
- **P** o **Esc** salen.

Al completar una misión aparece una tarjeta (PNG de 1200x630, solo texto) y un botón para copiar el enlace a esa misión.

### Parámetros de la URL

| Parámetro | Efecto |
| --- | --- |
| `?mision=m3` | deja esa misión en curso al tocar Jugar (id corto, p. ej. `m3`, o completo). Un valor desconocido se ignora. |
| `?quality=high\|medium\|low` | fija la calidad gráfica y desactiva la degradación automática. Sin el parámetro, arranca en alta y baja sola si los FPS caen. |
| `?post=1` | fuerza el posproceso (bloom y mapeo de tonos, solo en calidad alta) aunque el navegador sea automatizado (Playwright); sin esto las pruebas e2e lo omiten. |

Se pueden combinar: `?mision=m3&quality=low`.

## Tests

```sh
npm test               # unitarios (vitest)
npm run test:e2e       # e2e (Playwright, Chromium headless; levanta su propio vite en :5173)
npm run typecheck
npm run check-assets   # GLB y datos vendorizados contra sus sha256 (falla si falta o difiere alguno)
npm run extract-traversal -- --check   # traversal.json coincide con lo medido de los GLB
```

## Build

```sh
npm run build          # dist/ con base relativa './' (sirve desde cualquier carpeta o sub-ruta)
npm run build:pages    # dist/ con base absoluta /gta-rig-game/ (GitHub Pages de proyecto)
```

La base también se puede fijar con la variable `BASE_PATH` (p. ej. en CI: `BASE_PATH=/otro/ npm run build`).
No hay router: no hace falta `404.html`. `.github/workflows/ci.yml` corre typecheck, tests, build y `check-assets` (más un job aparte con los e2e de Playwright); **no publica**.
Publicar (GitHub Pages u otro hosting) está autorizado por el dueño del visor desde 2026-11-27 pero se hace a mano, no desde CI: ver `NOTICE.md`.

## Estructura del repo

```
src/app/          arranque (React + canvas r3f)
src/game/         player/ (a pie, escaleras, animación), vehicle/ (camioneta), camera/, world/ (mundo, colisiones, día/noche,
                  posproceso), missions/ (motor y misiones), data/ (sectores, fichas, evidencia), input/ (mando), settings/, quality.ts
src/ui/           HUD, radar, mapa, pausa, ficha, título, carga, modo foto y clip (share.ts, Recorder.ts)
src/audio/        mezcla, efectos procedurales y radio con subtítulos
public/           modelos GLB, texturas, HDRI, decoders (se copia tal cual al build)
vendor/visor/     datos del visor fuera del build
scripts/          sync-assets, check-assets, extract-traversal y scripts de construcción de assets
tests/unit/       vitest;  tests/e2e/ Playwright (usa ganchos DEV `window.__game`, solo en desarrollo)
docs/             estado-qa.md, perf.md, traversal-inventory.md, scenario-additions.md, plan y diseño
```

## Límites conocidos

- Es una referencia digital ilustrativa: la geometría no es as-built y el signo lateral (+Y = este) no está verificado
  (ver `NOTICE.md`). No es simulación ni procedimiento.
- Las 8 misiones se omiten o se muestran según los datos vendorizados; la misión 8 queda omitida por falta de dato.
- Todo se midió con renderizado por software (SwiftShader): los FPS no representan una GPU real. El mando solo tiene
  pruebas unitarias del mapeo. Sin táctil ni móvil.
- La radio no trae voz grabada (`public/audio/voice/manifest.json` vacío): solo subtítulos y sonidos procedurales.
- El clip necesita `MediaRecorder` y `captureStream` (Chromium, Firefox y Safari recientes); la foto y el clip salen con
  el tamaño del canvas, sin selector de resolución.
- No se publica desde este repo: ver `NOTICE.md` y `docs/estado-qa.md`.

## Licencias de los assets

Los GLB del visor, el personaje (Microsoft Rocketbox, MIT) y las adiciones del escenario tienen su procedencia y licencia
en [`NOTICE.md`](NOTICE.md); léelo antes de reutilizar o redistribuir cualquier archivo de `public/models/`.

## Datos

- `public/models/rig10/`: los 16 GLB que carga el juego.
- `vendor/visor/`: datos vendorizados del visor (JSON) y `vendor/visor/models/` con los `.meta.json` internos y 4 GLB
  sin uso; quedan fuera de `public/` para que no lleguen al build.
- `src/game/world/traversal.json`: superficies, barandas, escaleras y válvulas medidas de los GLB por
  `scripts/extract-traversal.mjs` (ver `docs/traversal-inventory.md`).

## Dependencias sin uso

`phaser` y `playcanvas` están instaladas a pedido del dueño, sin uso (en `devDependencies`; no entran al bundle).
`postprocessing`, `@react-three/postprocessing` y `r3f-perf` se usarán en tareas posteriores.
