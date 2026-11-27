import { expect, test, type Page } from '@playwright/test'
import { settle, waitSteps } from './wait'

type Pos = [number, number, number]
const truck = (page: Page) => page.evaluate(() => (window as any).__game.getTruck() as { position: Pos; speed: number })
const tsteps = (page: Page) => page.evaluate(() => (window as any).__game.truckSteps() as number)

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => {
    const g = (window as any).__game
    return g?.getTruck && g.getPosition && g.renderedBounds('sk575_mastil')
  }, null, { timeout: 90_000 })
  await settle(page)
})

test('la pausa congela la física: la camioneta en marcha no se mueve y al cerrar reanuda', async ({ page }) => {
  await page.evaluate(() => {
    const g = (window as any).__game
    g.teleportTruck([-20, 0, 20], -Math.PI / 2) // despejada, rumbo +X
    g.forceMode('truck')
    g.setTruckInput({ throttle: 1, steer: 0, brake: false })
  })
  await page.waitForFunction(() => (window as any).__game.getTruck().speed > 2, null, { timeout: 60_000 })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('pause-menu')).toBeVisible()
  const s0 = await tsteps(page)
  const p0 = (await truck(page)).position
  await page.waitForTimeout(1000) // reloj: con la física en pausa no hay pasos que esperar
  expect(await tsteps(page)).toBe(s0)
  const p1 = (await truck(page)).position
  expect(Math.hypot(p1[0] - p0[0], p1[2] - p0[2])).toBeLessThan(1e-6)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('pause-menu')).toHaveCount(0)
  await waitSteps(page, 30, 'truckSteps')
  const p2 = (await truck(page)).position
  expect(Math.hypot(p2[0] - p0[0], p2[2] - p0[2])).toBeGreaterThan(0.1)
})
