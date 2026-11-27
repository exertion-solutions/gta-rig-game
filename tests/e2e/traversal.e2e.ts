import { expect, test, type Page } from '@playwright/test'
import { PLAYER_RADIUS } from '../../src/game/player/movement'
import { readFileSync } from 'node:fs'
import type { TraversalData } from '../../src/game/world/walkable'

// Recorrido vertical (Task 18A): superficies caminables y barandas medidas de los GLB. Los oráculos miden lo que se
// dibuja (vértices y raycast sobre las mallas), no los colliders: si la colisión no coincide con lo visible, falla.
type Pos = [number, number, number]
const TRAVERSAL: TraversalData = JSON.parse(readFileSync('src/game/world/traversal.json', 'utf8'))
type Box = { min: number[]; max: number[] }
const TOL = 0.12
const YAW = { toMinusX: Math.PI / 2, toPlusX: -Math.PI / 2, toMinusZ: 0, toPlusZ: Math.PI }
const RIG = ['sk575_piso', 'sk575_planchada', 'sk575_piletas', 'escenario_adiciones']

const g = <T,>(page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(([f, a]) => (window as any).__game[f as string](...(a as unknown[])), [fn, args] as const) as Promise<T>
const pos = (page: Page) => g<Pos>(page, 'getPosition')
const surfaceY = (page: Page, x: number, z: number, ids = RIG, below = 60) => g<number | null>(page, 'surfaceY', x, z, ids, below)
const rayHit = (page: Page, o: number[], d: number[], ids: string[]) => g<number[] | null>(page, 'rayHit', o, d, ids)
const boundsIn = (page: Page, id: string, min: number[], max: number[]) => g<Box | null>(page, 'renderedBoundsIn', id, min, max)

async function place(page: Page, p: Pos, yaw: number) {
  await page.evaluate(([q, y]) => {
    const w = (window as any).__game
    w.setInput(null)
    w.setYaw(y)
    w.teleport(q)
  }, [p, yaw] as const)
  await page.waitForTimeout(500)
}

// Avanza hasta quedar quieto (o `until`); devuelve la traza de posiciones.
async function walk(page: Page, until?: (p: Pos) => boolean, run = true, maxMs = 20_000) {
  await page.evaluate((r) => (window as any).__game.setInput({ x: 0, z: 1, run: r }), run)
  const trace: Pos[] = [await pos(page)]
  let still = 0
  const t0 = Date.now()
  while (still < 4 && Date.now() - t0 < maxMs) {
    await page.waitForTimeout(150)
    const p = await pos(page)
    const q = trace[trace.length - 1]
    still = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 0.004 ? still + 1 : 0
    trace.push(p)
    if (until?.(p)) break
  }
  await page.evaluate(() => (window as any).__game.setInput(null))
  return trace
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => {
      const w = (window as any).__game
      return w?.getPosition && w.renderedBounds?.('sk575_piso') && w.renderedBounds('sk575_piletas') && w.renderedBounds('escenario_adiciones') && w.surfaceY
    },
    null,
    { timeout: 90_000 },
  )
  await page.waitForTimeout(800)
})

test('sube la escalera añadida a la pasarela, la rampa de la V y queda de pie en el piso de trabajo', async ({ page }) => {
  const floorY = (await surfaceY(page, 0.9, 1.9, ['sk575_piso']))!
  const deckY = (await surfaceY(page, 10, -0.5, ['sk575_planchada']))!
  expect(floorY).toBeGreaterThan(3.5) // medido del GLB que se dibuja (3,61 m)
  expect(deckY).toBeGreaterThan(0.9)
  // Pie de la escalera añadida (extremo +X de la pasarela), mirando hacia -X, a lo largo de z = 0.
  const st = TRAVERSAL.stairs.find((s) => s.id === 'planchada_escalera')!
  await place(page, [st.bottom[0] + 1.5, 0, 0], YAW.toMinusX)
  // Freno contra el cuello sobre el piso (lo que asoma del BOP): cara +X dibujada.
  const nipple = (await boundsIn(page, 'sk575_bop', [-1, floorY + 0.05, -0.6], [1.5, floorY + 0.8, 0.6]))!
  const trace = await walk(page)
  const end = trace[trace.length - 1]
  // en la pasarela quedó sobre la superficie dibujada (no se hundió ni flotó)
  const onDeck = trace.filter((p) => p[0] > 8 && p[0] < 15)
  expect(onDeck.length).toBeGreaterThan(0)
  for (const p of onDeck) expect(Math.abs(p[1] - deckY)).toBeLessThan(0.08)
  // en la rampa sigue la superficie dibujada de la rampa
  const onRamp = trace.filter((p) => p[0] > 2.5 && p[0] < 6)
  expect(onRamp.length).toBeGreaterThan(0)
  for (const p of onRamp) expect(Math.abs(p[1] - (await surfaceY(page, p[0], p[2], ['sk575_planchada'], p[1] + 0.5))!)).toBeLessThan(0.1)
  // terminó de pie en el piso de trabajo, frenado por lo que se ve
  expect(Math.abs(end[1] - floorY)).toBeLessThan(0.06)
  expect(Math.abs(end[0] - (nipple.max[0] + PLAYER_RADIUS))).toBeLessThan(TOL)
  await page.waitForTimeout(1500)
  const later = await pos(page)
  expect(Math.abs(later[1] - floorY)).toBeLessThan(0.06) // se queda
})

test('no atraviesa la baranda del piso de trabajo ni el reticulado del mástil', async ({ page }) => {
  const floorY = (await surfaceY(page, 0.9, 1.9, ['sk575_piso']))!
  // hacia -Z contra la baranda dibujada del lado -Z
  await place(page, [1.0, floorY, 0.9], YAW.toMinusZ)
  // pasamanos intermedio dibujado, a la altura del medio del cuerpo
  const rail = (await rayHit(page, [1.0, floorY + 0.57, 0.9], [0, 0, -1], ['sk575_piso']))!
  let end = (await walk(page, undefined, false)).pop()!
  expect(Math.abs(end[2] - (rail[2] + PLAYER_RADIUS))).toBeLessThan(TOL)
  expect(Math.abs(end[1] - floorY)).toBeLessThan(0.06)
  // hacia -X contra la cara del mástil (banda sobre el piso), por z = -1,2 (fuera del BOP)
  await place(page, [1.0, floorY, -1.2], YAW.toMinusX)
  const mast = (await boundsIn(page, 'sk575_mastil', [-3, floorY, -1.2 - PLAYER_RADIUS], [1, floorY + 1.8, -1.2 + PLAYER_RADIUS]))!
  end = (await walk(page, undefined, false)).pop()!
  expect(end[0]).toBeGreaterThan(mast.max[0]) // no lo atraviesa
  expect(Math.abs(end[0] - (mast.max[0] + PLAYER_RADIUS))).toBeLessThan(TOL) // frena en la cara dibujada, sin pared invisible
})

test('sube la escalera real de una pileta y camina su cubierta hasta el equipo de cubierta', async ({ page }) => {
  const st = TRAVERSAL.stairs.find((s) => s.id === 'pileta0_escalera')!
  const z = st.top[2]
  await place(page, [st.bottom[0] - 1.5, 0, z], YAW.toPlusX)
  const deckY = (await surfaceY(page, st.top[0] + 2, z, ['sk575_piletas'], 2.5))!
  expect(deckY).toBeGreaterThan(1.9)
  const equipo = (await rayHit(page, [st.top[0] + 0.5, deckY + 0.9, z], [1, 0, 0], ['sk575_piletas']))!
  const trace = await walk(page)
  const end = trace[trace.length - 1]
  expect(Math.abs(end[1] - deckY)).toBeLessThan(0.06) // de pie sobre la cubierta dibujada
  expect(Math.abs(end[0] - (equipo[0] - PLAYER_RADIUS))).toBeLessThan(TOL) // frenado por el equipo que se ve
  // subió por la escalera: pasó por alturas intermedias sobre la huella
  expect(trace.some((p) => p[1] > 0.6 && p[1] < 1.6)).toBe(true)
  await page.waitForTimeout(1500)
  expect(Math.abs((await pos(page))[1] - deckY)).toBeLessThan(0.06)
})

test('escalera vertical: anclaje frente a la cara del mástil y entre el piso de trabajo y el piso de enganche dibujados', async ({ page }) => {
  const l = TRAVERSAL.ladders[0]
  const floorY = (await surfaceY(page, 0.9, 1.9, ['sk575_piso']))!
  const boardY = (await surfaceY(page, 1.2, 0, ['sk575_mastil'], 22))!
  expect(Math.abs(l.bottom[1] - floorY)).toBeLessThan(0.03)
  expect(Math.abs(l.top[1] - boardY)).toBeLessThan(0.05)
  const lad = (await boundsIn(page, 'escenario_adiciones', [-1, floorY, -1], [0.6, boardY, 0]))!
  expect(lad.min[1]).toBeLessThan(floorY + 0.1)
  expect(lad.max[1]).toBeGreaterThan(boardY - 0.1)
})

test('rendimiento con las adiciones: menos de 250 draw calls y 1 M triángulos', async ({ page }) => {
  await place(page, [8, 0, 8], YAW.toMinusX)
  await page.waitForTimeout(500)
  const info = await g<{ calls: number; triangles: number }>(page, 'renderInfo')
  expect(info.calls).toBeGreaterThan(0)
  expect(info.calls).toBeLessThan(250)
  expect(info.triangles).toBeLessThan(1_000_000)
})
