# Estado de QA (Task 20, bloques a, c y d)

Fecha: 2026-11-27. Rama de trabajo: la del worktree sobre `feat/gta-rig-game`. Nada se publicó ni se desplegó.

## Qué se probó

Recorrido de jugador nuevo con Playwright headless (Chromium, SwiftShader) y los ganchos DEV `window.__game`:
carga, caminar, correr, frenar, saltar, agacharse, subir y conducir la camioneta (aceleración, giro, freno, bajar),
día/noche (6, 12, 18,5 y 0 h), panel de misiones, mapa, pausa, ficha, modo foto, tres anchos de pantalla
(1280x720, 1920x1080, 390x844 y 1024x600) y consola del navegador. La suite e2e previa ya cubre escaleras,
válvulas, misiones 1 a 7, guardado y recarga, gamepad simulado (unitario) y superposición del HUD en 5 tamaños.

Medidas del manejo (SwiftShader, no son de una GPU real): caminar ~1,4 m/s, correr ~4,5 m/s, salto ~0,59 m de altura,
agachado ~0,8 m/s, camioneta ~12 m/s tras 2,4 s de acelerador y se detiene al frenar.

## Defectos

| Id | Severidad | Defecto | Estado |
|----|-----------|---------|--------|
| QA-1 | Alta | La foto (P) y la captura de pantalla salían con el 3D en blanco: un `useFrame` con prioridad positiva cambió el orden de render. Lo introdujo el propio modo foto durante este trabajo; lo detectó la revisión visual. | Corregido: captura con `addAfterEffect`; el e2e cuenta colores de la imagen (`share.e2e.ts`). |
| QA-4 | Media | Agacharse (C) solo bajaba la velocidad y la cámara: el personaje seguía parado. | Corregido: clip `crouch` (pose fija, pelvis ~0,9 a ~0,6 m medida en el esqueleto); tests unitarios y e2e (`qol.e2e.ts`). Límite: en el render de captura (SwiftShader) la imagen del personaje agachado no se pudo confirmar a simple vista; lo que se verificó es la pose del esqueleto. Revisar a ojo con GPU. |
| QA-5 | Baja | Con un obstáculo pegado detrás (consola del acumulador, mirando hacia ±X) la cámara se acerca a ~0,3 a 0,5 m y la espalda del personaje llena la pantalla. Es el comportamiento de colisión de cámara, no atraviesa geometría. | Sin corregir: ocultar o desvanecer al personaje bajo ~1 m de distancia. |
| QA-2 | Baja | Con SwiftShader la calidad automática baja a "baja" y el sol deja de proyectar sombra (`castShadow: false` a mediodía). Es la degradación adaptativa a propósito. | No es defecto; se anota. |
| QA-3 | Baja | Advertencias de consola de terceros: `THREE.Clock` deprecado, "using deprecated parameters" y "GPU stall due to ReadPixels" (SwiftShader). | Sin corregir: vienen de las librerías o del renderizador por software. |

## Compartible (sin publicar)

- Modo foto: tecla P oculta el HUD; Intro o el botón descargan un PNG con la marca "Referencia digital, ilustrativo". Esc o P salen.
- Tarjeta de misión completada (1200x630, solo texto: título, objetivos cumplidos y resumen de registro propio) y botón para copiar el enlace.
- Enlace `?mision=m3` (id corto o completo): la misión queda en curso al tocar Jugar (o ya, sin pantalla de título).
- Tests: `tests/unit/share.test.ts`, `tests/e2e/share.e2e.ts`; `tests/unit/ui-publico.test.ts` sigue verde.

## Límites conocidos

- Todo se midió con renderizado por software: los FPS y tiempos no representan una GPU real. Falta probar en un equipo con GPU.
- Gamepad: solo la lógica de mapeo (unitaria); no se probó con un mando físico.
- Sin clip grabable (MediaRecorder) del bloque d: no se hizo.
- Modo foto: el PNG sale con el tamaño del canvas; no hay selector de resolución.
- Descarga de la tarjeta y copia del enlace dependen de permisos del navegador (portapapeles).
- Táctil y móvil siguen fuera de alcance.

## Antes de publicar (requiere confirmación explícita del dueño)

1. Autorización escrita del dueño del visor de origen para publicar el juego y sus GLB.
2. Retirar datos internos y metadatos de lo que se empaqueta (`tests/unit/ui-publico.test.ts` ya vigila `public/`, `src/` y `dist/`).
3. Revisar la licencia de cada asset y completar `NOTICE.md`.
4. `npm run build` y revisar `dist/` con el test anterior; elegir el hosting recién entonces.
