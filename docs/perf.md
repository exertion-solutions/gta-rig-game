# Rendimiento (Task 12)

Presupuesto del spec: **escritorio** 60 FPS, < 250 draw calls, < 1 M triángulos visibles; **móvil** 30 FPS, < 120 draw
calls, < 300 k triángulos.

## Cómo se mide

- `tests/e2e/perf.e2e.ts`, viewport 1280 × 720, encuadre inicial (se ve el equipo completo: es el peor caso de la
  locación). Lee `renderer.info.render` del último cuadro con el gancho DEV `__game.renderInfo()`; **incluye el pase de
  sombras**. Mide a las 12 h y a las 0 h.
- FPS: cuadros de `requestAnimationFrame` durante 2 s, anotados en el reporte del test (no se exigen).
- **El FPS medido no es representativo.** Playwright corre Chromium sin GPU (`--use-angle=swiftshader`, render por
  software en CPU). Sirve para contar draw calls y triángulos, no para estimar FPS en una placa de video real.

## Resultados (2026-11-27, Chromium headless + SwiftShader)

| Estado | Draw calls | Triángulos | FPS (SwiftShader) |
| --- | ---: | ---: | ---: |
| Sombra 2048 con todas las piezas proyectando, sin unir mallas | 397 | 1.390.376 | 1,0 |
| + mallas unidas por material en cada pieza (`mergeByMaterial`) | 225 | 1.391.044 | 1,4 |
| + sombra solo de mástil, carrier, piletas, piso y planchada (estado final) | **166** | **936.268** | 1,4 |

Mismos números a las 0 h y a las 12 h (la noche no agrega luces: las luminarias son solo emissive).

Datos de los GLB (offline, sin líneas): 184 primitivas de triángulos y 678.362 triángulos en las 16 piezas; el
acumulador sola traía 63 nodos.

**FPS en hardware real (2026-11-27, Intel Iris Xe, Chromium headless con `--use-angle=d3d11`, sin vsync, 1280 × 720,
DPR 1, encuadre inicial, 5 s por corrida):**

| Calidad | FPS | Draw calls | Triángulos |
| --- | ---: | ---: | ---: |
| Alta con posproceso (`?post=1`) | 76 | 241 | 967.305 |
| Alta sin posproceso | 115 a 118 | 224 | 967.288 |
| Media | 123 | 224 | 967.288 |
| Baja | 162 | 158 | 711.171 |

Media no es más lenta que Alta: una medición anterior (Media 11,9 FPS) no se reprodujo en dos corridas alternadas.
Límites: headless usa DPR 1, así que el tope de DPR de cada nivel no entra en la medida; no se midió en una ventana
visible ni con una GPU dedicada.

## Decisiones

- **Unir por material** (`src/game/world/mergeByMaterial.ts`, en `loadRig`): las piezas son estáticas; un draw call por
  material y no por nodo. Bajó 397 → 225 llamadas. Atributos cuantizados pasados a float32 (más memoria de GPU).
- **Proyectores de sombra limitados** (`SHADOW_CASTERS` en `loadRig.tsx`): el pase de sombras volvía a dibujar los
  ≈ 690 k triángulos. Solo proyectan las piezas grandes (≈ 230 k); acumulador, llave, manifold, bomba, BOP, cuadro,
  izaje, aparejo, vientos, tiros y pozo vecino reciben sombra pero no la proyectan. Jugador, camioneta y volantes sí.
- **Sin instancias ni LOD nuevos**: con lo anterior el escritorio entra en presupuesto. El pozo vecino (lejano) son
  12 k triángulos; un LOD no cambiaba el total de forma apreciable.
- Sin SSAO ni bloom. Sombra `PCFShadowMap` 2048, frustum ±40 m centrado en la locación.

## Pendiente / riesgos

- Margen de triángulos chico: 936 k contra 1 M. Agregar geometría con sombra lo pasa.
- **Móvil no entra**: 166 llamadas y 936 k triángulos contra 120 / 300 k. Haría falta un perfil móvil (sin sombra,
  piezas simplificadas o LOD real); no está en esta tarea.
