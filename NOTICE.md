# Aviso

- Los GLB de `public/models/rig10/` y los `.meta.json` y GLB sin uso de `vendor/visor/models/` provienen del visor (commit en `assets.lock.json`). Los `.meta.json` son internos y no se copian al build. El visor es de Exertion Solutions; el repo se hizo público el 2026-11-27 con la autorización del dueño del visor (declarada por Jorge, quien ordenó la publicación).
- Signo lateral (+Y = este) sin verificar contra el layout interno.
- Geometría de confianza B/C, `as_built: false`: aproximada, no apta para fabricación ni certificada.
- El juego es ilustrativo. No es simulación, cálculo ni validación de seguridad.
- Nombres genéricos: sin marca de empresa ni documentos internos.

## Personaje (`public/models/character/worker.glb`)

Construido con `scripts/build-character.py` (Blender 5.2; reconstruido con Blender 5.3 al sumar `operate`, retarget + horneado, texturas webp 1024) y comprimido con `@gltf-transform/cli meshopt`. Sin cambios de diseño: sin logos ni marcas.

| Pieza | Origen | Autor | Licencia | URL |
| --- | --- | --- | --- | --- |
| Modelo `Construction_Male_07` (malla, esqueleto Biped, texturas color/normal) | Microsoft Rocketbox Avatar Library | Microsoft (Rocketbox Studios) | MIT | https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Professions/Construction_Male_07 |
| Clip `idle` (`m_idle_neutral_01.max.fbx`) | Microsoft Rocketbox, `Assets/Animations/all_animations_max_motextr_static` | Microsoft (Rocketbox Studios) | MIT | https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Animations/all_animations_max_motextr_static |
| Clip `walk` (`m_walk_neutral_01.max.fbx`, sin avance) | Microsoft Rocketbox, `Assets/Animations/all_animations_max_motextr_xy` | Microsoft (Rocketbox Studios) | MIT | https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Animations/all_animations_max_motextr_xy |
| Clip `run` (`m_run_neutral_01.max.fbx`, sin avance) | Microsoft Rocketbox, `Assets/Animations/all_animations_max_motextr_xy` | Microsoft (Rocketbox Studios) | MIT | https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Animations/all_animations_max_motextr_xy |
| Clip `operate` (`m_work_mid.max.fbx`, trabajo con las manos a media altura; se usa al operar una válvula) | Microsoft Rocketbox, `Assets/Animations/all_animations_max_motextr_static` | Microsoft (Rocketbox Studios) | MIT | https://github.com/microsoft/Microsoft-Rocketbox/blob/master/Assets/Animations/all_animations_max_motextr_static/m_work_mid.max.fbx (sha256 ee757d60b1b63b09d5cea245ba23d8435d2f03a173ca08b270142ec3d57e2e2a) |

Sin clip de **salto** ni de **trepar**: la biblioteca Rocketbox (474 animaciones revisadas en el árbol del repositorio) no
trae ninguno, y no se obtuvo otra fuente con licencia verificable y descarga directa compatible con este esqueleto Biped
(Quaternius Universal Animation Library es CC0 pero se descarga solo desde itch.io y usa otro esqueleto). Por eso `jump` y
`climb` son clips propios del proyecto, generados en código en tiempo de carga (`src/game/player/poseClips.ts`: rotaciones de
huesos sobre el primer cuadro de `idle`); no agregan archivos ni otra procedencia.

Texto de la licencia MIT de Rocketbox (https://github.com/microsoft/Microsoft-Rocketbox/blob/master/LICENSE.md):

```
MIT License

Copyright (c) 2020 Microsoft

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Adiciones al escenario (`public/models/scenario/additions.glb`)

Creado para este proyecto con `scripts/build-scenario.py` (Blender 5.3) y comprimido con `@gltf-transform/cli meshopt`:
escalera de la pasarela, barandas de la rampa de la V, escalera vertical al piso de enganche y baranda del frente +X del
piso de enganche. Geometría, materiales y la
textura de reja (procedimental, generada por el script) son propios; sin assets ni texturas de terceros. Escenario
ilustrativo añadido por el juego, no as-built (`docs/scenario-additions.md`).

## Realismo visual (cielo, suelo y tambor)

Tres assets CC0 (dominio público) de Poly Haven (https://polyhaven.com/license), sin marcas ni logos:

| Archivo | Asset | Autor | Licencia | Fuente |
|---|---|---|---|---|
| `public/hdri/sky_1k.hdr` (idéntico byte a byte al 1k original, sha256 fd94c849...) | Kloofendal 48d Partly Cloudy (Pure Sky) | Greg Zaal; ediciones del cielo: Jarod Guest | CC0 | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky |
| `public/textures/ground_{diff,nor,rough}.webp` (conversión a webp) | Gravel Ground 01 | Rob Tuytel | CC0 | https://polyhaven.com/a/gravel_ground_01 |
| `public/models/props/barrel.glb` (comprimido con meshopt/draco) | Barrel 03 | Serhii Khromov | CC0 | https://polyhaven.com/a/barrel_03 |

Texturas de la ruta, también CC0 de Poly Haven, color (diffuse) a 1k convertido a webp, sin marcas ni logos:

| Archivo | Asset | Autor | Licencia | Fuente |
|---|---|---|---|---|
| `public/textures/ruta_ripio.webp` | Gravel Road | Amal Kumar | CC0 | https://polyhaven.com/a/gravel_road |
| `public/textures/ruta_estepa.webp` | Dry Ground 01 | Rob Tuytel | CC0 | https://polyhaven.com/a/dry_ground_01 |
| `public/textures/ruta_asfalto.webp` | Road Damaged Clean | Dimitrios Savva | CC0 | https://polyhaven.com/a/road_damaged_clean |
| `public/textures/ruta_barda.webp` | Cliff Side | James Ray Cock, Jenelle van Heerden, Dario Barresi | CC0 | https://polyhaven.com/a/cliff_side |

Ciudad y tránsito de la ruta: modelos CC0 de Kenney (https://kenney.nl, licencia en cada kit: Creative Commons Zero), sin marcas ni logos. `scripts/build-kenney.py` junta los 64 modelos elegidos en un solo archivo, comprimido con Draco:

| Archivo | Kit | Autor | Licencia | Fuente |
|---|---|---|---|---|
| `public/models/ruta/kenney.glb` (autos, camionetas, camiones) | Car Kit 3.1 | Kenney | CC0 | https://kenney.nl/assets/car-kit |
| `public/models/ruta/kenney.glb` (comercios, torres, edificios lejanos) | City Kit (Commercial) | Kenney | CC0 | https://kenney.nl/assets/city-kit-commercial |
| `public/models/ruta/kenney.glb` (casas) | City Kit (Suburban) | Kenney | CC0 | https://kenney.nl/assets/city-kit-suburban |

Dos modelos generados con 3D AI Studio (modelo Prism 3.1, texto a 3D, cuenta del dueño del proyecto, 2026-11-28), reducidos de ≈1,4 M a pocos miles de triángulos y comprimidos con Draco. El sitio declara que lo generado es del usuario y admite uso comercial (https://www.3daistudio.com/Pricing, leído el 2026-11-28); no se revisaron los términos completos:

| Archivo | Pedido (prompt) |
|---|---|
| `public/models/ruta/cisterna.glb` | camión cisterna low-poly, cabina blanca, tanque plateado, sin logos ni texto |
| `public/models/ruta/guanaco.glb` | guanaco low-poly, lomo canela, panza blanca |

El resto del realismo (conos, cartelería, marcas de suelo, sombras de contacto) y lo demás que puebla la ruta (terreno, veredas, playón, semáforos, árboles, ovejas, caballos, obstáculos) es procedural y propio.

La camioneta (`public/models/vehicle/pickup.glb`) es un modelo propio de pickup doble cabina, sin marcas, logos ni texto, generado por `scripts/build-truck.py` (Blender) y comprimido con meshopt.

## Voces y ambiente de audio

- **Voces de la radio** (`public/audio/voice/*.mp3`): síntesis de voz **local**, sin servicios en la nube ni claves. El texto sale de las
  misiones y de las frases de enlace del propio juego (`src/audio/radio.ts`, `src/game/missions/defs/`); `npm run gen-voice`
  (`scripts/gen-voice.mjs`) lo sintetiza con la voz del sistema **Microsoft Sabina Desktop (es-MX)** vía Windows SAPI (`System.Speech`) y
  lo procesa con **ffmpeg** (paso de banda 300-3400 Hz, compresión, saturación suave y ruido blanco suave; mono, 48 kbps).
  `public/audio/voice/manifest.json` (versionado) guarda id, archivo, duración, texto y sha256 de cada línea.
- **Pendiente de confirmar:** que la licencia de la voz del sistema (componente de Windows) permita redistribuir el audio generado. Hasta
  confirmarlo, **los .mp3 de voz no están en el repo** (`.gitignore`): se generan en `predev`/`prebuild` si hay una voz española
  instalada; sin ella (por ejemplo en CI) el juego muestra solo los subtítulos. No publicar un build con voces sin confirmar la licencia.
- **Ambiente** (`public/audio/ambient/rig-lejano.mp3`, versionado): bucle de 8 s de viento, rumor grave y zumbido lejano, generado con los
  filtros de ffmpeg (`anoisesrc`, `sine`, pasabajos/pasaaltos) en `scripts/gen-voice.mjs`; síntesis propia, sin muestras ni licencias externas.

## Publicación

El build queda listo para servirse bajo una sub-ruta (`npm run build:pages`), pero **publicarlo** (GitHub Pages u otro
hosting, o hacer público el repo) requiere la autorización del dueño del visor, otorgada el 2026-11-27 (ver arriba). Un sitio de Pages es público y expone los GLB. El build no incluye los `.meta.json`
internos, el número de serie del fabricante ni la marca comercial del acumulador (lo verifica `tests/unit/ui-publico.test.ts`).

## Textos en pantalla

El juego nunca dice "aprobado", "habilitado" ni "certificado". Las fichas citan el texto de las fuentes a través de
`uiSafe` (`src/game/data/evidence.ts`), que reformula "certificado" como "con certificación": esa raíz citada de la
fuente se acepta (decisión del dueño en la QA, D-05) y el texto no se cambia.

## Mejoras gráficas (posproceso, materiales, suelo)
Oclusión ambiental por profundidad (DepthAO.ts), suciedad/desgaste procedural y luz de borde (MaterialUpgrade.tsx) y manchas de gran escala del suelo (GroundMaterial.tsx): código original del proyecto, sin texturas ni assets de terceros nuevos.
