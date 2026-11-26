import { expect, test, type Page } from '@playwright/test'
import { PLAYER_RADIUS } from '../../src/game/player/movement'

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
  await page.waitForTimeout(400) // que caiga/asiente sobre el suelo
}

// Avanza (run) hasta que la posición deja de cambiar (o `until` se cumple) y devuelve la posición final.
async function walk(page: Page, until?: (p: Pos) => boolean) {
  await page.evaluate(() => (window as any).__game.setInput({ x: 0, z: 1, run: true }))
  let last = await pos(page)
  let still = 0
  const t0 = Date.now()
  while (still < 3 && Date.now() - t0 < 12_000) {
    await page.waitForTimeout(250)
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
  await page.waitForTimeout(500)
})

test('window.__game solo existe en dev (este test corre contra vite dev)', async ({ page }) => {
  expect(await page.evaluate(() => typeof (window as any).__game)).toBe('object')
})

test('el jugador no atraviesa la caja del mástil', async ({ page }) => {
  const m = (await rendered(page, 'sk575_mastil'))!
  const zMid = (m.min[2] + m.max[2]) / 2
  await place(page, [m.max[0] + 6, 0, zMid], YAW.toMinusX)
  const end = await walk(page)
  // no atraviesa: queda fuera del bounding box del mástil renderizado...
  expect(end[0]).toBeGreaterThan(m.max[0])
  // ...y no lo frenó espacio vacío: se detiene pegado a la cara (±TOL), no antes.
  expect(Math.abs(end[0] - (m.max[0] + PLAYER_RADIUS))).toBeLessThan(TOL)
})

test('espacio libre junto al mástil no bloquea (0,3 m fuera del bbox en -Z; el lado +Z lo cierra el carrier)', async ({ page }) => {
  const m = (await rendered(page, 'sk575_mastil'))!
  await place(page, [m.max[0] + 4, 0, m.min[2] - PLAYER_RADIUS - 0.3], YAW.toMinusX)
  const end = await walk(page, (p) => p[0] < m.min[0] - 1)
  expect(end[0]).toBeLessThan(m.min[0] - 0.5) // cruzó todo el ancho X del mástil por el costado
})

// Cada pieza 'collide' se frena a su cara renderizada (alineación collider <-> GLB) desde un lado libre.
const CASES = [
  { id: 'sk575_carrier', from: (b: Box): Pos => [b.min[0] - 6, 0, (b.min[2] + b.max[2]) / 2], yaw: YAW.toPlusX, stop: (b: Box) => b.min[0] - PLAYER_RADIUS, axis: 0 },
  { id: 'sk575_piletas', from: (b: Box): Pos => [b.min[0] - 6, 0, (b.min[2] + b.max[2]) / 2], yaw: YAW.toPlusX, stop: (b: Box) => b.min[0] - PLAYER_RADIUS, axis: 0 },
  { id: 'sk575_bop', from: (b: Box): Pos => [(b.min[0] + b.max[0]) / 2, 0, b.max[2] + 4], yaw: YAW.toMinusZ, stop: (b: Box) => b.max[2] + PLAYER_RADIUS, axis: 2 },
]
for (const c of CASES) {
  test(`${c.id}: se frena en su cara renderizada`, async ({ page }) => {
    const b = (await rendered(page, c.id))!
    await place(page, c.from(b), c.yaw)
    const end = await walk(page)
    expect(Math.abs(end[c.axis] - c.stop(b))).toBeLessThan(TOL)
  })
}

test('planchada y piso: sin colisión propia; la planchada está a nivel del suelo (y=0)', async ({ page }) => {
  const pl = (await rendered(page, 'sk575_planchada'))!
  const pi = (await rendered(page, 'sk575_piso'))!
  expect(pl.min[1]).toBeLessThan(0.05) // base de la planchada en y≈0 => se camina sobre el suelo liso
  expect(pi.min[1]).toBeLessThan(0.05)
  // cruza la huella de la planchada (x 1.4..17, z ±6.8) por una calle libre del mástil
  await place(page, [pl.min[0] - 2, 0, pl.max[2] - 1], YAW.toPlusX)
  const end = await walk(page, (p) => p[0] > pl.max[0] + 1)
  expect(end[0]).toBeGreaterThan(pl.max[0] + 0.5)
  expect(Math.abs(end[1])).toBeLessThan(0.1) // sin escalones ni rampas inventadas
})

test('si cae o sale del vallado reaparece en el acceso provisional [-35, 0, 0]', async ({ page }) => {
  await page.evaluate(() => (window as any).__game.teleport([200, 0, 0]))
  await page.waitForTimeout(500)
  const p = await pos(page)
  expect(Math.hypot(p[0] + 35, p[2])).toBeLessThan(0.5)
})

test('cámara de seguimiento: detrás del jugador y no dentro del mástil con el jugador pegado a él', async ({ page }) => {
  const m = (await rendered(page, 'sk575_mastil'))!
  const zMid = (m.min[2] + m.max[2]) / 2
  // pegado a la cara +X del mástil, mirando hacia +X: "detrás" del jugador queda justo contra/dentro del mástil
  await place(page, [m.max[0] + PLAYER_RADIUS + 0.05, 0, zMid], YAW.toPlusX)
  await page.waitForTimeout(1200)
  const p = await pos(page)
  const c = await page.evaluate(() => (window as any).__game.getCamera() as Pos)
  const inside = c.every((v, i) => v > m.min[i] && v < m.max[i])
  expect(inside).toBe(false)
  expect(c[0]).toBeGreaterThan(m.max[0]) // del lado del jugador, no atravesó la pared
  const facing = [-Math.sin(YAW.toPlusX), -Math.cos(YAW.toPlusX)] // (1, ~0)
  expect((c[0] - p[0]) * facing[0] + (c[2] - p[2]) * facing[1]).toBeLessThan(0) // detrás del jugador
})
