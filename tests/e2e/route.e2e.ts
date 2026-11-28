import { expect, test, type Page } from '@playwright/test'
import { BASE, ROUTE_END_S, pointAt, roadSpawn } from '../../src/game/world/route'

// Ruta base → equipo (src/game/world/route.ts): arranque en la base, terreno que sostiene, velocidad de ruta e indicador.
type Truck = { position: [number, number, number]; speed: number; inclination: number }
const g = <T,>(page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(([f, a]) => (window as any).__game[f as string](...(a as unknown[])), [fn, args] as const) as Promise<T>

async function boot(page: Page, query: string) {
  await page.goto('/?quality=low&' + query)
  await page.waitForFunction(() => {
    const w = (window as any).__game
    return w?.getTruck && w.getPosition && w.routeSpot && w.truckSteps
  }, null, { timeout: 120_000 })
}
const steps = (page: Page, n: number) =>
  page.evaluate((k) => (window as any).__game.truckSteps() + k, n).then((goal) => page.waitForFunction((x) => (window as any).__game.truckSteps() >= x, goal, { timeout: 90_000 }))

test('con ?inicio=base arranca en la base operativa, sobre el terreno, lejos del equipo', async ({ page }) => {
  await boot(page, 'inicio=base')
  await steps(page, 60)
  const p = await g<[number, number, number]>(page, 'getPosition')
  expect(Math.hypot(p[0] - BASE.player[0], p[2] - BASE.player[2])).toBeLessThan(2)
  expect(Math.abs(p[1] - BASE.y)).toBeLessThan(0.6) // apoyado: no cayó
  expect(Math.hypot(p[0], p[2])).toBeGreaterThan(10_000)
  await expect(page.getByTestId('route-hud')).toContainText('Al equipo: 20,0 km')
  await expect(page.getByTestId('route-hud')).toContainText('Base operativa')
})

test('en la ruta la camioneta supera la velocidad de la locación y sigue apoyada en una pendiente', async ({ page }) => {
  await boot(page, 'inicio=base')
  await g(page, 'forceMode', 'truck')
  const s = 15400 // subida de la sierra
  const sp = roadSpawn(pointAt(s).x, pointAt(s).z)
  await g(page, 'teleportTruck', sp.position, sp.yaw)
  await steps(page, 90)
  await g(page, 'setTruckInput', { throttle: 1, steer: 0, brake: false })
  await steps(page, 300) // 5 s de simulación
  const t = await g<Truck>(page, 'getTruck')
  await g(page, 'setTruckInput', null)
  expect(t.speed).toBeGreaterThan(14) // en la locación el tope es 12 m/s
  expect(t.inclination).toBeLessThan(25)
  expect(t.position[1]).toBeGreaterThan(-95) // subió con el camino, no atravesó el terreno
  await expect(page.getByTestId('route-hud')).toContainText('km/h')
})

test('al final de la ruta está la locación: sin indicador de ruta y a nivel del equipo', async ({ page }) => {
  await boot(page, 'inicio=locacion')
  const e = pointAt(ROUTE_END_S)
  expect(Math.abs(e.x + 26)).toBeLessThan(1)
  await expect(page.getByTestId('route-hud')).toHaveCount(0)
  const p = await g<[number, number, number]>(page, 'getPosition')
  expect(Math.abs(p[1])).toBeLessThan(0.3)
})
