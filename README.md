# GTA RIG GAME

Juego 3D en tercera persona (a pie + camioneta) para recorrer el Equipo 10 (pulling/workover SK-575): caminar la
locación, subir al piso de trabajo y al piso de enganche, operar válvulas (registro propio, ilustrativo) y jugar misiones
de reconocimiento. Referencia digital, no as-built: es ilustrativo, no es simulación ni validación de seguridad.

Repo **privado**. Consume los GLB del visor `exertion-solutions/visor-equipo-de-torre` (commit fijado en
`assets.lock.json`). Restricciones de uso y licencias: ver [`NOTICE.md`](NOTICE.md).

## Cómo correr

Requiere Node 22+.

```sh
npm install
npm run dev            # http://localhost:5173 (predev verifica los assets contra assets.lock.json)
```

Si faltan assets o cambió un hash: `npm run sync-assets` (usa `gh` con acceso al visor).

## Controles

| Tecla | A pie | En la camioneta |
| --- | --- | --- |
| W A S D | caminar | acelerar / girar / frenar-reversa |
| Shift | correr | |
| Espacio | saltar | freno |
| E | interactuar (escalera, válvula) o subir a la camioneta cerca | bajar |
| Ratón (clic en la escena) | mirar | |
| M | panel de misiones | |
| F | ficha del sector | |
| Esc | cerrar panel | |

Solo escritorio con teclado y ratón (táctil/móvil fuera de alcance por ahora).

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
No hay router: no hace falta `404.html`. `.github/workflows/ci.yml` solo corre typecheck, tests y build; **no publica**.
Publicar (GitHub Pages u otro hosting) requiere autorización escrita del dueño del visor: ver `NOTICE.md`.

## Datos

- `public/models/rig10/`: los 16 GLB que carga el juego.
- `vendor/visor/`: datos vendorizados del visor (JSON) y `vendor/visor/models/` con los `.meta.json` internos y 4 GLB
  sin uso; quedan fuera de `public/` para que no lleguen al build.
- `src/game/world/traversal.json`: superficies, barandas, escaleras y válvulas medidas de los GLB por
  `scripts/extract-traversal.mjs` (ver `docs/traversal-inventory.md`).

## Dependencias sin uso

`phaser` y `playcanvas` están instaladas a pedido del dueño, sin uso (en `devDependencies`; no entran al bundle).
`postprocessing`, `@react-three/postprocessing` y `r3f-perf` se usarán en tareas posteriores.
