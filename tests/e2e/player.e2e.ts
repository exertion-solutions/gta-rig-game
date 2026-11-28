import { expect, test, type Page } from '@playwright/test'
import { WORLD_BOUNDS as W, terrainY } from '../../src/game/world/route'
import { PLAYER_RADIUS, RESPAWN } from '../../src/game/player/movement'
import { settle, waitFrames, waitSteps } from './wait'

type Box = { min: number[]; max: number[] }
type Pos = [number, number, number]
const TOL = 0.12 // holgura del controlador (offset 0.01) + redondeo de un paso
const YAW = { toMinusX: Math.PI / 2, toPlusX: -Math.PI / 2, toMinusZ: 0, toPlusZ: Math.PI }

const pos = (page: Page) => page.evaluate(() => (window as any).__game.getPosition() as Pos)
const rendered = (page: Page, id: string) => page.evaluate((i) => (window as any).__game.renderedBounds(i) as Box | null, id)

async function place(page: Page, p: Pos, yaw: number) {
  await page.evaluate(([q, y]) => {
    const g = (window as any).__game
    g.setInput(null)
    g.setYaw(y)
    g.teleport(q)
  }, [p, yaw] as const)
  await settle(page) // que caiga/asiente sobre el suelo
}

// Avanza (run) hasta que la posición deja de cambiar (o `until` se cumple) y devuelve la posición final.
async function walk(page: Page, until?: (p: Pos) => boolean) {
  await page.evaluate(() => (window as any).__game.setInput({ x: 0, z: 1, run: true }))
  let last = await pos(page)
  let still = 0
  // tope en tiempo de SIMULACIÓN (48 muestras x 0,25 s = 12 s), no de reloj: con la máquina lenta no corta antes
  for (let i = 0; still < 3 && i < 48; i++) {
    await waitSteps(page, 15) // muestra cada 0,25 s de simulación
    const p = await pos(page)
    still = Math.hypot(p[0] - last[0], p[2] - last[2]) < 0.005 ? still + 1 : 0
    last = p
    if (until?.(p)) break
  }
  await page.evaluate(() => (window as any).__game.setInput(null))
  return last
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => {
    const g = (window as any).__game
    return g?.getPosition && g.renderedBounds('sk575_mastil') && g.renderedBounds('sk575_piso')
  }, null, { timeout: 90_000 })
  await settle(page)
})

test('window.__game solo existe en dev (este test corre contra vite dev)', async ({ page }) => {
  expect(await page.evaluate(() => typeof (window as any).__game)).toBe('object')
})

// Task 18A: el mástil ya no es su bbox completo (tapaba el piso de trabajo); son cajas por banda de altura medidas del GLB.
// El freno contra el reticulado sobre el piso se prueba en traversal.e2e.ts.
test('el bbox completo del mástil ya no tapa el piso de trabajo: se puede estar de pie dentro de él', async ({ page }) => {
  const m = (await rendered(page, 'sk575_mastil'))!
  const pi = (await rendered(page, 'sk575_piso'))!
  const floorY = 3.606 // chapa del piso de trabajo (sk575_piso_acero), ver traversal.json
  const p: Pos = [1.0, floorY, 0.9]
  expect(p[0] < m.max[0] && p[2] < m.max[2] && p[2] > m.min[2]).toBe(true) // dentro del bbox viejo del mástil
  expect(p[0] < pi.max[0] && p[2] < pi.max[2]).toBe(true)
  await place(page, p, YAW.toMinusZ)
  await waitSteps(page, 48) // 0,8 s de simulación: sigue en el mismo lugar
  const q = await pos(page)
  expect(Math.hypot(q[0] - p[0], q[2] - p[2])).toBeLessThan(0.05)
  expect(Math.abs(q[1] - floorY)).toBeLessThan(0.06)
})

test('espacio libre junto al mástil y al piso no bloquea (0,3 m fuera de sus bbox en -Z; el lado +Z lo cierra el carrier)', async ({ page }) => {
  const m = (await rendered(page, 'sk575_mastil'))!
  const pi = (await rendered(page, 'sk575_piso'))! // el pórtico -Z de la subestructura ahora tiene colisión
  await place(page, [m.max[0] + 4, 0, Math.min(m.min[2], pi.min[2]) - PLAYER_RADIUS - 0.3], YAW.toMinusX)
  const end = await walk(page, (p) => p[0] < m.min[0] - 1)
  expect(end[0]).toBeLessThan(m.min[0] - 0.5) // cruzó todo el ancho X del mástil por el costado
})

// Cada pieza con colisión se frena en su cara renderizada (alineación collider <-> GLB) desde un lado libre.
// Oráculo: bbox de los vértices dibujados dentro del volumen que barre la cápsula (y 0..1,8, ±radio del eje de avance).
// Piletas y BOP (Task 18A): cajas medidas por tanque / por banda en vez del bbox de la pieza entera.
const slab = (axis: number, at: number): [number[], number[]] => {
  const lo = [-99, 0.05, -99]
  const hi = [99, 1.8, 99]
  lo[2 - axis] = at - PLAYER_RADIUS
  hi[2 - axis] = at + PLAYER_RADIUS
  return [lo, hi]
}
const boundsIn = (page: Page, id: string, [lo, hi]: [number[], number[]]) =>
  page.evaluate(([i, a, b]) => (window as any).__game.renderedBoundsIn(i, a, b) as Box | null, [id, lo, hi] as const)
const CASES = [
  { id: 'sk575_carrier', from: (b: Box): Pos => [b.min[0] - 6, 0, (b.min[2] + b.max[2]) / 2], yaw: YAW.toPlusX, stop: (b: Box) => b.min[0] - PLAYER_RADIUS, axis: 0 },
  // tanque de la pileta del extremo +X, por su eje z (cara +X del tanque)
  { id: 'sk575_piletas', from: (): Pos => [28, 0, -28.9], yaw: YAW.toMinusX, stop: (b: Box) => b.max[0] + PLAYER_RADIUS, axis: 0, region: slab(0, -28.9) },
  // BOP por el lado +X de la subestructura (abierto); el lado ±Z lo cierran los pórticos del piso
  { id: 'sk575_bop', from: (): Pos => [4.6, 0, 0], yaw: YAW.toMinusX, stop: (b: Box) => b.max[0] + PLAYER_RADIUS, axis: 0, region: slab(0, 0) },
  // QA D-07: se caminaban por dentro. Bomba por su cara +X; acumulador por la cara -Z (la de las válvulas);
  // manifold contra el volante M4 desde el norte (sus caños azules, bajos, no colisionan: docs/traversal-inventory.md).
  { id: 'sk575_bomba', from: (): Pos => [-9, 0, -14.75], yaw: YAW.toMinusX, stop: (b: Box) => b.max[0] + PLAYER_RADIUS, axis: 0, region: slab(0, -14.75) }, // z libre de la escalera de la pileta
  { id: 'sk575_acumulador', from: (): Pos => [-23, 0, -1], yaw: YAW.toPlusZ, stop: (b: Box) => b.min[2] - PLAYER_RADIUS, axis: 2, region: slab(2, -23) },
  { id: 'sk575_acumulador', from: (): Pos => [-21.5, 0, -1], yaw: YAW.toPlusZ, stop: (b: Box) => b.min[2] - PLAYER_RADIUS, axis: 2, region: slab(2, -21.5) }, // frente de las válvulas
  { id: 'sk575_manifold', from: (): Pos => [5.032, 0, -6], yaw: YAW.toMinusZ, stop: (b: Box) => b.max[2] + PLAYER_RADIUS, axis: 2, region: [[4.68, 1.1, -10.8], [5.38, 1.8, -9]] as [number[], number[]] },
]
for (const c of CASES) {
  test(`${c.id}: se frena en su cara renderizada (${c.from({ min: [0, 0, 0], max: [0, 0, 0] }).map((v) => v.toFixed(1))})`, async ({ page }) => {
    const b = (c.region ? await boundsIn(page, c.id, c.region) : await rendered(page, c.id))!
    await place(page, c.from(b), c.yaw)
    const end = await walk(page)
    expect(Math.abs(end[c.axis] - c.stop(b))).toBeLessThan(TOL)
  })
}

test('el cuadro (sobre el carrier) está dentro de la caja de colisión del carrier', async ({ page }) => {
  const c = (await boundsIn(page, 'sk575_cuadro', [[-20, 1.3, -5], [5, 3.0, 5]]))! // sin el cable que sube a la corona
  const k = (await rendered(page, 'sk575_carrier'))! // la caja del carrier = su bbox dibujado (buildColliders)
  for (const i of [0, 1, 2]) {
    expect(c.min[i]).toBeGreaterThan(k.min[i] - TOL)
    expect(c.max[i]).toBeLessThan(k.max[i] + TOL)
  }
})

test('planchada fuera de la pasarela: se cruza a nivel del suelo (y=0)', async ({ page }) => {
  const pl = (await rendered(page, 'sk575_planchada'))!
  const pi = (await rendered(page, 'sk575_piso'))!
  expect(pl.min[1]).toBeLessThan(0.05) // base de la planchada en y≈0 => se camina sobre el suelo liso
  expect(pi.min[1]).toBeLessThan(0.05)
  // cruza la huella de la planchada (x 1.4..17, z ±6.8) por una calle libre del mástil
  await place(page, [pl.min[0] - 2, 0, pl.max[2] - 1], YAW.toPlusX)
  const end = await walk(page, (p) => p[0] > pl.max[0] + 1)
  expect(end[0]).toBeGreaterThan(pl.max[0] + 0.5)
  expect(Math.abs(end[1])).toBeLessThan(0.1) // los caballetes no tienen colisión; la pasarela (z ±1) no está en este camino
})

// QA D-06: el frente +X del piso de enganche estaba abierto (caída de 17 m). La baranda añadida (A4) frena al jugador en
// su cara dibujada y se queda arriba.
test('piso de enganche: la baranda del frente +X frena en su cara dibujada y no se cae', async ({ page }) => {
  const PE = 20.651
  const r = (await boundsIn(page, 'escenario_adiciones', [[1.7, PE + 0.05, -0.9], [2.1, PE + 1.3, 0.9]]))!
  await place(page, [1.0, PE, 0.3], YAW.toPlusX)
  const end = await walk(page)
  expect(Math.abs(end[0] - (r.min[0] - PLAYER_RADIUS))).toBeLessThan(TOL)
  expect(Math.abs(end[1] - PE)).toBeLessThan(0.06)
})

// QA D-11: el borde del mapa (la caja que contiene la ruta y la locación) es invisible; empujar contra él muestra
// "Límite del mapa" (sin distancias). La locación ya no tiene alambrado: se sale caminando.
const EDGE: Pos = [W.maxX - 3, terrainY(W.maxX - 3, 10), 10]
test('contra el borde del mapa aparece el aviso y se va al alejarse', async ({ page }) => {
  await place(page, EDGE, YAW.toPlusX)
  await expect(page.getByTestId('hud-limit')).toHaveCount(0)
  await page.evaluate(() => (window as any).__game.setInput({ x: 0, z: 1, run: true }))
  await expect(page.getByTestId('hud-limit')).toHaveText('Límite del mapa')
  expect(await page.getByTestId('hud-limit').innerText()).not.toMatch(/\d/)
  await page.evaluate(() => (window as any).__game.setYaw(Math.PI / 2)) // da media vuelta
  await expect(page.getByTestId('hud-limit')).toHaveCount(0)
  await page.evaluate(() => (window as any).__game.setInput(null))
})

test('si sale del mapa reaparece en el último punto firme (el Acceso, RESPAWN)', async ({ page }) => {
  await page.evaluate((x) => (window as any).__game.teleport([x, 0, 0]), W.maxX + 50)
  await waitSteps(page, 30) // medio segundo de simulación
  const p = await pos(page)
  expect(Math.hypot(p[0] - RESPAWN[0], p[2] - RESPAWN[2])).toBeLessThan(0.5)
})

test('cámara de seguimiento: detrás del jugador y no dentro del BOP con el jugador pegado a él', async ({ page }) => {
  test.slow() // camina hasta el BOP y espera a la cámara: con render por software va al límite de los 120 s
  const m = (await boundsIn(page, 'sk575_bop', [[-3, -1, -3], [3, 3.6, 3]]))! // BOP debajo del piso (una caja de colisión)
  // pegado a la cara +X del BOP, mirando hacia +X: "detrás" del jugador queda justo contra/dentro del BOP
  await place(page, [m.max[0] + PLAYER_RADIUS + 0.05, 0, 0], YAW.toPlusX)
  await waitFrames(page, 60) // la cámara se suaviza por cuadro (useFrame), no por paso de física
  const p = await pos(page)
  const c = await page.evaluate(() => (window as any).__game.getCamera() as Pos)
  const inside = c.every((v, i) => v > m.min[i] && v < m.max[i])
  expect(inside).toBe(false)
  expect(c[0]).toBeGreaterThan(m.max[0]) // del lado del jugador, no atravesó la pared
  const facing = [-Math.sin(YAW.toPlusX), -Math.cos(YAW.toPlusX)] // (1, ~0)
  expect((c[0] - p[0]) * facing[0] + (c[2] - p[2]) * facing[1]).toBeLessThan(0) // detrás del jugador
})
