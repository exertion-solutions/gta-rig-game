# GTA RIG GAME Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Juego web 3D de misiones en tercera persona (a pie + camioneta) para recorrer el Equipo 10 (SK-575) con 8 misiones de inducción basadas en datos documentados.

**Architecture:** App React + R3F. Lógica pura (movimiento, cámara, radar, misiones, reglas de evidencia) en módulos sin React, testeados con Vitest. Rapier aporta física con cajas de colisión derivadas de los bounding boxes de los GLB. Datos y GLB del visor se traen con `sync-assets` a un commit fijado.

**Tech Stack:** React 19, TypeScript ~6.0, Vite 8, three, @react-three/fiber 9, drei 10, zustand, Tailwind 4, @react-three/rapier, Vitest, Playwright (e2e), npm. Versiones exactas: `npm view` antes de instalar.

**Spec:** `docs/superpowers/specs/2026-11-26-gta-rig-game-design.md`

## Global Constraints

- Repo privado `exertion-solutions/gta-rig-game`; nunca público sin autorización escrita del dueño.
- Marco: 1 unidad = 1 m, Y arriba, origen en la boca de pozo, +X hacia el mástil, carrier en −X. Signo lateral (+Y = este) sin verificar: rótulo visible en HUD y `NOTICE.md`.
- Geometría confianza B/C, `as_built: false`. El juego es ilustrativo, no es simulación ni validación de seguridad.
- Estatus de evidencia solo: `confirmed`, `procedure`, `goodPractice`, `pendingValidation`. Solo `confirmed` y `procedure` se presentan como requisito.
- Todo dato numérico o de seguridad en pantalla lleva `sourceId` y su insignia de evidencia. Fuentes en conflicto: se muestran ambas, rotuladas "Fuente en conflicto".
- Prohibido en pantalla: distancias, radios, zonas de exclusión, "área segura", "aprobado/habilitado/certificado", marca de empresa, documentos internos, fotos del equipo real.
- Zonas Alto/Medio/Bajo solo como texto en fichas; nunca dibujadas en radar, piso ni volúmenes.
- Sin policía, armas, violencia, tráfico, multijugador, economía ni simulación de izamiento.
- Descartar las aristas LINES horneadas de los GLB. Texturas en webp (sin KTX2).
- Presupuesto: escritorio 60 FPS, <250 draw calls, <1 M triángulos visibles; móvil solo "no se rompe".
- Misión sin datos o con datos que no coinciden con la fuente: se reduce u omite, nunca se inventa.
- Voz: español, audio estático generado una vez con ElevenLabs; sin claves de API en runtime.
- Gestor npm. Sin secretos en Git (`.env*` ignorados salvo `.env.example`).

## Review Focus

1. Dato de misión ausente o distinto de la fuente: la misión se omite con aviso en consola y el juego sigue (Task 10).
2. GLB o `.meta.json` faltante o con hash distinto del lock: el arranque falla con mensaje claro, sin pantalla en blanco (Tasks 1, 2).
3. Jugador o camioneta fuera del vallado o volcada: se reubica en el Acceso (Tasks 4, 6).
4. `localStorage` no disponible (ventana privada): el juego funciona sin persistir el registro (Task 8).
5. Fuente en conflicto (vientos 25 ± 3 m vs 20 m): se muestran las dos cifras, nunca una sola (Task 10).

## Ejecutores

Claude (agentes `ruflo-core:coder` en worktrees) salvo donde dice **Codex**. Codex se invoca con `codex exec` en un worktree propio y devuelve rama + resultado de tests. Cada tarea termina con tests verdes y commit.

## Estructura de archivos

```
package.json, vite.config.ts, tsconfig.json, index.html, .gitattributes
scripts/{sync-assets.mjs, check-assets.mjs, gen-voice.mjs}
public/models/rig10/*          (ya copiado)
vendor/visor/{viewpoints.json, drops.json, secuencia.json, types.ts}   (solo lectura)
src/app/{main.tsx, App.tsx}
src/game/world/{frame.ts, loadRig.tsx, stripLines.ts, colliders.ts, Ground.tsx, DayNight.tsx}
src/game/player/{movement.ts, Player.tsx}
src/game/camera/{followCamera.ts, FollowCamera.tsx}
src/game/vehicle/{truckModel.ts, Truck.tsx, enterExit.ts}
src/game/data/{evidence.ts, sectors.ts, ficha.ts}
src/game/missions/{types.ts, engine.ts, store.ts, defs/m1..m8.ts}
src/ui/{Hud.tsx, Radar.tsx, radarProjection.ts, MissionPanel.tsx, Ficha.tsx, EvidenceBadge.tsx, Legend.tsx}
src/audio/{radio.ts, sfx.ts}
tests/{unit/*.test.ts, e2e/*.e2e.ts, ui-publico.test.ts}
```

---


## Herramientas disponibles en esta PC (relevadas 2026-11-26; a usar en las Tasks 16 y 18)

Instaladas: AutoCAD 2027 (con "Autodesk AutoCAD MCP Server" instalado), Autodesk Fusion, Rhino 9, Blender 5.3, QGIS 4.0.2. Conectadas a esta sesión de Claude Code: Blender (herramientas `mcp__blender__*`) y Rhino (`mcp__rhino__*`). AutoCAD y Fusion están instaladas pero no expuestas como herramientas MCP en esta sesión: se pueden usar por línea de comandos o scripts (AutoCAD: `accoreconsole.exe` con scripts .scr/.lsp; Fusion: skill `fusion-cad`) o habilitando su conexión.

Cadena de modelado para las adiciones al escenario: (1) dimensionar y modelar piezas paramétricas (escaleras, barandas, plataformas, volantes) en Rhino o Fusion/AutoCAD con proporciones reales y registrar cada medida y su origen (medida de GLB o estimada) en `docs/scenario-additions.md`; (2) exportar a glTF/STEP; (3) limpieza, UV, materiales PBR y decimación en Blender; (4) compresión con `@gltf-transform/cli` (meshopt); (5) integración con colisión simplificada. Los agentes eligen la herramienta por pieza y dejan constancia en `NOTICE.md` y en el inventario. Prohibido enviar datos del proyecto a servicios externos para esto; todo corre local.

### Task 1: Scaffold y sync-assets

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.gitattributes`, `scripts/sync-assets.mjs`, `scripts/check-assets.mjs`, `src/app/main.tsx`, `src/app/App.tsx`
- Modify: `assets.lock.json` (agrega `vendor` con sha256 de cada archivo vendorizado)
- Test: `tests/unit/assets.test.ts`

**Interfaces:**
- Produces: `npm run dev|build|test|typecheck`; `checkAssets(lockPath: string, root: string): { ok: boolean; missing: string[]; mismatched: string[] }` exportada desde `scripts/check-assets.mjs`; `npm run sync-assets` baja `public/models/rig10/*` y `vendor/visor/*` del visor al commit de `assets.lock.json`, y `.gitattributes` fija `*.json text eol=lf` y `*.glb binary`.

- [x] **Step 1: Test `checkAssets reporta ok con los 36 archivos de rig10`** y `checkAssets reporta mismatched si se altera un byte` y `checkAssets reporta missing si falta un archivo` (usa copia temporal del directorio).
- [x] **Step 2: Correr `npx vitest run tests/unit/assets.test.ts`; esperar FAIL (módulo inexistente).**
- [x] **Step 3: Implementar `checkAssets` con sha256 de Node; scaffold Vite+React+TS+Tailwind+Vitest; `App.tsx` renderiza "GTA RIG GAME"; si `checkAssets` falla en `predev`/`prebuild`, el script sale con código 1 y lista los archivos.**
- [x] **Step 4: Correr tests y `npm run build`; esperar PASS.**
- [x] **Step 5: Commit `feat: scaffold, sync-assets y verificación de hashes`.**

### Task 2: Marco del mundo y carga de GLB

**Files:**
- Create: `src/game/world/frame.ts`, `src/game/world/stripLines.ts`, `src/game/world/loadRig.tsx`
- Test: `tests/unit/world.test.ts`

**Interfaces:**
- Consumes: archivos de `public/models/rig10/` (Task 1).
- Produces: `LOCACION_M = { x: number; z: number }` (78.5 y 61; el implementador confirma ejes contra `locacion` en `vendor/visor/viewpoints.json`); `stripLines(root: THREE.Object3D): number` (quita `LineSegments`/`Line`, devuelve cuántos); `RIG_PARTS: readonly { id: string; glb: string; meta: string; role: 'collide'|'scenery'|'walkable' }[]` con los 16 `sk575_*` según el inventario del spec (mástil, piletas, planchada, piso = colisión/caminable; resto escenografía; vientos y tiros sin colisión); `<RigScene />` carga con Meshopt y Draco locales.

- [x] **Step 1: Tests** `stripLines elimina todos los Line y deja los Mesh` (escena sintética), `RIG_PARTS tiene 16 entradas con glb y meta existentes en disco`, y `bounding box de sk575_mastil está dentro de LOCACION_M` (carga GLB con GLTFLoader en Node, tolerancia documentada en el test).
- [x] **Step 2: Correr; esperar FAIL.**
- [x] **Step 3: Implementar los tres módulos; `<RigScene />` muestra todo con luz hemisférica y OrbitControls provisional en `App.tsx`.**
- [x] **Step 4: Correr tests; verificar a ojo con `npm run dev` y captura (Playwright) que el equipo se ve completo.**
- [x] **Step 5: Commit `feat: marco del visor y carga de GLB sin aristas`.**

### Task 3: Colisiones y suelo — **Codex**

**Files:**
- Create: `src/game/world/colliders.ts`, `src/game/world/Ground.tsx`
- Test: `tests/unit/colliders.test.ts`

**Interfaces:**
- Consumes: `RIG_PARTS`, `LOCACION_M` (Task 2).
- Produces: `boxFromBounds(b: THREE.Box3, margin?: number): { center: [number, number, number]; half: [number, number, number] }`; `buildColliders(parts: LoadedPart[]): ColliderDesc[]` (cajas por componente `collide`; 1 convex hull permitido para mástil, BOP y carrier); `<Ground />` plano liso de `LOCACION_M` con collider y vallado invisible en el borde; `<PhysicsWorld>` envuelve la escena con `@react-three/rapier`.

- [x] **Step 1: Tests** `boxFromBounds devuelve centro y semi-ejes correctos para un Box3 conocido`, `buildColliders no genera trimesh` (assert tipos), `buildColliders omite vientos y tiros`.
- [x] **Step 2: Correr; esperar FAIL.**
- [x] **Step 3: Implementar; instalar `@react-three/rapier` con la versión compatible con fiber 9 (`npm view`).**
- [x] **Step 4: Correr tests y medir carga: el bundle crece menos de ~1,2 MB por el WASM.**
- [x] **Step 5: Commit `feat: colisiones por cajas y suelo`.**

### Task 4: Jugador a pie — **Codex**

**Files:**
- Create: `src/game/player/movement.ts`, `src/game/player/Player.tsx`
- Test: `tests/unit/movement.test.ts`, `tests/e2e/player.e2e.ts`

**Interfaces:**
- Consumes: `PhysicsWorld`, `LOCACION_M` (Task 3).
- Produces: `WALK_SPEED = 1.4`, `RUN_SPEED = 4.5`, `PLAYER_RADIUS = 0.35`, `EYE_HEIGHT = 1.7`; `stepMovement(input: { x: number; z: number; run: boolean }, yaw: number, dt: number): { vx: number; vz: number }`; `clampToBounds(p: Vec3, bounds: { x: number; z: number }): Vec3`; `<Player />` con `KinematicCharacterController` y cápsula, teclado WASD + mouse; `usePlayerStore` con `{ position, yaw, mode: 'foot' | 'truck' }`.

- [x] **Step 1: Tests** `stepMovement diagonal no supera RUN_SPEED`, `stepMovement sin input devuelve 0`, `clampToBounds reubica un punto fuera del vallado al borde`, y e2e `el jugador no atraviesa la caja del mástil` (3 s de avance contra el mástil; posición final fuera del bounding box).
- [x] **Step 2: Correr; esperar FAIL.**
- [x] **Step 3: Implementar; si `|y| > 5` o fuera del vallado, reubicar en el Acceso (`sectors` de Task 7; hasta entonces `[−35, 0, 0]` provisional documentado en el código).**
- [x] **Step 4: Correr unit y e2e; esperar PASS.**
- [x] **Step 5: Commit `feat: jugador a pie con colisiones`.**

### Task 5: Cámara de seguimiento

**Files:**
- Create: `src/game/camera/followCamera.ts`, `src/game/camera/FollowCamera.tsx`
- Test: `tests/unit/followCamera.test.ts`

**Interfaces:**
- Consumes: `usePlayerStore` (Task 4).
- Produces: `computeCameraTarget(target: Vec3, yaw: number, pitch: number, distance: number): Vec3`; `resolveCameraCollision(origin: Vec3, desired: Vec3, hit: (o: Vec3, d: Vec3) => number | null, margin: number): Vec3` (acerca la cámara si el rayo choca); `<FollowCamera />` con lerp y control de mouse.

- [x] **Step 1: Tests** `computeCameraTarget con yaw 0 queda detrás del objetivo a distance`, `resolveCameraCollision acerca la cámara al punto de choque menos margin`, `resolveCameraCollision sin choque devuelve desired`.
- [x] **Step 2: Correr; esperar FAIL.**
- [x] **Step 3: Implementar funciones puras; el componente usa `useFrame` y el raycast de Rapier.**
- [x] **Step 4: Correr tests; esperar PASS.**
- [x] **Step 5: Commit `feat: cámara de seguimiento con colisión`.**

### Task 6: Camioneta y subir/bajar — **Codex**

**Files:**
- Create: `src/game/vehicle/truckModel.ts`, `src/game/vehicle/Truck.tsx`, `src/game/vehicle/enterExit.ts`, `public/models/vehicle/truck.glb` (modelada con Blender MCP o CC0 con licencia anotada en `NOTICE.md`)
- Test: `tests/unit/enterExit.test.ts`, `tests/e2e/truck.e2e.ts`

**Interfaces:**
- Consumes: `usePlayerStore`, `PhysicsWorld`.
- Produces: `TRUCK = { maxSpeed: 12, wheelBase: number, ... }` (valores arcade, sin pretensión realista); `canEnter(player: Vec3, truck: Vec3, radius?: number): boolean` (radio por defecto 2.5 m, solo interacción de juego, no se muestra); `<Truck />` con `DynamicRayCastVehicleController`; tecla `E` alterna `mode`; `respawnTruck()` en el Acceso si volcó (>60° de inclinación 3 s) o salió del vallado.

- [x] **Step 1: Tests** `canEnter es true dentro del radio y false fuera`, `E alterna foot→truck→foot` (store), e2e `la camioneta acelera y se detiene sin atravesar el mástil`.
- [x] **Step 2: Correr; esperar FAIL.**
- [x] **Step 3: Implementar; modelar camioneta low-poly (<8 k triángulos) y registrar origen y licencia.**
- [x] **Step 4: Correr unit y e2e; esperar PASS.**
- [x] **Step 5: Commit `feat: camioneta conducible y entrar/salir`.**

### Task 7: Capa de datos y reglas de evidencia

**Files:**
- Create: `src/game/data/evidence.ts`, `src/game/data/sectors.ts`, `src/game/data/ficha.ts`, `src/ui/EvidenceBadge.tsx`, `src/ui/Ficha.tsx`
- Modify: `scripts/sync-assets.mjs` (suma `vendor/visor/{viewpoints,drops,secuencia}.json`; `secuencia.md` del visor se convierte a JSON con los 8 pasos y estatus `pendingValidation`)
- Test: `tests/unit/evidence.test.ts`, `tests/unit/sectors.test.ts`

**Interfaces:**
- Produces: `type Evidence = 'confirmed'|'procedure'|'goodPractice'|'pendingValidation'`; `canBePresentedAsRequirement(e: Evidence): boolean` (true solo para `confirmed` y `procedure`); `getSectors(): Sector[]` con `{ id: string; name: string; position: Vec3 | null; ... }` desde `viewpoints.json` y `layout_locacion.json` (`position: null` si no hay posición documentada); `buildFicha(sectorId: string): Ficha` con puntos DROPS, `sourceId`, evidencia y leyenda "referencia digital, no as-built / ilustrativo".

- [x] **Step 1: Tests** `canBePresentedAsRequirement` para los 4 valores; `getSectors devuelve 14 sectores`; `un sector sin posición documentada tiene position null`; `buildFicha incluye sourceId en cada dato numérico`; `buildFicha nunca incluye radios ni distancias de zona`.
- [x] **Step 2: Correr; esperar FAIL.**
- [x] **Step 3: Implementar; la ficha muestra la zona A2 solo como texto, con el conflicto A2/RCCO en boca de pozo cuando existe.**
- [x] **Step 4: Correr tests; esperar PASS.**
- [x] **Step 5: Commit `feat: datos del visor, evidencia y fichas`.**

### Task 8: Motor de misiones

**Files:**
- Create: `src/game/missions/types.ts`, `src/game/missions/engine.ts`, `src/game/missions/store.ts`
- Test: `tests/unit/missions.test.ts`

**Interfaces:**
- Consumes: `Sector`, `Ficha` (Task 7).
- Produces: `type Objective = { id: string; kind: 'reach'|'visitAll'|'choose'|'order'|'mark'; ... }`; `type MissionDef = { id: string; title: string; briefing: string; objectives: Objective[]; requires: (data: GameData) => string[] }` (`requires` devuelve datos faltantes); `createEngine(defs: MissionDef[], data: GameData): { available: MissionDef[]; omitted: { id: string; reason: string }[]; start(id: string): void; report(event: GameEvent): void; state(): MissionState }`; `useMissionStore` guarda progreso en `localStorage` dentro de try/catch (si falla, memoria).

- [x] **Step 1: Tests** `una misión con requires no vacío queda en omitted y no en available`, `report(reach) avanza al siguiente objetivo`, `fallar o salir no pena: restart devuelve estado inicial`, `completar la misión marca completada sin texto 'aprobado'`, `el store funciona si localStorage lanza`.
- [x] **Step 2: Correr; esperar FAIL.**
- [x] **Step 3: Implementar la máquina de estados pura; el store solo adapta.**
- [x] **Step 4: Correr tests; esperar PASS.**
- [x] **Step 5: Commit `feat: motor de misiones`.**

### Task 9: HUD, radar y panel de misión

**Files:**
- Create: `src/ui/radarProjection.ts`, `src/ui/Radar.tsx`, `src/ui/Hud.tsx`, `src/ui/MissionPanel.tsx`, `src/ui/Legend.tsx`
- Test: `tests/unit/radarProjection.test.ts`

**Interfaces:**
- Produces: `projectToRadar(world: Vec3, center: Vec3, yaw: number, rangeM: number, sizePx: number): { x: number; y: number; inside: boolean }`; `<Radar />` muestra jugador, sectores y objetivo de la misión activa, sin ninguna capa de zonas; `<Legend />` fija "referencia digital, no as-built / ilustrativo" y el rótulo del signo lateral sin verificar.

- [x] **Step 1: Tests** `projectToRadar centra al jugador en (size/2, size/2)`, `un punto fuera de rangeM tiene inside=false y queda en el borde`, `el yaw rota el radar`.
- [x] **Step 2: Correr; esperar FAIL.**
- [x] **Step 3: Implementar; HUD con lista de objetivos, sectores visitados y marcador 3D del objetivo en la escena.**
- [x] **Step 4: Correr tests; esperar PASS.**
- [x] **Step 5: Commit `feat: HUD y radar`.**

### Task 10: Las 8 misiones

**Files:**
- Create: `src/game/missions/defs/m1.ts` … `m8.ts`, `src/game/missions/defs/index.ts`
- Test: `tests/unit/missionDefs.test.ts`

**Interfaces:**
- Consumes: `MissionDef`, `getSectors`, `buildFicha`, datos de `vendor/visor/*.json`.
- Produces: `ALL_MISSIONS: MissionDef[]` en este orden: 1 Reconocimiento, 2 ¿Qué hace cada sector?, 3 Mapa de zonas, 4 Retención en altura, 5 ¿Secundaria requerida?, 6 Zona sin clasificar, 7 Orden del montaje, 8 Fuente en conflicto. Contenido exacto del spec.

- [x] **Step 1: Tests** `las 8 misiones tienen requires y devuelven [] con los datos vendorizados`, `m3 en boca de pozo expone A2=Medio y RCCO=Alto`, `m6 muestra 'No clasificada en layout A2' y nunca 'Baja'`, `m8 muestra las dos cifras de vientos (25 ± 3 m y 20 m) con el rótulo 'Fuente en conflicto'` (si la fuente no las trae, la misión se omite y el test lo afirma), `ningún texto de misión contiene aprobado|habilitado|certificado`.
- [x] **Step 2: Correr; esperar FAIL.**
- [x] **Step 3: Implementar cada misión leyendo solo datos vendorizados; textos de misión sin contenido técnico propio.**
- [x] **Step 4: Correr tests; esperar PASS.**
- [x] **Step 5: Commit `feat: 8 misiones de inducción`.**

### Task 11: Radio, voz y sonido

**Files:**
- Create: `scripts/gen-voice.mjs`, `src/audio/radio.ts`, `src/audio/sfx.ts`, `public/audio/voice/*.mp3` (generados), `.env.example`
- Test: `tests/unit/radio.test.ts`

**Interfaces:**
- Produces: `scripts/gen-voice.mjs` lee los textos de `briefing` y `ficha` y genera un mp3 por línea con ElevenLabs (voz en español elegida con `creative_list_voices`; la clave solo desde `.env`, nunca commiteada) y escribe `public/audio/voice/manifest.json` con hash del texto; `playLine(id: string): Promise<void>`; `lineIds(): string[]`; `sfx.engine(speed: number)` y `sfx.step()`.

- [x] **Step 1: Test** `todas las líneas de misión tienen un archivo en el manifest` y `cambiar un texto invalida su hash en el manifest`.
- [x] **Step 2: Correr; esperar FAIL.**
- [x] **Step 3: Implementar el script y el reproductor.** Cambio de enfoque (sin servicios de pago ni nube): voz local Windows SAPI (Microsoft Sabina Desktop, es-MX) + ffmpeg con filtro de radio, `npm run gen-voice`; los .mp3 NO se commitean (licencia de la voz del sistema pendiente de confirmar, ver `NOTICE.md`): se generan en `predev`/`prebuild`; el manifest (id, archivo, duración, texto, sha256) sí. Ambiente de viento y rig lejano generado con ffmpeg (`public/audio/ambient/rig-lejano.mp3`).
- [x] **Step 4: Correr tests; esperar PASS.**
- [x] **Step 5: Commit `feat: radio con voz y sonido`.**

### Task 12: Día/noche y rendimiento

**Files:**
- Create: `src/game/world/DayNight.tsx`
- Modify: `src/game/world/loadRig.tsx` (instancias y LOD para repetidos o lejanos)
- Test: `tests/e2e/perf.e2e.ts`

**Interfaces:**
- Produces: `<DayNight />` con un `directionalLight` (sombra 2048, frustum ±40 m, `PCFShadowMap`), cielo de gradiente por shader, `HemisphereLight`, material emissive de luces de noche; `useTimeOfDay(): { hour: number; setHour(h: number): void }`.

- [x] **Step 1: Test e2e** `en escritorio, draw calls < 250 y triángulos visibles < 1 M` (lee `renderer.info` vía hook de test) y `la hora 0 y la hora 12 producen intensidades de luz distintas`.
- [x] **Step 2: Correr; esperar FAIL.**
- [x] **Step 3: Implementar; sin SSAO ni bloom permanentes; luces de noche solo por emissive.**
- [x] **Step 4: Correr e2e; esperar PASS y registrar FPS medido en `docs/perf.md`.**
- [x] **Step 5: Commit `feat: ciclo día/noche y presupuesto de rendimiento`.**

### Task 13: Pruebas de contenido público y revisión final

**Files:**
- Create: `tests/ui-publico.test.ts`, `.github/workflows/ci.yml`
- Modify: `NOTICE.md`, `README.md`

**Interfaces:**
- Produces: test que recorre `src/` y `public/` y falla ante marca de empresa, códigos de documentos internos o las palabras prohibidas (`aprobado`, `habilitado`, `certificado`, `área segura`, `zona de exclusión`); CI con `npm run typecheck && npm test && npm run build`.

- [x] **Step 1: Test** `ningún archivo de src o public contiene las palabras prohibidas` (lista en el test) y `NOTICE.md menciona repo privado y signo lateral sin verificar`.
- [x] **Step 2: Correr; esperar FAIL si hay hallazgos.**
- [x] **Step 3: Corregir hallazgos; actualizar README con cómo correr, controles y licencias de assets.**
- [x] **Step 4: Correr toda la suite y `npm run build`; esperar PASS.**
- [x] **Step 5: Commit `chore: verificación de contenido y CI`.**

### Task 14 (opcional, se recorta primero): Intro y tráiler con Remotion

**Files:**
- Create: `video/` (proyecto Remotion), `public/video/intro.mp4`

**Interfaces:**
- Produces: `intro.mp4` (≤20 s) renderizado con capturas del juego; se reproduce al inicio con botón "Saltar".

- [ ] **Step 1: Test e2e** `la intro se puede saltar y el juego arranca`.
- [ ] **Step 2: Correr; esperar FAIL.**
- [ ] **Step 3: Crear la composición con las skills de Remotion y renderizar.**
- [ ] **Step 4: Correr; esperar PASS.**
- [ ] **Step 5: Commit `feat: intro en video`.**

---

## Orden y paralelismo

Orden real de ejecución: 1, 2, 3, 4, 5, 6, 7, 15, 8, 9, 10, 18, 19, 11, 12, 16, 17, 13, 20, (14 opcional). Plan original: 1 → 2 → {3, 5, 7} en paralelo → 4 (necesita 3) → 6 (3 y 4) → 8 (7) → 9 (5 y 8) → 10 → {11, 12} en paralelo → 13 → 14.
Cada rama paralela vive en su worktree y se integra con revisión fresca antes de la siguiente.

### Task 15: Personaje realista animado (agregada por pedido del dueño; se ejecuta después de la Task 7)

**Files:**
- Create: `public/models/character/worker.glb`, `src/game/player/CharacterModel.tsx`, `src/game/player/characterAnim.ts`
- Modify: `src/game/player/Player.tsx` (reemplaza la cápsula visible por el modelo; el collider cápsula no cambia), `NOTICE.md` (origen y licencia del modelo y de cada animación)
- Test: `tests/unit/characterAnim.test.ts`, `tests/e2e/character.e2e.ts`

**Interfaces:**
- Consumes: `usePlayerStore` (`position`, `yaw`, `mode`), velocidad del jugador a pie.
- Produces: `pickClip(speed: number, mode: 'foot'|'truck'): 'idle'|'walk'|'run'|'seated'` con umbrales entre `WALK_SPEED` (1.4) y `RUN_SPEED` (4.5); `<CharacterModel />` con `AnimationMixer`, crossfade entre clips (≈0.2 s) y orientación según `yaw`.

- [x] **Step 1: Test `pickClip`**: 0 → 'idle'; `WALK_SPEED` → 'walk'; `RUN_SPEED` → 'run'; modo 'truck' → 'seated' (o 'idle' si no hay clip sentado, documentado).
- [x] **Step 2: Correr; esperar FAIL.**
- [x] **Step 3: Conseguir el modelo.** Requisitos: humanoide con esqueleto (skinned), proporciones realistas (~1.75 m, pies en y=0), sin armas ni uniforme militar, preferible trabajador con casco y chaleco (EPP genérico, sin marca ni logos), ≤ 25 k triángulos, texturas en webp, comprimido con Meshopt o Draco, animaciones idle/walk/run (sentado opcional). Orden de intentos (el implementador decide y documenta por qué): (a) modelos de `three/examples/models/gltf` y glTF-Sample-Assets con licencia verificada y sin armas; (b) personaje CC0 realista (verificar licencia en la página de origen); (c) generar un trabajador con 3D AI Studio (plan gratis, Prism preview) y rigearlo/animarlo con Blender MCP. Mixamo y Ready Player Me no se usan (requieren login manual / servicio discontinuado). Registrar en `NOTICE.md` origen, autor, licencia y URL. Si ninguna opción cumple "realista", informar el límite en el reporte en vez de entregar una cápsula.
- [x] **Step 4: Integrar** `<CharacterModel />` en `Player.tsx` con `useGLTF` (decoders locales), crossfade por `pickClip`, oculto en modo 'truck' salvo que haya clip 'seated'.
- [x] **Step 5: E2E** `el personaje camina con clip 'walk' al mover y vuelve a 'idle' al soltar` (hook dev `window.__game.currentClip()`), `la altura del modelo está entre 1.6 y 1.9 m`, y que `npm test`, `npm run test:e2e`, `npm run build` siguen verdes.
- [x] **Step 6: Commit `feat: personaje realista animado`.**

### Task 16: Realismo visual (agregada por pedido del dueño: "lo más realista posible"; se ejecuta después de la Task 12)

**Files:**
- Create: `src/game/world/Environment.tsx` (cielo HDRI, niebla, exposición), `src/game/world/GroundMaterial.tsx` (suelo PBR), `src/game/vehicle/truckModel.glb` (camioneta realista, reemplaza la procedural si la licencia y el peso lo permiten), `src/game/world/Props.tsx` (conos, tambores, vallas, bidones; instanciados), `src/game/quality.ts` (calidad Alta/Media/Baja con degradación automática), `public/hdri/*`, `public/textures/*` (webp/ktx2 no; webp), `NOTICE.md`
- Modify: `src/game/world/DayNight.tsx` (integra el HDRI con la hora), `src/game/vehicle/Truck.tsx`, `src/app/App.tsx`
- Test: `tests/unit/quality.test.ts`, `tests/e2e/realism.e2e.ts`

**Interfaces:**
- Consumes: `useTimeOfDay` (Task 12), `RIG_PARTS`, `LOCACION_M`, `usePlayerStore`.
- Produces: `type Quality = 'high'|'medium'|'low'`; `pickQuality(avgFrameMs: number, current: Quality): Quality` (baja de nivel si el promedio supera 20 ms durante una ventana, sube solo con margen amplio y nunca oscila); `useQuality(): { quality: Quality; set(q: Quality): void }`; `<Environment />`, `<GroundMaterial />`, `<Props />`.

- [x] **Step 1: Test `pickQuality`**: estable por debajo de 14 ms; baja de nivel tras sostener >20 ms; no sube hasta 10 ms sostenidos; no oscila entre dos niveles con valores cerca del umbral.
- [x] **Step 2: Correr; esperar FAIL.**
- [x] **Step 3: Implementar** (todo con licencia verificada y anotada en `NOTICE.md`; ninguna textura/HDRI con marca ni logos): (a) cielo HDRI CC0 (Poly Haven o equivalente) con exposición y tone mapping (ACES o AgX) coherentes con la hora; (b) suelo PBR de tierra/grava (CC0: ambientCG, Poly Haven, 3DTexel) con normal/roughness, repetición sin patrón visible (mezcla o variación por ruido) — el suelo sigue siendo plano y sin caminos, porque no hay fuente de terreno; (c) niebla suave de distancia; (d) environment map para los metales de los GLB (solo tienen factores PBR), sin cambiar su geometría ni colores base; (e) camioneta realista CC0 o modelada en Blender (≤ 40 k triángulos, webp, meshopt); (f) props instanciados (conos, tambores, vallas) dispuestos solo en zonas libres, sin invenciones sobre distribución real del equipo y sin sugerir zonas de exclusión ni "áreas seguras"; (g) SSAO y bloom suaves solo en calidad Alta; (h) sombras de contacto bajo el personaje y la camioneta; (i) escenario modificado para mayor realismo dentro de la capa de adiciones (mismas reglas de rotulado que la Task 18): vallado perimetral visible, plataforma de locación con grava y marcas de uso, cartelería genérica sin marca, cercos y barandas, iluminación de torre con emissive de noche, y elementos de suelo (manchas, huellas, charcos) sin sugerir zonas de exclusión ni áreas seguras.
- [x] **Step 4: Correr tests; esperar PASS.**
- [x] **Step 5: E2E** en navegador real: el juego arranca en cada calidad, `draw calls < 250` y `triángulos < 1 M` en calidad Alta, la degradación automática baja de nivel con FPS simulados bajos, y `npm test`, `npm run test:e2e`, `npm run build` siguen verdes. Sin capturas como entregable (el dueño mira el juego en vivo).
- [x] **Step 6: Commit `feat: realismo visual (cielo, suelo PBR, props, camioneta, calidad adaptativa)`.**

### Task 17: Calidad de vida (agregada por pedido del dueño: "agrega lo que sirve siempre"; se ejecuta después de la Task 16 y antes de la 13)

Criterio de selección: solo funciones de juego de uso general que ya vimos en los juegos de referencia y que encajan con las reglas del proyecto (sin combate, armas, inventario ni violencia; sin inventar datos).

**Files:**
- Create: `src/game/settings/settings.ts` (ajustes persistidos), `src/ui/PauseMenu.tsx`, `src/ui/ControlsHelp.tsx`, `src/ui/LoadingScreen.tsx`, `src/ui/FullMap.tsx`, `src/game/input/gamepad.ts`, `tests/unit/settings.test.ts`, `tests/unit/gamepad.test.ts`, `tests/e2e/qol.e2e.ts`
- Modify: `src/game/player/Player.tsx` (salto, sensibilidad, invertir Y), `src/ui/Hud.tsx` (atajos), `src/app/App.tsx`

**Interfaces:**
- Produces: `type Settings = { mouseSensitivity: number; invertY: boolean; masterVolume: number; quality: 'auto'|'high'|'medium'|'low' }`; `DEFAULT_SETTINGS: Settings`; `loadSettings(): Settings` y `saveSettings(s: Settings): void` (localStorage en try/catch con memoria de respaldo; valores fuera de rango se acotan; JSON inválido devuelve los valores por defecto); `mapGamepad(pad: { axes: readonly number[]; buttons: readonly { pressed: boolean }[] }, deadzone?: number): { move: { x: number; z: number }; look: { x: number; y: number }; run: boolean; jump: boolean; interact: boolean }` pura y testeada.

- [x] **Step 1: Tests**: `loadSettings` con localStorage que lanza devuelve defaults; con JSON inválido devuelve defaults; acota `mouseSensitivity` y `masterVolume` a su rango; `mapGamepad` aplica zona muerta (0.15 por defecto), mapea stick izquierdo a `move`, derecho a `look`, gatillo/botón a `run`, `jump` e `interact`.
- [x] **Step 2: Correr; esperar FAIL.**
- [x] **Step 3: Implementar**: (a) menú de pausa con Esc (reanudar, ajustes, controles, salir de la misión), el juego queda en pausa de verdad (física y cronómetros), sin perder el pointer-lock de forma confusa; (b) ajustes: sensibilidad del mouse, invertir Y, volumen general, calidad (auto/alta/media/baja; se enlaza con la Task 16); (c) ayuda de controles (tecla H y desde el menú); (d) pantalla de carga con progreso real (carga de GLB) y texto "referencia digital, no as-built / ilustrativo"; (e) mapa completo con la tecla N (la M queda para misiones): sectores con nombre sanitizado y posición del jugador y la camioneta, sin zonas dibujadas ni distancias; (f) [el salto se movió a la Task 18]; (g) soporte de gamepad (Gamepad API) para mover, mirar, correr, saltar, interactuar y subir/bajar de la camioneta; (h) guardado automático ya existe para misiones: mostrar un aviso discreto "Progreso guardado" sin datos sensibles.
- [x] **Step 4: Correr tests; esperar PASS.**
- [x] **Step 5: E2E**: Esc pausa y reanuda (la posición del jugador no cambia durante la pausa); un ajuste de sensibilidad persiste tras recargar; H abre y cierra la ayuda; N abre el mapa completo sin etiquetas de zona ni distancias; [el e2e del salto está en la Task 18]; `npm test`, `npm run test:e2e`, `npm run build` verdes. Sin capturas.
- [x] **Step 6: Commit `feat: pausa, ajustes, ayuda, mapa completo, salto y gamepad`.**


### Task 18: Desplazamiento vertical e interacción: saltar, escaleras, subir a los equipos y operar válvulas (agregada por pedido del dueño; se ejecuta después de la Task 10 y antes de la 11)

Pedido del dueño: "el personaje debe tener la posibilidad de subir a los equipos, subir escaleras, saltar, operar válvulas cuando sea requerido dentro de las misiones".

Decisión del dueño posterior: se puede modificar el escenario para habilitar el recorrido, con el mayor realismo posible. Se hace SOLO en la capa de adiciones (`public/models/scenario/*.glb`, `src/game/world/scenario/`, inventario en `docs/scenario-additions.md`): nunca se editan los GLB copiados del visor (`assets.lock.json` sigue verificando su hash). Cada adición (escalera, escalera vertical, baranda, plataforma, volante de válvula, rampa) se modela con proporciones reales de una instalación de este tipo, anclada a medidas de los GLB cuando existen (por ejemplo, la altura de la plataforma que debe alcanzar) y rotulada "escenario ilustrativo añadido por el juego, no as-built"; las medidas estimadas se registran como tales en `docs/scenario-additions.md`. Se modelan con Blender MCP (o código) en low/mid poly con PBR, con colisión simplificada y presupuesto de triángulos propio (≤ 30 k en total).

Reglas que acotan esta tarea (spec): no inventar posiciones de equipo ni secuencias ni procedimientos; los valores documentados salen de los GLB (bounds medidos) o de datos fuente; la operación de válvulas es una interacción ilustrativa y de registro propio (no simula flujo ni presión, no evalúa al jugador, no es un procedimiento); una misión que pide operar una válvula solo existe si los datos fuente la respaldan, si no se omite con su motivo; sin daño por caída ni muerte (si cae fuera de lo caminable, se reubica); las animaciones nuevas se consiguen con licencia verificada (por ejemplo GameAsset.net, CC0) y se anotan en `NOTICE.md`.

**Files:**
- Create: `docs/traversal-inventory.md` (resultado del relevamiento, Step 0), `scripts/extract-traversal.mjs` (genera el JSON desde los GLB), `src/game/world/traversal.json` (generado, con sha256 del GLB de origen), `src/game/world/walkable.ts`, `src/game/player/climb.ts`, `src/game/player/jump.ts`, `src/game/world/interactables.ts`, `src/game/world/Valve.tsx`, `src/ui/InteractPrompt.tsx`, `tests/unit/climb.test.ts`, `tests/unit/interactables.test.ts`, `tests/e2e/traversal.e2e.ts`
- Modify: `src/game/world/colliders.ts` (superficies caminables simplificadas), `src/game/player/Player.tsx` (autostep, salto, modo escalera), `src/game/player/characterAnim.ts` (clips jump, climb, operate), `src/game/missions/types.ts` y `engine.ts` (objetivo `interact`), `src/game/missions/defs/*` (misión de válvula solo si hay fuente), `NOTICE.md`

**Interfaces:**
- Consumes: `RIG_PARTS`, `usePlayerStore`, `pickClip`, motor de misiones, `buildFicha`.
- Produces: `type Traversal = 'ground' | 'stairs' | 'ladder' | 'platform'`; `type LadderVolume = { id: string; partId: string; bottom: Vec3; top: Vec3; facing: number }` y `type Interactable = { id: string; kind: 'valve'; partId: string; position: Vec3; label: string; sourceId: string; state: 'open' | 'closed' }` (ambos extraídos de los GLB por `extract-traversal.mjs`, sin números inventados); `nearestInteractable(player: Vec3, list: readonly Interactable[], reach?: number): Interactable | null` (alcance de juego 1.5 m, no se muestra); `climbStep(progress: number, input: number, dt: number, length: number): number` (progreso 0..1 a lo largo de la escalera, velocidad de trepado de juego `CLIMB_SPEED`); `JUMP = { velocity: number; coyoteMs: number }` (valores de juego); objetivo nuevo `{ kind: 'interact'; targetId: string; desiredState?: 'open' | 'closed' }` en el motor (`desiredState` solo si la fuente lo documenta; si no, cualquier operación cuenta como registro propio).

- [x] **Step 0: Relevamiento (sin escribir lógica de juego).** Inspeccionar los 16 GLB `sk575_*` y sus `.meta.json`: ¿hay nodos reconocibles de escaleras, escalones, plataformas, barandas, escaleras verticales y válvulas o volantes (manifold, BOP, acumulador, bomba, piletas, planchada, piso, mástil)? Medir sus bounds y alturas reales. Escribir `docs/traversal-inventory.md` con: qué se puede subir, desde dónde y hasta qué altura (medidas), qué NO hay en la geometría (por ejemplo, el piso no tiene superficie caminable), y qué válvulas existen y si alguna fuente (`docs/references/well-control` del visor, DROPS) las documenta. Lo que falte en la geometría (por ejemplo accesos, escaleras, barandas, volantes) se resuelve con una adición en la capa de escenario, listada con su medida y su origen (medida del GLB o estimada) en `docs/scenario-additions.md`; lo que falte en la fuente documental (secuencias, procedimientos, distancias) no se inventa.
- [x] **Step 1: Tests unitarios**: `climbStep` avanza con input +1, retrocede con −1, se acota a [0,1] y no se mueve con input 0; `nearestInteractable` devuelve la válvula más cercana dentro del alcance, `null` fuera de alcance y no elige una válvula tapada por otra más lejana; `canStepUp(height: number, maxStep: number): boolean`; el objetivo `interact` del motor avanza al operar la válvula correcta, ignora otras, respeta `desiredState` cuando existe, y una misión de válvula sin fuente queda en `omitted`.
- [x] **Step 2: Correr; esperar FAIL.**
- [x] **Step 3: Implementar.** (a) salto con Espacio a pie (altura de juego; en la camioneta Espacio sigue siendo freno); (b) autostep de Rapier para escalones y rampas con pendiente máxima derivada de las medidas del Step 0; (c) superficies caminables de `planchada`, `piso` y escaleras o plataformas que el Step 0 confirme, con geometría de colisión simplificada generada offline (sin barandas ni detalle; se permite trimesh decimado solo para estas superficies, no para el resto del equipo); (d) modo escalera: al acercarse a un `LadderVolume` y presionar E o W, el jugador se engancha, trepa y se suelta arriba o abajo; (e) subir a los equipos por los accesos reales de los GLB y por las adiciones del escenario (escaleras, rampas, plataformas, barandas) modeladas con realismo, con colisión coherente con lo que se ve (nunca colliders invisibles); (f) válvula: al estar dentro del alcance aparece el aviso "E: operar" (sin distancias), el volante gira con animación visual y el estado alterna entre abierto y cerrado, con rótulo fijo "ilustrativo: no es un procedimiento"; (g) clips de animación nuevos (salto, trepar, operar) con licencia verificada; (h) sin daño por caída: si el jugador queda fuera de lo caminable o cae por debajo de `y < -5`, se reubica en el último punto firme.
- [x] **Step 4: Correr tests; esperar PASS.**
- [x] **Step 5: E2E en navegador real**: el salto sube y vuelve a `y = 0`; el jugador sube por la escalera o rampa que el Step 0 confirme hasta la altura medida y se queda de pie sobre la plataforma; sube y baja una escalera vertical si existe; opera una válvula con E (el estado cambia y el objetivo `interact` de una misión de prueba solo para DEV avanza); sin ninguna etiqueta de distancia; `window.__game` solo en DEV; `npm test`, `npm run test:e2e`, `npm run build` verdes. Sin capturas.
- [x] **Step 6: Commit `feat: salto, escaleras, subir a los equipos y operar válvulas`.**


### Task 19: Estabilización y arreglos de la auditoría (se ejecuta después de la Task 18B y antes de la 11)

Origen: auditoría ponytail del 2026-11-27 (14 hallazgos, ver el registro SDD). Arreglar sí o sí: (1) `canEnter` con altura y limpiar el estado de escalera al entrar a la camioneta; (2) limpiar `keys` en `blur` (Player y Truck); (3) e2e de misiones alineado con la regla de sectores por altura; (4) aviso "signo lateral (+Y = este) sin verificar" en `NOTICE.md`; (5) cambiar esperas fijas de 250 ms por esperas de estado en todos los e2e (missions, truck, otros); (6) sacar de `public/` los 16 `.meta.json` internos y los 4 GLB sin uso (mover a `vendor/visor/models/`, ajustar `check-assets` y `sync-assets`, quitar el campo `meta`) y verificar que `dist/` no los contiene; (8) declarar `@gltf-transform/core`, `@gltf-transform/extensions` y `meshoptimizer` en `devDependencies` y agregar el script npm `extract-traversal`. Además: README actualizado (cómo correr, controles), `.claude-flow/` y `.superpowers/` en `.gitignore`, y los menores diferidos de 18A (M1 cobertura perdida del mástil/pórticos/BOP/piletas, M4 altura del pie en escaleras, M7 prettier). Decisiones del dueño pendientes que no bloquean: dependencias `phaser` y `playcanvas` sin uso (se mantienen hasta que el dueño decida) y la misión 8 (se mantiene omitida por falta de dato). Verde obligatorio: `npm test`, `npm run test:e2e` (dos corridas seguidas), `npx tsc --noEmit`, `npm run build`, `npm run check-assets`.


### Task 20: QA de punta a punta y mejoras para dejarlo jugable, 100% operativo y compartible (agregada por pedido del dueño; se ejecuta al final, después de la Task 13)

Pedido del dueño: "lanza agentes que prueben de punta a punta el juego, propongan y hagan mejoras; tiene que quedar jugable, 100% operativo y viral".

Alcance: (a) agentes de prueba jugable independientes (Playwright headless + hooks DEV) que recorren el juego completo como un jugador nuevo: arranque, carga, controles, caminar, correr, saltar, escaleras, válvulas, camioneta, misiones 1 a 7 (y 8/9 si existen), pausa, ajustes, mapa, ficha, guardado y recarga, audio, día/noche, rendimiento (FPS, draw calls, triángulos, memoria en sesión larga de 20 minutos simulados), resolución 1280x720 y 1920x1080 y anchos angostos, teclado y gamepad; cada agente entrega una lista de defectos con pasos para reproducir y severidad; (b) un agente de producto/UX propone mejoras priorizadas con costo estimado (primeros 60 segundos, claridad de objetivos, feedback de acciones, onboarding, tutorial corto, accesibilidad); (c) agentes implementadores corrigen los defectos y aplican las mejoras de mayor valor y menor riesgo, cada una con tests; (d) compartible ("viral") dentro de las reglas del proyecto: modo foto con captura de pantalla y tarjeta de misión completada sin texto "aprobado", clip corto grabable (MediaRecorder) con marca de agua genérica "referencia digital, ilustrativo", enlace compartible a una misión concreta, pantalla de título atractiva con inicio en un clic, tiempo de carga corto y carga progresiva; (e) cierre: suite completa verde dos veces seguidas, build de producción verificado, auditoría final (ponytail-audit) sin hallazgos "Hay que arreglar", y un informe de estado con límites conocidos.

Restricción central: "viral" requiere publicar el juego, y hoy el repo es privado, el visor de origen es privado y sin licencia, y los GLB y datos son confidenciales. PUBLICAR NO ENTRA en esta tarea: se deja un build listo y un informe de qué habría que resolver antes (autorización escrita del dueño del visor, retirar datos internos y metadatos, revisión de licencias de cada asset en `NOTICE.md`). Publicar, hacer público el repo o desplegar en un hosting externo requiere la confirmación explícita del dueño en el momento.
