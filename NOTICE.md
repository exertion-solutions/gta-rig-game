# Aviso

- Los GLB y `.meta.json` de `public/models/rig10/` provienen del visor (commit en `assets.lock.json`). El visor es privado y sin licencia: **este repo debe permanecer privado** hasta autorización escrita del dueño.
- Geometría de confianza B/C, `as_built: false`: aproximada, no apta para fabricación ni certificada.
- El juego es ilustrativo. No es simulación, cálculo ni validación de seguridad.
- Nombres genéricos: sin marca de empresa ni documentos internos.

## Personaje (`public/models/character/worker.glb`)

Construido con `scripts/build-character.py` (Blender 5.2, retarget + horneado, texturas webp 1024) y comprimido con `@gltf-transform/cli meshopt`. Sin cambios de diseño: sin logos ni marcas.

| Pieza | Origen | Autor | Licencia | URL |
| --- | --- | --- | --- | --- |
| Modelo `Construction_Male_07` (malla, esqueleto Biped, texturas color/normal) | Microsoft Rocketbox Avatar Library | Microsoft (Rocketbox Studios) | MIT | https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Professions/Construction_Male_07 |
| Clip `idle` (`m_idle_neutral_01.max.fbx`) | Microsoft Rocketbox, `Assets/Animations/all_animations_max_motextr_static` | Microsoft (Rocketbox Studios) | MIT | https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Animations/all_animations_max_motextr_static |
| Clip `walk` (`m_walk_neutral_01.max.fbx`, sin avance) | Microsoft Rocketbox, `Assets/Animations/all_animations_max_motextr_xy` | Microsoft (Rocketbox Studios) | MIT | https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Animations/all_animations_max_motextr_xy |
| Clip `run` (`m_run_neutral_01.max.fbx`, sin avance) | Microsoft Rocketbox, `Assets/Animations/all_animations_max_motextr_xy` | Microsoft (Rocketbox Studios) | MIT | https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Animations/all_animations_max_motextr_xy |

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
