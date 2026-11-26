import { expect, test, type Page } from '@playwright/test'
import { RESPAWN } from '../../src/game/player/movement'

type Box = { min: number[]; max: number[] }
type Pos = [number, number, number]
// CHAR_SHOTS=<dir> guarda capturas del personaje (idle/walk/run) para revisión visual.
const SHOTS = process.env.CHAR_SHOTS

const clip = (page: Page) => page.evaluate(() => (window as any).__game.currentClip() as string | null)
const input = (page: Page, i: { x: number; z: number; run: boolean } | null) => page.evaluate((v) => (window as any).__game.setInput(v), i)
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/task15-${name}.png` })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => {
    const g = (window as any).__game
    return g?.currentClip && g.getPosition && g.renderedBounds('worker') && g.renderedBounds('sk575_mastil')
  }, null, { timeout: 90_000 })
  await page.evaluate((p) => {
    const g = (window as any).__game
    g.setInput(null)
    g.setYaw(-Math.PI / 2) // hacia +X, calle libre desde el Acceso
    g.teleport(p)
  }, RESPAWN)
  await page.waitForTimeout(1500)
})

test("el personaje camina con clip 'walk' al mover y vuelve a 'idle' al soltar", async ({ page }) => {
  expect(await clip(page)).toBe('idle')
  await shot(page, 'idle')
  await input(page, { x: 0, z: 1, run: false })
  await page.waitForTimeout(1000)
  expect(await clip(page)).toBe('walk')
  await shot(page, 'walk')
  await input(page, { x: 0, z: 1, run: true })
  await page.waitForTimeout(800)
  expect(await clip(page)).toBe('run')
  await shot(page, 'run')
  await input(page, null)
  await page.waitForTimeout(1000)
  expect(await clip(page)).toBe('idle')
  await shot(page, 'idle-after')
})

test('la altura del modelo está entre 1.6 y 1.9 m y los pies en el suelo del jugador', async ({ page }) => {
  const b = (await page.evaluate(() => (window as any).__game.renderedBounds('worker'))) as Box
  const p = (await page.evaluate(() => (window as any).__game.getPosition())) as Pos
  const h = b.max[1] - b.min[1]
  expect(h).toBeGreaterThan(1.6)
  expect(h).toBeLessThan(1.9)
  expect(Math.abs(b.min[1] - p[1])).toBeLessThan(0.06)
})
