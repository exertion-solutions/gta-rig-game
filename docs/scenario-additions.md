# Adiciones al escenario

**Escenario ilustrativo añadido por el juego, no as-built.** Nada de esto existe en los GLB del visor
(`public/models/rig10/`, intactos y verificados por `npm run check-assets`). Se agrega solo para poder recorrer el equipo.
Sin marcas ni logos; no son barreras de seguridad, zonas de exclusión ni procedimientos.

- Archivo: `public/models/scenario/additions.glb` (≈ 2.040 triángulos; presupuesto de la Task 18: ≤ 30.000).
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

## A4. Baranda del frente +X del piso de enganche (Task 19b, QA D-06)

El frente +X de la plancha (el lado opuesto al mástil) solo tiene parantes en el GLB: con W apretada el jugador salía del
piso de enganche y caía 17 m. Se agrega una baranda ilustrativa que une las dos barandas laterales del GLB.

| Dato | Valor | Origen |
| --- | --- | --- |
| Borde de la plancha | x = 1,82, y = 20,65 (`sk575_enganche_grating`) | MEDIDA |
| Extremos | z = −1,20 y z = +1,24 (las barandas laterales del GLB) | MEDIDA |
| Altura del pasamanos | 1,11 m sobre la plancha (igual que las laterales, pasamanos a y 21,73) | MEDIDA |
| Existencia en el frente | el GLB solo trae parantes; ninguna fuente la ubica | ESTIMADA |
| Posición | 0,05 m afuera del borde (x = 1,87), para no achicar la plancha | ESTIMADA |
| Intermedio / parantes | a la mitad de la altura; 3 parantes (extremos y centro) | ESTIMADA |
| Colisión | caja delgada (0,05 m) del piso al pasamanos, sobre la misma línea (`enganche_baranda_frente`) | coherente con lo dibujado |

No es una barrera de seguridad ni un control: es escenario ilustrativo para que el borde se lea igual que los laterales.
`scripts/extract-traversal.mjs` falla si el anclaje no está en el borde medido, no une las laterales o no tiene su altura.

## Escaleras y camioneta (Task 19b, QA D-09; sin geometría nueva)

La colisión de cada escalera es una rampa por la línea de narices, pensada para el jugador. La camioneta la trepaba y
quedaba encaramada a ≈ 26°. Ahora la rampa es solo del jugador (grupos de colisión, `src/game/world/groups.ts`) y la
camioneta choca contra el volumen bajo de la escalera: del pie al borde de la cubierta, a lo ancho de la escalera y hasta
0,90 m (la altura del pasamanos de A1 sobre la línea de narices, ESTIMADA para las escaleras de las piletas). Queda dentro
de lo dibujado (escalera + pasamanos); el jugador y la cámara no lo ven.

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

## A9. Acceso al carrier y a la casilla del maquinista (`src/game/world/rigAccess.ts`)

Las dos escaleras existen en el GLB del carrier; lo añadido es poder recorrerlas y las cajas de colisión.

| Dato | Valor | Origen |
| --- | --- | --- |
| Cubierta del carrier | y = 1,35 | MEDIDA |
| Escalera amarilla (suelo a cubierta) | 5 huellas, x −11,45…−10,29, z 1,50…2,00 | MEDIDA |
| Escalera de la casilla (cubierta a descanso) | 10 huellas, 54°, x −5,11…−3,55, z 0,60…1,30 | MEDIDA |
| Descanso y piso de la casilla | y = 3,55 | MEDIDA |
| Cajas del carrier (chasis, motor, cuadro, tambor, izaje, pedestal) | mapa de alturas de carrier + cuadro + izaje en grilla de 0,25 m | MEDIDA (redondeada a la grilla) |
| Cornisa entre el cuadro y el borde | 0,31 m libres; apoyo invisible hasta z 1,95 | ESTIMADA (la cápsula mide 0,70 m) |
| Descanso | 0,50 m de ancho; apoyo invisible de 0,30 m hacia −X, con la baranda corrida | ESTIMADA |
| Puerta de la casilla | vano en la pared −X, z 1,5…2,3 | ESTIMADA (el GLB no modela la puerta abierta) |

- Las dos escaleras se suben en modo escalera (E o W, igual que A3): la de la casilla tiene 54°, más que la pendiente máxima
  del controlador (50°). El personaje usa el clip de trepar, con los brazos arriba, aunque sean escaleras con huellas.
- El vano de la puerta no está frente a la llegada de la escalera: ahí la caja `sk575_mastil_banda1` (z ≤ 1,0) invade la
  casilla. El personaje atraviesa visualmente la pared de la casilla al entrar.
- La casilla no comunica con el piso de trabajo: la pared +X queda cerrada.

## A10. Comando de izaje del aparejo

- Interactuable `comando_izaje`, dentro de la casilla, contra la pared que mira al pozo. E alterna izar y bajar.
- El aparejo (`sk575_aparejo`, todo menos el cable) sube hasta +6 m o baja hasta −3 m de su posición en el GLB, a 1,2 m/s
  (valores de juego). El cable se estira o acorta desde la corona. Bajo, queda a 0,6 m sobre el tope de la llave (7,01 m).
- No simula carga, freno ni límites de carrera reales. El cable del cuadro (línea rápida) no se mueve.

## A11. Llave de potencia

- Interactuable `llave_potencia`, en el piso de trabajo, junto al cuerpo de la llave. E la acciona.
- Lo que cuelga (cuerpo, mordazas, resorte y su cable) gira 0,45 rad sobre el eje del pozo y vuelve, en 1,6 s (valores de
  juego). Las cuñas, el poste de retención y su cable quedan fijos. La selección es por posición de cada triángulo
  (`isTongPart`), porque el GLB no separa esas piezas en nodos.
- No simula torque ni enrosque.

## A12. Ruta de la base operativa al equipo (`src/game/world/route.ts`, `routeWorld.ts`)

Todo inventado por el juego: no representa ningún camino, ciudad ni lugar real.

| Dato | Valor | Origen |
| --- | --- | --- |
| Largo del camino | 20 km, en 7 tramos: base, ciudad, chacras, estepa, bardas, sierra y llegada | Juego |
| Superficie | asfalto en la base y la ciudad (hasta 3,1 km); ripio después | Juego |
| Desnivel | la base queda 180 m por debajo de la locación; el paso de la sierra sube 30 m sobre ella | Juego |
| Pendiente máxima | menor a 11 % | Juego (test) |
| Radio mínimo de curva | mayor a 50 m | Juego (test) |
| Velocidad de la camioneta | 30 m/s (108 km/h) en la ruta; 12 m/s en la locación | Juego |
| Semáforos | 3 en la ciudad; ciclo de 24 s (10 verde, 3 amarillo, 11 rojo) | Juego |
| Tránsito | 26 vehículos (autos y camiones) en los dos sentidos, cada uno por su mano | Juego |
| Animales | tropillas de guanacos, ovejas y caballos; algunos cruzan la calzada | Juego |
| Obstáculos | rocas en bardas y sierra, obra con vallas y conos en la ciudad, 2 guardaganados | Juego |

- El terreno es una función de la posición (`terrainY`); se arma solo lo cercano: 3 × 3 tramos de colisión de 96 m bajo el
  jugador y bajo la camioneta, y 5 × 5 tramos dibujados de 192 m, con vértices cada 8 m.
- El mapa termina en una caja que contiene la ruta y la locación con 700 m de margen ("Límite del mapa").
- Los semáforos no se hacen cumplir: son visuales. No hay tránsito transversal.
- Ciudad y tránsito usan modelos CC0 de Kenney (64 modelos en `public/models/ruta/kenney.glb`): casas en los barrios,
  comercios y torres en el centro, una segunda fila detrás y una silueta lejana; autos, camionetas y camiones. El camión
  cisterna y el guanaco son modelos generados (NOTICE.md). Ovejas y caballos son figuras low-poly propias. Nada tiene animación
  de patas ni de ruedas. De la ciudad solo se dibuja lo que queda a menos de 440 m a lo largo del camino.
- La ciudad tiene veredas con cordón y el asfalto, líneas blancas de borde; la base tiene playón de hormigón. Son
  visuales: la colisión sigue siendo la del terreno.
- En la ruta el indicador superior muestra kilómetros de camino al equipo, tramo y velocidad. Es navegación del juego.
