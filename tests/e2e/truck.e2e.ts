import { expect, test, type Page } from '@playwright/test'
import { TRUCK_SPAWN } from '../../src/game/player/store'
import { settle, truckParked, waitFrames, waitSteps } from './wait'

type Box = { min: number[]; max: number[] }
type Pos = [number, number, number]
type TruckState = { position: Pos; bodyY: number; heading: number; speed: number; inclination: number }
const HEADING = { toMinusX: Math.PI / 2, toPlusX: -Math.PI / 2 }

const truck = (page: Page) => page.evaluate(() => (window as any).__game.getTruck() as TruckState)
const mode = (page: Page) => page.evaluate(() => (window as any).__game.getMode() as string)
const player = (page: Page) => page.evaluate(() => (window as any).__game.getPosition() as Pos)
const rendered = (page: Page, id: string) => page.evaluate((i) => (window as any).__game.renderedBounds(i) as Box | null, id)
const drive = (page: Page, i: { throttle: number; steer: number; brake: boolean } | null) => page.evaluate((v) => (window as any).__game.setTruckInput(v), i)

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => {
    const g = (window as any).__game
    return g?.getTruck && g.getPosition && g.renderedBounds('sk575_mastil')
  }, null, { timeout: 90_000 })
  await settle(page)
})

test('E alterna a la camioneta cuando está cerca y no hace nada si está lejos', async ({ page }) => {
  await page.evaluate(() => {
    const g = (window as any).__game
    g.teleportTruck([0, 0, 20], 0)
    g.teleport([0, 0, 21.5])
  })
  await truckParked(page, 0, 20)
  await settle(page)
  await expect(page.getByTestId('interact-prompt')).toHaveText('E subir a la camioneta') // sin cifras de distancia
  await page.keyboard.press('KeyE')
  expect(await mode(page)).toBe('truck')
  await page.keyboard.press('KeyE')
  expect(await mode(page)).toBe('foot')
  const p = await player(page)
  const t = await truck(page)
  expect(Math.hypot(p[0] - t.position[0], p[2] - t.position[2])).toBeGreaterThan(1.2) // bajó a un costado, no encima
  // lejos: E no hace nada
  await page.evaluate(() => (window as any).__game.teleport([-30, 0, -20]))
  await settle(page)
  await expect(page.getByTestId('interact-prompt')).toHaveCount(0) // lejos: no se ofrece subir
  await page.keyboard.press('KeyE')
  expect(await mode(page)).toBe('foot')
})

// Task 18A: el mástil ya no es su bbox completo (era una pared invisible a nivel del suelo); la camioneta se frena contra
// la pasarela de la planchada, que ahora es sólida hasta el suelo (a 1,05 m no se pasa por debajo).
test('la camioneta acelera y se detiene sin atravesar la pasarela de la planchada', async ({ page }) => {
  const X = 6 // calle libre entre la rampa de la V y los caballetes: nada entre z 23 y la pasarela
  const face = (await page.evaluate(([x]) => (window as any).__game.renderedBoundsIn('sk575_planchada', [x - 1, 0.3, 0], [x + 1, 1.2, 3]) as Box | null, [X] as const))!.max[2]
  await page.evaluate(([x, z]) => (window as any).__game.teleportTruck([x, 0, z], 0), [X, face + 2.3 + 20] as const) // rumbo 0 mira a -Z
  await page.evaluate(() => {
    const g = (window as any).__game
    g.teleport([0, 0, 25]) // jugador fuera de la trayectoria
  })
  await truckParked(page, X, face + 2.3 + 20)
  await settle(page)
  const start = await truck(page)
  await page.evaluate(() => {
    const g = (window as any).__game
    g.teleport(g.getTruck().position) // sube (teleport junto a la camioneta)
  })
  await page.keyboard.press('KeyE')
  expect(await mode(page)).toBe('truck')

  await drive(page, { throttle: 1, steer: 0, brake: false })
  let top = 0
  let last = start
  let still = 0
  // muestra cada 0,25 s de simulación de la camioneta; tope de 25 s de simulación (no de reloj)
  for (let i = 0; still < 4 && i < 100; i++) {
    await waitSteps(page, 15, 'truckSteps')
    last = await truck(page)
    top = Math.max(top, last.speed)
    still = top > 5 && last.speed < 0.2 ? still + 1 : 0
  }
  await drive(page, null)
  expect(top).toBeGreaterThan(8) // aceleró
  expect(top).toBeLessThan(12.8) // y respeta maxSpeed 12
  // se detuvo contra la pasarela: el frente (centro - semilargo 2.3) no pasó de su cara +Z, y quedó pegada (no frenó antes)
  const front = last.position[2] - 2.3
  expect(front).toBeGreaterThan(face - 0.3)
  expect(front).toBeLessThan(face + 1.0)
  expect(Math.abs(last.speed)).toBeLessThan(0.3)
})

test('al volcarse >60° por 3 s vuelve al acceso', async ({ page }) => {
  await page.evaluate(() => (window as any).__game.teleportTruck([0, 0, 20], 0))
  await truckParked(page, 0, 20)
  // vuelca el cuerpo físicamente (180° en Z) y deja correr el reloj de vuelco
  await page.evaluate(() => (window as any).__game.flipTruck())
  await waitSteps(page, 30, 'truckSteps') // medio segundo de simulación: sigue volcada (el reloj pide 3 s)
  expect((await truck(page)).inclination).toBeGreaterThan(60)
  await page.waitForFunction(([sx, sz]) => Math.hypot((window as any).__game.getTruck().position[0] - sx, (window as any).__game.getTruck().position[2] - sz) < 1, [TRUCK_SPAWN[0], TRUCK_SPAWN[2]], { timeout: 60_000 }) // el reloj de vuelco pide 3 s de simulación
  expect((await truck(page)).inclination).toBeLessThan(10)
})

test('al respawnear, la cámara no planea por el mapa', async ({ page }) => {
  await page.evaluate(() => (window as any).__game.teleport([30, 0, 20]))
  await settle(page)
  await waitFrames(page, 30) // la cámara ya alcanzó al jugador (se suaviza por cuadro)
  // 6 frames dibujados (no 100 ms: con la máquina cargada pasaban menos): con pivote suavizado aún estaría a decenas de metros
  await page.evaluate(async () => {
    ;(window as any).__game.teleport([-35, 0, 0])
    for (let i = 0; i < 6; i++) await new Promise((r) => requestAnimationFrame(r))
  })
  const c = await page.evaluate(() => (window as any).__game.getCamera() as Pos)
  expect(Math.hypot(c[0] + 35, c[2])).toBeLessThan(10)
})

test('A gira a la izquierda: el rumbo aumenta al avanzar con steer +1', async ({ page }) => {
  await page.evaluate(() => (window as any).__game.teleportTruck([-10, 0, 20], 0))
  await page.evaluate(() => (window as any).__game.teleport([-10, 0, 21.5]))
  await page.waitForFunction(() => {
    const w = (window as any).__game
    const p = w.getPosition()
    return Math.hypot(p[0] + 10, p[2] - 21.5) < 0.2 && w.isGrounded() && Math.abs(w.getTruck().speed) < 0.05
  })
  await page.keyboard.press('KeyE')
  await page.waitForFunction(() => (window as any).__game.getMode() === 'truck')
  await drive(page, { throttle: 1, steer: 1, brake: false })
  await waitSteps(page, 90, 'truckSteps') // 1,5 s de simulación
  const t = await truck(page)
  await drive(page, null)
  expect(t.heading).toBeGreaterThan(0.2)
  expect(t.position[0]).toBeLessThan(-10.5) // yaw 0 mira a -Z; girar a la izquierda lo lleva hacia -X
})

// QA D-09: de frente contra la escalera de una pileta, la camioneta trepaba la rampa de colisión del jugador y quedaba
// encaramada a 26° sin poder avanzar. Ahora choca de frente contra el volumen de la escalera, queda plana y retrocede.
test('contra la escalera de una pileta: se frena plana (no se encarama) y sale en reversa', async ({ page }) => {
  const stair = { footX: -12.998, z: -20.7 } // pileta1_escalera (traversal.json)
  await page.evaluate(([z]) => {
    const g = (window as any).__game
    g.teleportTruck([-24, 0, z], -Math.PI / 2) // mira a +X, hacia la escalera
    g.teleport([-24, 0, z - 2.5])
  }, [stair.z] as const)
  await truckParked(page, -24, stair.z)
  await settle(page)
  await page.evaluate(() => (window as any).__game.teleport((window as any).__game.getTruck().position))
  await page.keyboard.press('KeyE')
  expect(await mode(page)).toBe('truck')
  await drive(page, { throttle: 1, steer: 0, brake: false })
  let top = 0
  let last = await truck(page)
  let still = 0
  let maxIncl = 0
  for (let i = 0; still < 4 && i < 100; i++) {
    await waitSteps(page, 15, 'truckSteps')
    last = await truck(page)
    top = Math.max(top, last.speed)
    maxIncl = Math.max(maxIncl, last.inclination)
    still = top > 3 && Math.abs(last.speed) < 0.2 ? still + 1 : 0
  }
  expect(top).toBeGreaterThan(3)
  expect(maxIncl).toBeLessThan(10) // no se encaramó (antes ≈ 26°)
  expect(last.position[0] + 2.3).toBeLessThan(stair.footX + 0.3) // el frente quedó en el pie de la escalera
  expect(last.position[0] + 2.3).toBeGreaterThan(stair.footX - 1.0)
  await drive(page, { throttle: -1, steer: 0, brake: false })
  await page.waitForFunction(() => (window as any).__game.getTruck().speed < -1, null, { timeout: 60_000 })
  await drive(page, null)
})
