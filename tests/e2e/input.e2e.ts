import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { settle, truckParked, waitSteps } from './wait'

type Pos = [number, number, number]
const LADDER = JSON.parse(readFileSync('src/game/world/traversal.json', 'utf8')).ladders[0] as { bottom: Pos }
const pos = (page: Page) => page.evaluate(() => (window as any).__game.getPosition() as Pos)
const speed = (page: Page) => page.evaluate(() => (window as any).__game.getTruck().speed as number)
// Alt-Tab sin keyup: el navegador dispara blur (y visibilitychange si la pestaña queda oculta) pero nunca el keyup.
const loseFocus = (page: Page) =>
  page.evaluate(() => {
    window.dispatchEvent(new Event('blur'))
    document.dispatchEvent(new Event('visibilitychange'))
  })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => {
    const g = (window as any).__game
    return g?.getTruck && g.getPosition && g.renderedBounds('sk575_mastil')
  }, null, { timeout: 90_000 })
  await settle(page)
})

test('a pie: W apretada y blur sin keyup, el jugador se detiene (no queda W pegada)', async ({ page }) => {
  await page.evaluate(() => {
    const g = (window as any).__game
    g.setYaw(-Math.PI / 2) // mira a +X: campo libre
    g.teleport([-30, 0, 20])
  })
  await settle(page)
  await page.keyboard.down('KeyW')
  await waitSteps(page, 30)
  const a = await pos(page)
  await waitSteps(page, 30)
  const b = await pos(page)
  expect(b[0] - a[0]).toBeGreaterThan(0.3) // camina con W
  await loseFocus(page)
  await waitSteps(page, 2)
  const c = await pos(page)
  await waitSteps(page, 60)
  const d = await pos(page)
  expect(Math.hypot(d[0] - c[0], d[2] - c[2])).toBeLessThan(0.01) // un segundo de simulación después: quieto
  await page.keyboard.up('KeyW')
})

test('en la camioneta: W apretada y blur sin keyup, deja de acelerar y se detiene', async ({ page }) => {
  await page.evaluate(() => {
    const g = (window as any).__game
    g.teleportTruck([-30, 0, 20], -Math.PI / 2) // mira a +X
    g.teleport([-30, 0, 21.5])
  })
  await truckParked(page, -30, 20)
  await settle(page)
  await page.keyboard.press('KeyE')
  await page.waitForFunction(() => (window as any).__game.getMode() === 'truck')
  await page.keyboard.down('KeyW')
  await page.waitForFunction(() => (window as any).__game.getTruck().speed > 3, null, { timeout: 60_000 })
  await loseFocus(page)
  const s0 = await speed(page)
  await waitSteps(page, 60, 'truckSteps')
  expect(await speed(page)).toBeLessThan(s0) // sin acelerador: frena (antes seguía acelerando)
  await page.waitForFunction(() => Math.abs((window as any).__game.getTruck().speed) < 0.2, null, { timeout: 60_000 })
  await page.keyboard.up('KeyW')
})

test('trepando: W apretada y blur sin keyup, deja de subir', async ({ page }) => {
  await page.evaluate((p) => (window as any).__game.teleport(p), LADDER.bottom)
  await settle(page)
  await page.evaluate(() => (window as any).__game.interact())
  await page.waitForFunction(() => (window as any).__game.climbState() !== null)
  await page.keyboard.down('KeyW')
  await page.waitForFunction(() => (window as any).__game.climbState().progress > 0.05, null, { timeout: 60_000 })
  await loseFocus(page)
  await waitSteps(page, 2)
  const p0 = (await page.evaluate(() => (window as any).__game.climbState().progress)) as number
  await waitSteps(page, 60)
  expect(await page.evaluate(() => (window as any).__game.climbState().progress)).toBe(p0)
  await page.keyboard.up('KeyW')
})
