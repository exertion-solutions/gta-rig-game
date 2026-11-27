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

El resto del realismo (conos, vallado, cartelería, marcas de suelo, sombras de contacto) es procedural y propio.

## Publicación

El build queda listo para servirse bajo una sub-ruta (`npm run build:pages`), pero **publicarlo** (GitHub Pages u otro
hosting, o hacer público el repo) requiere la autorización del dueño del visor, otorgada el 2026-11-27 (ver arriba). Un sitio de Pages es público y expone los GLB. El build no incluye los `.meta.json`
internos, el número de serie del fabricante ni la marca comercial del acumulador (lo verifica `tests/unit/ui-publico.test.ts`).

## Textos en pantalla

El juego nunca dice "aprobado", "habilitado" ni "certificado". Las fichas citan el texto de las fuentes a través de
`uiSafe` (`src/game/data/evidence.ts`), que reformula "certificado" como "con certificación": esa raíz citada de la
fuente se acepta (decisión del dueño en la QA, D-05) y el texto no se cambia.
