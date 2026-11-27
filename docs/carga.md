# Carga y arranque (Task 20 d)

## Medición (npm run build)

| Chunk | Antes (kB / gzip) | Después (kB / gzip) | Cuándo baja |
|---|---|---|---|
| index (arranque: React + título) | 1528,8 / 428,2 | 224,4 / 70,8 | inmediato |
| Scene (r3f, drei, misiones, mundo) | (dentro de index) | 181,7 / 54,9 | tras el inicial, en paralelo con el título |
| three (vendor) | (dentro de index) | 750,5 / 190,0 | idem |
| Post (bloom, tone mapping) | (dentro de index) | 126,7 / 42,0 | idem, perezoso |
| Hud (mapa, pausa, foto, paneles) | (dentro de index) | 28,8 / 8,4 | idem, perezoso |
| PhysicsScene (Rapier, WASM en base64) | 2277,9 / 857,4 | 2278,0 / 857,5 | idem (ya era perezoso) |

JS que bloquea la pantalla de título: 1528 kB -> 224 kB (gzip 428 -> 71 kB, -83 %). El resto baja mientras el usuario lee el título.

## Assets del arranque (public/, 8,8 MB en total)

| Archivo | Bytes |
|---|---|
| hdri/sky_1k.hdr | 1.435.119 |
| rig10/sk575_carrier.glb | 895.888 |
| rig10/sk575_acumulador.glb | 713.868 |
| character/worker.glb | 623.172 |
| textures/ground_diff.webp | 500.198 |
| textures/ground_nor.webp | 482.414 |
| rig10/sk575_bop.glb | 455.900 |
| rig10/sk575_manifold.glb | 400.348 |
| rig10/sk575_llave.glb (scenery) | 335.064 |
| rig10/sk575_bomba.glb | 326.380 |
| rig10/sk575_piletas.glb | 313.888 |
| rig10/sk575_mastil.glb | 230.228 |
| rig10/sk575_cuadro.glb (scenery) | 227.272 |
| rig10/sk575_izaje.glb (scenery) | 193.100 |
| rig10/sk575_aparejo.glb (scenery) | 158.648 |
| rig10/sk575_pozo_vecino.glb (scenery) | 65.064 |
| decoders/draco/* | ≈ 1,06 MB (js + wasm) |

## Qué se hizo

1. **Chunk inicial mínimo**: `App` solo monta el título (`Loading`) y carga `Scene` con `lazy()`. El progreso real de los GLB lo publica `Scene` en `src/app/loadStore.ts` y lo lee `Loading` (sin importar three/drei). `navigator.webdriver`, `?mision=`, `?post=1` y `?quality=` siguen en `Scene`/`Loading` sin cambios; `window.__game` se expone al montar `Scene`.
2. **Perezosos**: `Post` (postprocesado) y `Hud` (mapa, pausa, foto, misiones) en chunks propios; `three` en un chunk vendor (cacheable aparte).
3. **Preload**: `vite.config.ts` inyecta `<link rel="preload" as="fetch">` para el decoder Draco, carrier, acumulador, jugador y HDRI (respeta `base`), de modo que bajan en paralelo con el JS.
4. **Carga progresiva**: las piezas `scenery` (llave, cuadro, izaje, aparejo, pozo vecino, vientos, tiros: ≈ 1 MB, solo visuales, sin collider) se montan recién tras la primera carga completa (`settled`), cada una con su propio `Suspense`. Los colliders salen de las piezas `collide`/`walkable` y de las cajas de `traversal.json`: esas siguen bloqueando el "Jugar", así que los colliders existen antes de poder jugar. No se difirió nada más: priorizar por distancia al Acceso exigiría colliders parciales y el jugador podría atravesar piezas.
5. **Compresión**: los GLB ya vienen con Draco/meshopt y las texturas en webp; no hay ganancia obvia sin pérdida, y los GLB fuente están fijados por `assets.lock.json`. No se tocaron.
6. **Aviso de chunks > 500 kB**: quedan three (750 kB) y PhysicsScene (2,2 MB, WASM de Rapier inlineado); ninguno es del arranque. `chunkSizeWarningLimit` se subió a 2400 con comentario.
