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

### Task 1: Scaffold y sync-assets

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.gitattributes`, `scripts/sync-assets.mjs`, `scripts/check-assets.mjs`, `src/app/main.tsx`, `src/app/App.tsx`
- Modify: `assets.lock.json` (agrega `vendor` con sha256 de cada archivo vendorizado)
- Test: `tests/unit/assets.test.ts`

**Interfaces:**
- Produces: `npm run dev|build|test|typecheck`; `checkAssets(lockPath: string, root: string): { ok: boolean; missing: string[]; mismatched: string[] }` exportada desde `scripts/check-assets.mjs`; `npm run sync-assets` baja `public/models/rig10/*` y `vendor/visor/*` del visor al commit de `assets.lock.json`, y `.gitattributes` fija `*.json text eol=lf` y `*.glb binary`.

- [ ] **Step 1: Test `checkAssets reporta ok con los 36 archivos de rig10`** y `checkAssets reporta mismatched si se altera un byte` y `checkAssets reporta missing si falta un archivo` (usa copia temporal del directorio).
- [ ] **Step 2: Correr `npx vitest run tests/unit/assets.test.ts`; esperar FAIL (módulo inexistente).**
- [ ] **Step 3: Implementar `checkAssets` con sha256 de Node; scaffold Vite+React+TS+Tailwind+Vitest; `App.tsx` renderiza "GTA RIG GAME"; si `checkAssets` falla en `predev`/`prebuild`, el script sale con código 1 y lista los archivos.**
- [ ] **Step 4: Correr tests y `npm run build`; esperar PASS.**
- [ ] **Step 5: Commit `feat: scaffold, sync-assets y verificación de hashes`.**

### Task 2: Marco del mundo y carga de GLB

**Files:**
- Create: `src/game/world/frame.ts`, `src/game/world/stripLines.ts`, `src/game/world/loadRig.tsx`
- Test: `tests/unit/world.test.ts`

**Interfaces:**
- Consumes: archivos de `public/models/rig10/` (Task 1).
- Produces: `LOCACION_M = { x: number; z: number }` (78.5 y 61; el implementador confirma ejes contra `locacion` en `vendor/visor/viewpoints.json`); `stripLines(root: THREE.Object3D): number` (quita `LineSegments`/`Line`, devuelve cuántos); `RIG_PARTS: readonly { id: string; glb: string; meta: string; role: 'collide'|'scenery'|'walkable' }[]` con los 16 `sk575_*` según el inventario del spec (mástil, piletas, planchada, piso = colisión/caminable; resto escenografía; vientos y tiros sin colisión); `<RigScene />` carga con Meshopt y Draco locales.

- [ ] **Step 1: Tests** `stripLines elimina todos los Line y deja los Mesh` (escena sintética), `RIG_PARTS tiene 16 entradas con glb y meta existentes en disco`, y `bounding box de sk575_mastil está dentro de LOCACION_M` (carga GLB con GLTFLoader en Node, tolerancia documentada en el test).
- [ ] **Step 2: Correr; esperar FAIL.**
- [ ] **Step 3: Implementar los tres módulos; `<RigScene />` muestra todo con luz hemisférica y OrbitControls provisional en `App.tsx`.**
- [ ] **Step 4: Correr tests; verificar a ojo con `npm run dev` y captura (Playwright) que el equipo se ve completo.**
- [ ] **Step 5: Commit `feat: marco del visor y carga de GLB sin aristas`.**

### Task 3: Colisiones y suelo — **Codex**

**Files:**
- Create: `src/game/world/colliders.ts`, `src/game/world/Ground.tsx`
- Test: `tests/unit/colliders.test.ts`

**Interfaces:**
- Consumes: `RIG_PARTS`, `LOCACION_M` (Task 2).
- Produces: `boxFromBounds(b: THREE.Box3, margin?: number): { center: [number, number, number]; half: [number, number, number] }`; `buildColliders(parts: LoadedPart[]): ColliderDesc[]` (cajas por componente `collide`; 1 convex hull permitido para mástil, BOP y carrier); `<Ground />` plano liso de `LOCACION_M` con collider y vallado invisible en el borde; `<PhysicsWorld>` envuelve la escena con `@react-three/rapier`.

- [ ] **Step 1: Tests** `boxFromBounds devuelve centro y semi-ejes correctos para un Box3 conocido`, `buildColliders no genera trimesh` (assert tipos), `buildColliders omite vientos y tiros`.
- [ ] **Step 2: Correr; esperar FAIL.**
- [ ] **Step 3: Implementar; instalar `@react-three/rapier` con la versión compatible con fiber 9 (`npm view`).**
- [ ] **Step 4: Correr tests y medir carga: el bundle crece menos de ~1,2 MB por el WASM.**
- [ ] **Step 5: Commit `feat: colisiones por cajas y suelo`.**

### Task 4: Jugador a pie — **Codex**

**Files:**
- Create: `src/game/player/movement.ts`, `src/game/player/Player.tsx`
- Test: `tests/unit/movement.test.ts`, `tests/e2e/player.e2e.ts`

**Interfaces:**
- Consumes: `PhysicsWorld`, `LOCACION_M` (Task 3).
- Produces: `WALK_SPEED = 1.4`, `RUN_SPEED = 4.5`, `PLAYER_RADIUS = 0.35`, `EYE_HEIGHT = 1.7`; `stepMovement(input: { x: number; z: number; run: boolean }, yaw: number, dt: number): { vx: number; vz: number }`; `clampToBounds(p: Vec3, bounds: { x: number; z: number }): Vec3`; `<Player />` con `KinematicCharacterController` y cápsula, teclado WASD + mouse; `usePlayerStore` con `{ position, yaw, mode: 'foot' | 'truck' }`.

- [ ] **Step 1: Tests** `stepMovement diagonal no supera RUN_SPEED`, `stepMovement sin input devuelve 0`, `clampToBounds reubica un punto fuera del vallado al borde`, y e2e `el jugador no atraviesa la caja del mástil` (3 s de avance contra el mástil; posición final fuera del bounding box).
- [ ] **Step 2: Correr; esperar FAIL.**
- [ ] **Step 3: Implementar; si `|y| > 5` o fuera del vallado, reubicar en el Acceso (`sectors` de Task 7; hasta entonces `[−35, 0, 0]` provisional documentado en el código).**
- [ ] **Step 4: Correr unit y e2e; esperar PASS.**
- [ ] **Step 5: Commit `feat: jugador a pie con colisiones`.**

### Task 5: Cámara de seguimiento

**Files:**
- Create: `src/game/camera/followCamera.ts`, `src/game/camera/FollowCamera.tsx`
- Test: `tests/unit/followCamera.test.ts`

**Interfaces:**
- Consumes: `usePlayerStore` (Task 4).
- Produces: `computeCameraTarget(target: Vec3, yaw: number, pitch: number, distance: number): Vec3`; `resolveCameraCollision(origin: Vec3, desired: Vec3, hit: (o: Vec3, d: Vec3) => number | null, margin: number): Vec3` (acerca la cámara si el rayo choca); `<FollowCamera />` con lerp y control de mouse.

- [ ] **Step 1: Tests** `computeCameraTarget con yaw 0 queda detrás del objetivo a distance`, `resolveCameraCollision acerca la cámara al punto de choque menos margin`, `resolveCameraCollision sin choque devuelve desired`.
- [ ] **Step 2: Correr; esperar FAIL.**
- [ ] **Step 3: Implementar funciones puras; el componente usa `useFrame` y el raycast de Rapier.**
- [ ] **Step 4: Correr tests; esperar PASS.**
- [ ] **Step 5: Commit `feat: cámara de seguimiento con colisión`.**

### Task 6: Camioneta y subir/bajar — **Codex**

**Files:**
- Create: `src/game/vehicle/truckModel.ts`, `src/game/vehicle/Truck.tsx`, `src/game/vehicle/enterExit.ts`, `public/models/vehicle/truck.glb` (modelada con Blender MCP o CC0 con licencia anotada en `NOTICE.md`)
- Test: `tests/unit/enterExit.test.ts`, `tests/e2e/truck.e2e.ts`

**Interfaces:**
- Consumes: `usePlayerStore`, `PhysicsWorld`.
- Produces: `TRUCK = { maxSpeed: 12, wheelBase: number, ... }` (valores arcade, sin pretensión realista); `canEnter(player: Vec3, truck: Vec3, radius?: number): boolean` (radio por defecto 2.5 m, solo interacción de juego, no se muestra); `<Truck />` con `DynamicRayCastVehicleController`; tecla `E` alterna `mode`; `respawnTruck()` en el Acceso si volcó (>60° de inclinación 3 s) o salió del vallado.

- [ ] **Step 1: Tests** `canEnter es true dentro del radio y false fuera`, `E alterna foot→truck→foot` (store), e2e `la camioneta acelera y se detiene sin atravesar el mástil`.
- [ ] **Step 2: Correr; esperar FAIL.**
- [ ] **Step 3: Implementar; modelar camioneta low-poly (<8 k triángulos) y registrar origen y licencia.**
- [ ] **Step 4: Correr unit y e2e; esperar PASS.**
- [ ] **Step 5: Commit `feat: camioneta conducible y entrar/salir`.**

### Task 7: Capa de datos y reglas de evidencia

**Files:**
- Create: `src/game/data/evidence.ts`, `src/game/data/sectors.ts`, `src/game/data/ficha.ts`, `src/ui/EvidenceBadge.tsx`, `src/ui/Ficha.tsx`
- Modify: `scripts/sync-assets.mjs` (suma `vendor/visor/{viewpoints,drops,secuencia}.json`; `secuencia.md` del visor se convierte a JSON con los 8 pasos y estatus `pendingValidation`)
- Test: `tests/unit/evidence.test.ts`, `tests/unit/sectors.test.ts`

**Interfaces:**
- Produces: `type Evidence = 'confirmed'|'procedure'|'goodPractice'|'pendingValidation'`; `canBePresentedAsRequirement(e: Evidence): boolean` (true solo para `confirmed` y `procedure`); `getSectors(): Sector[]` con `{ id: string; name: string; position: Vec3 | null; ... }` desde `viewpoints.json` y `layout_locacion.json` (`position: null` si no hay posición documentada); `buildFicha(sectorId: string): Ficha` con puntos DROPS, `sourceId`, evidencia y leyenda "referencia digital, no as-built / ilustrativo".

- [ ] **Step 1: Tests** `canBePresentedAsRequirement` para los 4 valores; `getSectors devuelve 14 sectores`; `un sector sin posición documentada tiene position null`; `buildFicha incluye sourceId en cada dato numérico`; `buildFicha nunca incluye radios ni distancias de zona`.
- [ ] **Step 2: Correr; esperar FAIL.**
- [ ] **Step 3: Implementar; la ficha muestra la zona A2 solo como texto, con el conflicto A2/RCCO en boca de pozo cuando existe.**
- [ ] **Step 4: Correr tests; esperar PASS.**
- [ ] **Step 5: Commit `feat: datos del visor, evidencia y fichas`.**

### Task 8: Motor de misiones

**Files:**
- Create: `src/game/missions/types.ts`, `src/game/missions/engine.ts`, `src/game/missions/store.ts`
- Test: `tests/unit/missions.test.ts`

**Interfaces:**
- Consumes: `Sector`, `Ficha` (Task 7).
- Produces: `type Objective = { id: string; kind: 'reach'|'visitAll'|'choose'|'order'|'mark'; ... }`; `type MissionDef = { id: string; title: string; briefing: string; objectives: Objective[]; requires: (data: GameData) => string[] }` (`requires` devuelve datos faltantes); `createEngine(defs: MissionDef[], data: GameData): { available: MissionDef[]; omitted: { id: string; reason: string }[]; start(id: string): void; report(event: GameEvent): void; state(): MissionState }`; `useMissionStore` guarda progreso en `localStorage` dentro de try/catch (si falla, memoria).

- [ ] **Step 1: Tests** `una misión con requires no vacío queda en omitted y no en available`, `report(reach) avanza al siguiente objetivo`, `fallar o salir no pena: restart devuelve estado inicial`, `completar la misión marca completada sin texto 'aprobado'`, `el store funciona si localStorage lanza`.
- [ ] **Step 2: Correr; esperar FAIL.**
- [ ] **Step 3: Implementar la máquina de estados pura; el store solo adapta.**
- [ ] **Step 4: Correr tests; esperar PASS.**
- [ ] **Step 5: Commit `feat: motor de misiones`.**

### Task 9: HUD, radar y panel de misión

**Files:**
- Create: `src/ui/radarProjection.ts`, `src/ui/Radar.tsx`, `src/ui/Hud.tsx`, `src/ui/MissionPanel.tsx`, `src/ui/Legend.tsx`
- Test: `tests/unit/radarProjection.test.ts`

**Interfaces:**
- Produces: `projectToRadar(world: Vec3, center: Vec3, yaw: number, rangeM: number, sizePx: number): { x: number; y: number; inside: boolean }`; `<Radar />` muestra jugador, sectores y objetivo de la misión activa, sin ninguna capa de zonas; `<Legend />` fija "referencia digital, no as-built / ilustrativo" y el rótulo del signo lateral sin verificar.

- [ ] **Step 1: Tests** `projectToRadar centra al jugador en (size/2, size/2)`, `un punto fuera de rangeM tiene inside=false y queda en el borde`, `el yaw rota el radar`.
- [ ] **Step 2: Correr; esperar FAIL.**
- [ ] **Step 3: Implementar; HUD con lista de objetivos, sectores visitados y marcador 3D del objetivo en la escena.**
- [ ] **Step 4: Correr tests; esperar PASS.**
- [ ] **Step 5: Commit `feat: HUD y radar`.**

### Task 10: Las 8 misiones

**Files:**
- Create: `src/game/missions/defs/m1.ts` … `m8.ts`, `src/game/missions/defs/index.ts`
- Test: `tests/unit/missionDefs.test.ts`

**Interfaces:**
- Consumes: `MissionDef`, `getSectors`, `buildFicha`, datos de `vendor/visor/*.json`.
- Produces: `ALL_MISSIONS: MissionDef[]` en este orden: 1 Reconocimiento, 2 ¿Qué hace cada sector?, 3 Mapa de zonas, 4 Retención en altura, 5 ¿Secundaria requerida?, 6 Zona sin clasificar, 7 Orden del montaje, 8 Fuente en conflicto. Contenido exacto del spec.

- [ ] **Step 1: Tests** `las 8 misiones tienen requires y devuelven [] con los datos vendorizados`, `m3 en boca de pozo expone A2=Medio y RCCO=Alto`, `m6 muestra 'No clasificada en layout A2' y nunca 'Baja'`, `m8 muestra las dos cifras de vientos (25 ± 3 m y 20 m) con el rótulo 'Fuente en conflicto'` (si la fuente no las trae, la misión se omite y el test lo afirma), `ningún texto de misión contiene aprobado|habilitado|certificado`.
- [ ] **Step 2: Correr; esperar FAIL.**
- [ ] **Step 3: Implementar cada misión leyendo solo datos vendorizados; textos de misión sin contenido técnico propio.**
- [ ] **Step 4: Correr tests; esperar PASS.**
- [ ] **Step 5: Commit `feat: 8 misiones de inducción`.**

### Task 11: Radio, voz y sonido

**Files:**
- Create: `scripts/gen-voice.mjs`, `src/audio/radio.ts`, `src/audio/sfx.ts`, `public/audio/voice/*.mp3` (generados), `.env.example`
- Test: `tests/unit/radio.test.ts`

**Interfaces:**
- Produces: `scripts/gen-voice.mjs` lee los textos de `briefing` y `ficha` y genera un mp3 por línea con ElevenLabs (voz en español elegida con `creative_list_voices`; la clave solo desde `.env`, nunca commiteada) y escribe `public/audio/voice/manifest.json` con hash del texto; `playLine(id: string): Promise<void>`; `lineIds(): string[]`; `sfx.engine(speed: number)` y `sfx.step()`.

- [ ] **Step 1: Test** `todas las líneas de misión tienen un archivo en el manifest` y `cambiar un texto invalida su hash en el manifest`.
- [ ] **Step 2: Correr; esperar FAIL.**
- [ ] **Step 3: Implementar el script y el reproductor; generar las voces una vez y commitear los mp3 sin la clave.**
- [ ] **Step 4: Correr tests; esperar PASS.**
- [ ] **Step 5: Commit `feat: radio con voz y sonido`.**

### Task 12: Día/noche y rendimiento

**Files:**
- Create: `src/game/world/DayNight.tsx`
- Modify: `src/game/world/loadRig.tsx` (instancias y LOD para repetidos o lejanos)
- Test: `tests/e2e/perf.e2e.ts`

**Interfaces:**
- Produces: `<DayNight />` con un `directionalLight` (sombra 2048, frustum ±40 m, `PCFShadowMap`), cielo de gradiente por shader, `HemisphereLight`, material emissive de luces de noche; `useTimeOfDay(): { hour: number; setHour(h: number): void }`.

- [ ] **Step 1: Test e2e** `en escritorio, draw calls < 250 y triángulos visibles < 1 M` (lee `renderer.info` vía hook de test) y `la hora 0 y la hora 12 producen intensidades de luz distintas`.
- [ ] **Step 2: Correr; esperar FAIL.**
- [ ] **Step 3: Implementar; sin SSAO ni bloom permanentes; luces de noche solo por emissive.**
- [ ] **Step 4: Correr e2e; esperar PASS y registrar FPS medido en `docs/perf.md`.**
- [ ] **Step 5: Commit `feat: ciclo día/noche y presupuesto de rendimiento`.**

### Task 13: Pruebas de contenido público y revisión final

**Files:**
- Create: `tests/ui-publico.test.ts`, `.github/workflows/ci.yml`
- Modify: `NOTICE.md`, `README.md`

**Interfaces:**
- Produces: test que recorre `src/` y `public/` y falla ante marca de empresa, códigos de documentos internos o las palabras prohibidas (`aprobado`, `habilitado`, `certificado`, `área segura`, `zona de exclusión`); CI con `npm run typecheck && npm test && npm run build`.

- [ ] **Step 1: Test** `ningún archivo de src o public contiene las palabras prohibidas` (lista en el test) y `NOTICE.md menciona repo privado y signo lateral sin verificar`.
- [ ] **Step 2: Correr; esperar FAIL si hay hallazgos.**
- [ ] **Step 3: Corregir hallazgos; actualizar README con cómo correr, controles y licencias de assets.**
- [ ] **Step 4: Correr toda la suite y `npm run build`; esperar PASS.**
- [ ] **Step 5: Commit `chore: verificación de contenido y CI`.**

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

1 → 2 → {3, 5, 7} en paralelo → 4 (necesita 3) → 6 (3 y 4) → 8 (7) → 9 (5 y 8) → 10 → {11, 12} en paralelo → 13 → 14.
Cada rama paralela vive en su worktree y se integra con revisión fresca antes de la siguiente.
