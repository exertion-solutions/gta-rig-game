# Estado de QA (Task 20)

Fecha: 2026-11-27. Rama de trabajo: la del worktree sobre `feat/gta-rig-game`. Nada se publicó ni se desplegó.

## Qué se probó

Recorrido de jugador nuevo con Playwright headless (Chromium, SwiftShader) y los ganchos DEV `window.__game`:
carga, caminar, correr, frenar, saltar, agacharse, subir y conducir la camioneta (aceleración, giro, freno, bajar),
día/noche (6, 12, 18,5 y 0 h), panel de misiones, mapa, pausa, ficha, modo foto, tres anchos de pantalla
(1280x720, 1920x1080, 390x844 y 1024x600) y consola del navegador. La suite e2e previa ya cubre escaleras,
válvulas, misiones 1 a 7, guardado y recarga, gamepad simulado (unitario) y superposición del HUD en 5 tamaños.

Medidas del manejo (SwiftShader, no son de una GPU real): caminar ~1,4 m/s, correr ~4,5 m/s, salto ~0,59 m medido en esa corrida (el valor de juego pasó después a 0,68 m),
agachado ~0,8 m/s, camioneta ~12 m/s tras 2,4 s de acelerador y se detiene al frenar.

## Defectos

| Id | Severidad | Defecto | Estado |
|----|-----------|---------|--------|
| QA-1 | Alta | La foto (P) y la captura de pantalla salían con el 3D en blanco: un `useFrame` con prioridad positiva cambió el orden de render. Lo introdujo el propio modo foto durante este trabajo; lo detectó la revisión visual. | Corregido: captura con `addAfterEffect`; el e2e cuenta colores de la imagen (`share.e2e.ts`). |
| QA-4 | Media | Agacharse (C) solo bajaba la velocidad y la cámara: el personaje seguía parado. | Corregido: clip `crouch` (pose fija, pelvis ~0,9 a ~0,6 m medida en el esqueleto); tests unitarios y e2e (`qol.e2e.ts`). Límite: en el render de captura (SwiftShader) la imagen del personaje agachado no se pudo confirmar a simple vista; lo que se verificó es la pose del esqueleto. Revisar a ojo con GPU. |
| QA-5 | Baja | Con un obstáculo pegado detrás (consola del acumulador, mirando hacia ±X) la cámara se acerca a ~0,3 a 0,5 m y la espalda del personaje llena la pantalla. Es el comportamiento de colisión de cámara, no atraviesa geometría. | Corregido: el personaje se desvanece con la cámara pegada al obstáculo y el alejamiento se suaviza. |
| QA-2 | Baja | Con SwiftShader la calidad automática baja a "baja" y el sol deja de proyectar sombra (`castShadow: false` a mediodía). Es la degradación adaptativa a propósito. | No es defecto; se anota. |
| QA-3 | Baja | Advertencias de consola de terceros: `THREE.Clock` deprecado, "using deprecated parameters" y "GPU stall due to ReadPixels" (SwiftShader). | Sin corregir: vienen de las librerías o del renderizador por software. |


## Qué se mejoró en esta sesión

- Controles visibles: ayuda de teclas siempre en pantalla (pantallas anchas) y en la pausa.
- Manejo: aceleración suave, buffer de salto (admite pulsar un instante antes de tocar el suelo) y salto de 0,68 m; agacharse (C o Ctrl izq.) con clip y pose propios; correr fijo con V.
- Mando: mapeo puro (`mapGamepad`) conectado a jugador y camioneta (mover, mirar, correr, saltar, usar).
- Pausa (Esc) con ajustes guardados (sensibilidad, invertir Y, volumen, calidad), mapa completo (Tab), pantalla de título con inicio en un clic y carga con progreso real.
- Realismo: cielo HDRI, suelo PBR, props, sombras de contacto, posproceso (bloom y ACES en calidad alta) y calidad adaptativa enlazada al ajuste.
- Camioneta: modelo procedural con cabina, caja, vidrios, luces, llantas, suspensión visual, giro según la velocidad y faros de noche.
- Cámara: el personaje se desvanece cuando la cámara queda pegada a un obstáculo y el alejamiento se suaviza (cierra QA-5).
- Compartible: modo foto (P), clip de hasta 10 s (R), tarjeta de misión completada y enlace `?mision=`.
- Robustez: la calidad automática arranca según la GPU (integrada o desconocida = Media; RTX, GTX o Radeon RX = Alta), baja de nivel en ~30 cuadros si cae de 30 FPS, y un error en el posproceso o en la escena ya no deja la pantalla en blanco (`ErrorBoundary`: el posproceso se apaga solo; si falla la escena hay aviso y botón para reintentar en calidad baja). Tests: `tests/unit/robustez.test.ts`. Límite: el aviso de la escena no se probó provocando un fallo real de WebGL.
- Documentación: README con controles, mando, modo foto y clip, parámetros de URL y estructura del repo.

## Compartible (sin publicar)

- Modo foto: tecla P oculta el HUD; Intro o el botón descargan un PNG con la marca "Referencia digital, ilustrativo". Esc o P salen.
- Clip: R (o el botón de la barra) graba hasta 10 s con cuenta regresiva en pantalla y descarga `clip-locacion.webm`. Se dibuja el juego y la marca en un canvas auxiliar y se graba ese, así que la marca va dentro del video. Si el navegador no tiene `MediaRecorder` o `captureStream`, el botón queda desactivado ("Clip no disponible"). El e2e verifica que se baja un `.webm` válido (cabecera EBML) en Chromium headless; no se revisó a ojo el contenido del video ni se probó en Firefox o Safari.
- Tarjeta de misión completada (1200x630, solo texto: título, objetivos cumplidos y resumen de registro propio) y botón para copiar el enlace.
- Enlace `?mision=m3` (id corto o completo): la misión queda en curso al tocar Jugar (o ya, sin pantalla de título).
- Tests: `tests/unit/share.test.ts`, `tests/e2e/share.e2e.ts`; `tests/unit/ui-publico.test.ts` sigue verde.

## Lo que falta

- Probar en un equipo con GPU y con un mando físico; revisar a ojo el personaje agachado y el clip grabado.
- Voz de la radio: no hay mp3 generados (`manifest.json` vacío); solo subtítulos y sonidos procedurales. La Task 11 del plan queda sin marcar por eso.
- Misión 8 omitida por falta de dato en las fuentes vendorizadas.
- Intro en video (Task 14, opcional): no se hizo.
- Selector de resolución para foto y clip; táctil y móvil.
- Cierre de la Task 20 (e): suite completa verde dos veces seguidas, build de producción y auditoría final.

## Límites conocidos

- Los e2e corren con renderizado por software. FPS con GPU real (Iris Xe, headless): ver `docs/perf.md`. Falta probar a ojo en una ventana visible y con GPU dedicada.
- Gamepad: solo la lógica de mapeo (unitaria); no se probó con un mando físico.
- Foto y clip salen con el tamaño del canvas; no hay selector de resolución.
- Descarga de la tarjeta y copia del enlace dependen de permisos del navegador (portapapeles).
- Táctil y móvil siguen fuera de alcance.

## Antes de publicar (requiere confirmación explícita del dueño)

1. Autorización escrita del dueño del visor de origen para publicar el juego y sus GLB.
2. Retirar datos internos y metadatos de lo que se empaqueta (`tests/unit/ui-publico.test.ts` ya vigila `public/`, `src/` y `dist/`).
3. Revisar la licencia de cada asset y completar `NOTICE.md`.
4. `npm run build` y revisar `dist/` con el test anterior; elegir el hosting recién entonces.
