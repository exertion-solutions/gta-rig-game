# Adiciones al escenario

**Escenario ilustrativo añadido por el juego, no as-built.** Nada de esto existe en los GLB del visor
(`public/models/rig10/`, intactos y verificados por `npm run check-assets`). Se agrega solo para poder recorrer el equipo.
Sin marcas ni logos; no son barreras de seguridad, zonas de exclusión ni procedimientos.

- Archivo: `public/models/scenario/additions.glb` (≈ 1.900 triángulos; presupuesto de la Task 18: ≤ 30.000).
- Origen: `scripts/build-scenario.py` (Blender 5.3 sin interfaz:
  `blender -b --factory-startup --python scripts/build-scenario.py -- <crudo.glb>`), después
  `npx gltf-transform meshopt <crudo.glb> public/models/scenario/additions.glb`.
- Materiales PBR: amarillo pintado (rugosidad 0,55), acero galvanizado (metálico 0,9 / rugosidad 0,42) y reja
  electrosoldada con textura procedimental webp de 128 px. UV por proyección cúbica. 3 mallas (una por material) = 3 draw calls.
- Anclajes: empties `anchor_*` con extras, que `scripts/extract-traversal.mjs` lee y **verifica contra las medidas de los GLB**
  (falla si no coinciden).

Rótulos: **MEDIDA** = sale de un GLB (ver `docs/traversal-inventory.md`); **ESTIMADA** = proporción industrial usual, sin fuente
del equipo.

## A1. Escalera de acceso a la pasarela de la planchada

| Dato | Valor | Origen |
| --- | --- | --- |
| Altura a salvar | 1,05 m (pasarela `sk575_planchada_grating`) | MEDIDA |
| Ubicación | extremo +X de la pasarela, x = 16,96, centrada en z = 0, baja hacia +X hasta x = 18,46 | MEDIDA (extremo) / ESTIMADA (lado elegido: el único extremo libre; el −X es la rampa) |
| Contrahuellas | 6 × 0,175 m (= 1,05 / 6) | derivada de la MEDIDA |
| Huella | 0,25 m → 2R + H = 0,60 m, pendiente 35° | ESTIMADA (escalera industrial de 30°–38°) |
| Ancho libre | 0,90 m | ESTIMADA |
| Pasamanos | 0,90 m sobre la línea de narices, con intermedio a 0,45 m, en ambos lados | ESTIMADA |
| Colisión | rampa por la línea de narices (35°) + barandas como cajas delgadas | coherente con lo dibujado |

## A2. Barandas de la rampa de la V

| Dato | Valor | Origen |
| --- | --- | --- |
| Rampa | de (1,474; 3,624) a (6,968; 1,088), 24,8°, ancho 1,20 m | MEDIDA (`sk575_planchada_grating`) |
| Existencia de la baranda | DROPS PT-4 "Baranda de plano inclinado", PLA-2 "Barandas" | documentada (sin cotas) |
| Posición | a 0,08 m de cada borde (z = ±0,68) | ESTIMADA |
| Alturas | pasamanos 1,00 m, intermedio 0,50 m sobre la rampa; parantes cada ≈ 1,4 m | ESTIMADA |
| Colisión | cajas delgadas inclinadas que siguen la rampa | coherente con lo dibujado |

## A3. Escalera vertical del piso de trabajo al piso de enganche

| Dato | Valor | Origen |
| --- | --- | --- |
| Arranque | y = 3,61 (chapa del piso de trabajo) | MEDIDA |
| Llegada | y = 20,65 (plancha del piso de enganche) | MEDIDA |
| Plano | cara +X del reticulado del mástil, x ≈ −0,69 + 0,0487·(y − 4,6) (ajuste sobre los nodos del reticulado) | MEDIDA |
| Separación de la cara | 0,18 m | ESTIMADA |
| Ancho libre / paso de peldaños | 0,45 m / 0,30 m (56 peldaños Ø 25 mm, largueros de planchuela) | ESTIMADA (escalera fija usual) |
| Posición lateral | z = −0,55 (el lado +Z tiene luminarias y un conducto) | ESTIMADA |
| Sin jaula | no se agregan elementos de protección (no hay fuente y serían controles de seguridad inventados) | — |
| Colisión | ninguna propia: el modo escalera (Task 18B) usa el `LadderVolume` `mastil_escalera` | — |

Limitación visible: la plancha del piso de enganche del GLB es continua, sin abertura; los largueros llegan a su borde trasero.

## No se agregó

- Volantes de válvula: el manifold ya tiene M1–M12 con volante en el GLB.
- Escalera a 45° del piso de trabajo nombrada en el meta: no hay posición documentada y el acceso real ya existe por la casilla
  y por la rampa.
- Barandas en la pasarela de la planchada: no están en el GLB y ninguna fuente las ubica (PLA-2 habla de la planchada sin
  precisar dónde); se sale de la pasarela por los costados como en el modelo.

## Escaleras de las piletas (limitación de colisión, Task 18B)

Las 4 escaleras reales de las piletas (GLB, 43°) miden **0,70 m** de ancho, igual que el diámetro de la cápsula del jugador
(2 × 0,35). Su colisión es la losa inclinada por la línea de narices, de 0,70 m de ancho, **sin colisión en los pasamanos de
la escalera**: con pasamanos sólidos la cápsula no entra. No se ensancha la losa (sería superficie invisible fuera de lo que
se ve). Consecuencia: el jugador puede salirse por un costado de la escalera y caer al suelo (≈ 0 a 2 m); **sin daño**:
queda de pie en el suelo y puede volver a subir. No se reubica (no está debajo del suelo ni fuera del vallado).

## Escalera vertical A3 en el juego (Task 18B)

- Modo escalera: E (o W mirando a la escalera, desde abajo) engancha; W/S trepa y baja a 1,2 m/s (valor de juego,
  `CLIMB_SPEED`); se suelta solo en los extremos: abajo sobre el piso de trabajo, arriba sobre la plancha a 0,75 m de la línea
  de la escalera (fuera de la caja `sk575_mastil_banda9`, que se solapa 0,11 m con la plancha).
- Como la plancha del GLB no tiene abertura, en el último tramo el cuerpo atraviesa visualmente la plancha (0,08 m): el
  trepado es cinemático (sin colisión) y no hay trampa que dibujar sin inventarla.
