# Relevamiento de recorrido vertical (Task 18, Step 0)

Escenario ilustrativo, **no as-built**. Todo lo medido sale de los GLB publicados en `public/models/rig10/` (commit del visor
fijado en `assets.lock.json`, `bb09175…`), leídos con `@gltf-transform/core` en coordenadas de mundo (1 u = 1 m, Y arriba,
origen = boca de pozo). Las cifras automáticas las regenera `node scripts/extract-traversal.mjs` (→ `src/game/world/traversal.json`,
con el sha256 de cada GLB); si un GLB cambia de forma, el script falla.

**Hallazgo general:** los GLB no tienen nodos por escalera, baranda o válvula: cada pieza trae un nodo por material
(`sk575_<pieza>_<material>`). Lo transitable se reconoce por geometría: material `grating`/`acero` plano hacia arriba
(pisos, cubiertas, huellas) y material `amarillo` (barandas, pasamanos, zancas). Excepciones con nombre propio: el
acumulador (`sk575_acum_valvula_*`), el piso de enganche (`sk575_enganche_*`), la cabina y la casilla del carrier.

Fuentes documentales revisadas (en el commit fijado): `docs/references/well-control/README.md`,
`docs/references/piletas/README.md`, `docs/references/enganche/README.md` del visor (vía `gh api`), y `vendor/visor/drops.json`
(Libro DROPS 2024, RCCO). Ninguna da cotas de escaleras, barandas ni válvulas; sí documentan **existencia**:

| Id DROPS | Qué documenta |
| --- | --- |
| PT-1 | Piso de trabajo: "Escaleras y plataformas de tránsito/trabajo" (sección "Piso de trabajo · Escalera de acceso") |
| PT-2 | "Bujes de escalera colocados en cuna de piso de trabajo" |
| PT-3 / SUB-3 | Barandas y rodapié del piso / subestructura |
| PT-4 | "Baranda de plano inclinado" |
| PLA-1 / PLA-2 | Plano inclinado y planchada; barandas |
| PIL-2 | Barandas y rodapié de piletas (README de piletas: "baranda abierta 0,8 m en la escalera") |
| CAS-3 | Escaleras y pasadores de la casilla del maquinista |
| PE-1…PE-13 / PE-7 | Piso de enganche; "Puerta de ingreso a piso de enganche" |

Válvulas: el README de control de pozo dice "choke manifold … válvulas con volante" y "Volantes Ø≈0,40 m" (**aproximado**,
tipología de fotos genéricas), y "HCR de 2 1/16"" (confirmado, de accionamiento hidráulico: sin volante). Ninguna fuente
documenta secuencias, estados ni procedimientos de operación: no se inventan.

## Pieza por pieza (las 16 `sk575_*`)

| Pieza | Qué se puede subir (medido) | Acceso que falta | Válvulas / volantes |
| --- | --- | --- | --- |
| `sk575_piso` | Chapa del piso de trabajo `sk575_piso_acero` plana a **y = 3,606**, x −1,13…1,46, z −1,65…2,50 (10,15 m²). **El GLB sí tiene superficie caminable** (el supuesto previo "sin superficie" era falso); antes no tenía colisión. Barandas amarillas: pasamanos a y 4,71 e intermedio 4,18 en z = −1,65 (x −1,16…1,49), z = +2,50 (x −1,16…1,49), x = −1,15 (z −1,70…−0,90), x = +1,45 (z −1,70…−0,55 y 0,55…1,70). Aberturas: lado +X entre z −0,55 y 0,55 (llega la rampa de la V) y lado −X entre z −0,90 y 2,50 (hacia la casilla del carrier). Subestructura roja abierta: pórticos con parantes cada ≈0,6 m en z ≈ −1,55 y z ≈ +1,45 (y 0,4…3,35), parantes sueltos en z ≈ 2,45; lados ±X abiertos (se ve el BOP). | La "escalera a 45°" del `alcance` del meta **no está modelada** (no hay huellas). Acceso real en geometría: rampa de la V (planchada) y la casilla del carrier (ver carrier). | Ninguna. |
| `sk575_bop` | Nada transitable. Bajo el piso (y −0,6…3,61, x −0,89…1,62, z ±1,38); sobre el piso asoma solo el cuello (x ±0,32, z −0,32…0,51, hasta y 4,30). | — | Volante Ø≈0,51 en x 1,33, y 1,50 (lado +X, junto a la HCR); 6 volantes chicos Ø≈0,16 de trabas de ariete (z ±1,04/±1,37). Sin fuente que documente su operación. |
| `sk575_mastil` | Piso de enganche (`sk575_enganche_grating`) plano a **y = 20,651**, x −0,05…1,82, z ±1,19 (4,54 m²); barandas a y 21,73 en z = −1,20 y z = +1,24 (con panel rojo en +1,25…1,30), x −0,1…1,9; frente +X solo con parantes. Reticulado inclinado; su cara +X sigue x ≈ −0,69 + 0,0487·(y − 4,6). | **No hay escalera** del piso de trabajo (3,61) al piso de enganche (20,65). | Ninguna. |
| `sk575_planchada` | Pasarela `grating` plana a **y = 1,05**, x 4,97…16,95, z ±0,99 (23,75 m²), sobre caballetes. Rampa de la V `grating` a **24,8°**: borde alto (1,474; 3,624) contra el piso de trabajo, borde bajo (6,968; 1,088) sobre la pasarela, ancho 1,20 (z ±0,60). Caballetes y portatubos a y ≈ 0,5…1,12 en z ±6,81 (sin superficie de tránsito). | **No hay escalera** del suelo a la pasarela. La rampa **no tiene baranda** en el GLB aunque DROPS PT-4/PLA-2 la documenta. | Ninguna. |
| `sk575_piletas` | 3 piletas + trip tank con cubiertas `grating` y **escaleras reales a 43°**: pileta x 11,22…22,22 / z −30,0…−27,8 (y 2,051, escalera desde x 9,29, 8 huellas, contrahuella 0,223, huella 0,222, ancho 0,70); pileta x −10,78…0,22 / z −21,8…−19,6 (y 2,051, escalera desde x −12,71); pileta x −7,68…3,32 / z −16,6…−14,4 (y 2,051, escalera desde x −9,61); trip tank x 0,40…2,50 / z −12,9…−10,6 (y 2,639, escalera de 9 huellas a 0,26 desde x −2,07). Barandas amarillas a cubierta + 1,0 m en los dos lados largos de cada pileta y en tres lados del trip tank. Equipos sobre cubierta medidos: módulo rojo x 16,2…18,2 (hasta y 3,25), motor x 21,2…22,2 (hasta 3,95), tapa x −10,5…−9,6 (hasta 2,60, justo al llegar de la escalera), plataforma x −7,6…−5,5 (hasta 2,90, ocupa casi todo el ancho). Antes tenían una sola caja de colisión de 35,6 × 19,8 m que tapaba todo. | Nada: las escaleras existen. Limitación: las escaleras miden 0,70 m de ancho, igual que el diámetro de la cápsula del jugador. | Sin volantes identificables con certeza. |
| `sk575_carrier` | Plataforma del carrier `y = 1,35` (x −13,60…−2,93, z ±1,30) casi ocupada por motor, cuadro e izaje; escalera amarilla de 5 huellas (y 0,26…1,16, 45°, z 1,30…2,00) en x −11,45…−10,29; **escalera de la casilla** de 10 huellas (y 1,59…3,39, contrahuella 0,20, huella 0,145 → **54°**) en x −5,11…−3,55, z 0,60…1,30, que llega al piso de la casilla a y 3,55 (x −3,53…−1,46, z 0,60…2,67), contiguo a la abertura −X del piso de trabajo (y 3,61). Es el acceso real al piso de trabajo en la geometría. Escalones de cabina (y 0,65…1,28). | Se ve, pero no se habilitó: el carrier conserva su caja única (y hasta 6,03), entre el cuadro (z ≤ 1,19) y el borde (z 1,30) quedan 0,11 m de paso, y 54° supera la pendiente máxima del controlador (50°). | Ninguna. |
| `sk575_acumulador` | Patín con `grating` a y 0,20 (x −19,30…−16,65): se camina a nivel del suelo. | — | **6 válvulas con nombre**: `sk575_acum_valvula_4vias_1…5` (x −21,88…−20,98, y 0,30…1,14, z 3,60…3,93) y `sk575_acum_valvula_3vias_bypass` (x −22,07…−21,93, y hasta 1,32). Según el meta, de la unidad de referencia genérica CPC S/N 4650 (no es el equipo instalado). |
| `sk575_manifold` | Patín con `grating` a y 0,16…0,19: a nivel del suelo. | — | **12 válvulas con volante, rotuladas M1–M12** (rótulos `sk575_manifold_blanco`, texto en geometría leído sobre el GLB renderizado). Volantes Ø 0,44 m horizontales a y 1,24 (`sk575_manifold_acero_oscuro`), 0,2 m detrás de cada rótulo; uno más sin rótulo (Ø 0,31, x 7,78, z −10,40) y un actuador rojo. Meta: "Manifold de ahogo M1–M12". |
| `sk575_bomba` | Nada transitable (y hasta 2,81). | — | Aros de 0,22 m en x −14,95 (y 1,80): no se distinguen de bridas; el meta nombra "válvula de seguridad" sin nodo propio. |
| `sk575_cuadro` | Nada (va sobre el carrier, y 1,35…2,96; cables hasta la corona). | — | Ninguna. |
| `sk575_izaje` | Nada (cilindros). | — | Ninguna. |
| `sk575_llave` | Nada; cuelga sobre el pozo apoyada en el piso de trabajo (y 3,61…6,97, x −0,95…1,18, z ±1,07). Sin colisión (como antes). | — | Ninguna. |
| `sk575_aparejo` | Nada (y 10,6…32,4). | — | Ninguna. |
| `sk575_pozo_vecino` | Nada (árbol de navidad, ilustrativo). | — | 3 volantes Ø 0,49 (x 10,32 y 11,82 a y 1,10; x 11,07 a y 2,70). Ilustrativo según el meta; no se exportan. |
| `sk575_tiros` | Nada (tiros apoyados de y 3,63 a 22,31). Sin colisión. | — | Ninguna. |
| `sk575_vientos` | Nada (cables y anclajes de hormigón a nivel del suelo). Sin colisión. | — | Ninguna. |

## Qué se resolvió en la capa de adiciones

Detalle y medidas en `docs/scenario-additions.md`:

- **A1.** Escalera del suelo a la pasarela de la planchada, en el extremo +X (la pasarela no tiene acceso en el GLB).
- **A2.** Barandas de la rampa de la V (existencia documentada por DROPS PT-4 / PLA-2; medidas estimadas).
- **A3.** Escalera vertical del piso de trabajo al piso de enganche, frente a la cara +X del mástil (solo anclaje
  `LadderVolume` para el modo escalera de la Task 18B).
- No se agregan volantes: el manifold ya tiene M1–M12 con volante en el GLB. Son parte de una malla fusionada, así que la
  Task 18B no puede girarlos sin una copia superpuesta.

## Recorridos habilitados (colisión coherente con lo que se ve)

- Suelo → escalera A1 → pasarela (y 1,05) → rampa de la V (24,8°) → piso de trabajo (y 3,606). Probado en e2e.
- Suelo → escalera real → cubierta de cada pileta (y 2,051) y del trip tank (y 2,639). Probado en e2e la pileta del extremo +X.
- Piso de trabajo → escalera vertical A3 → piso de enganche (y 20,651): solo anclaje y plataforma, sin modo escalera (Task 18B).

## No disponible (no se inventa)

- Cotas reales de escaleras, barandas, peldaños, volantes y pisos (todo el material es confianza B/C, `as_built: false`).
- La escalera a 45° del piso de trabajo nombrada en el meta: no está en la geometría y no hay posición documentada.
- Posición y forma de la escalera de acceso al piso de enganche (el visor V2 la tenía; el GLB rig10 no).
- Abertura o trampa en la plancha del piso de enganche para la escalera (la plancha del GLB es continua).
- Estado (abierta/cerrada), función, secuencia y procedimiento de cualquier válvula; presiones; ruteo choke/kill (pendiente en el visor).
- Distancias de seguridad, zonas de exclusión y puntos DROPS de ubicación precisa: no se agregan.
