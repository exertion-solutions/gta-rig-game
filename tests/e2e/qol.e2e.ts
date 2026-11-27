import { expect, test, type Page } from '@playwright/test'
import { settle, waitSteps } from './wait'

type Pos = [number, number, number]
const pos = (page: Page) => page.evaluate(() => (window as any).__game.getPosition() as Pos)

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => {
    const g = (window as any).__game
    return g?.getTruck && g.getPosition && g.renderedBounds('sk575_mastil')
  }, null, { timeout: 90_000 })
  await settle(page)
})

test('Esc abre y cierra la pausa; con la pausa abierta W no mueve al jugador', async ({ page }) => {
  const p0 = await pos(page)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('pause-menu')).toBeVisible()
  await page.keyboard.down('KeyW')
  await waitSteps(page, 30)
  await page.keyboard.up('KeyW')
  expect(await pos(page)).toEqual(p0)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('pause-menu')).toHaveCount(0)
})

test('un ajuste de sensibilidad persiste tras recargar', async ({ page }) => {
  await page.keyboard.press('Escape')
  await page.getByTestId('set-sensitivity').fill('1.6')
  await page.getByTestId('set-invert').check()
  await page.reload()
  await page.waitForFunction(() => (window as any).__game?.getPosition, null, { timeout: 90_000 })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('set-sensitivity')).toHaveValue('1.6')
  await expect(page.getByTestId('set-invert')).toBeChecked()
})

test('Tab abre el mapa con sectores numerados, sin distancias ni zonas, y Esc lo cierra', async ({ page }) => {
  await page.keyboard.press('Tab')
  const map = page.getByTestId('full-map')
  await expect(map).toBeVisible()
  await expect(page.getByTestId('map-player')).toBeVisible()
  const text = await map.innerText()
  expect(text).not.toMatch(/\d[ \t]*(m|km|metros)(?![\p{L}])/iu)
  expect(text).not.toMatch(/zona|aprob|habilit|certific|área segura|exclusi/i)
  await page.keyboard.press('Escape')
  await expect(map).toHaveCount(0)
})

test('pantalla de título: sin automatización aparece, bloquea el juego y "Jugar" la cierra con un clic', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }))
  await page.goto('/')
  await expect(page.getByTestId('title-screen')).toBeVisible()
  await expect(page.getByTestId('title-play')).toBeVisible({ timeout: 90_000 })
  expect(await page.getByTestId('title-screen').innerText()).not.toMatch(/aprob|habilit|certific/i)
  await page.getByTestId('title-play').click()
  await expect(page.getByTestId('title-screen')).toHaveCount(0)
})

test('C agacha: baja la velocidad a ~0,6x y se suelta al levantar la tecla', async ({ page }) => {
  await page.keyboard.down('KeyC')
  await expect.poll(() => page.evaluate(() => (window as any).__game.isCrouching?.())).toBe(true)
  await expect.poll(() => page.evaluate(() => (window as any).__game.currentClip?.())).toBe('crouch') // se ve agachado, no solo más lento
  // el esqueleto baja de verdad (pelvis ~0,9 m de pie -> ~0,6 m): no solo se elige el clip
  await expect.poll(() => page.evaluate(() => (window as any).__game.pose().pelvisY as number)).toBeLessThan(0.75)
  await page.keyboard.up('KeyC')
  await expect.poll(() => page.evaluate(() => (window as any).__game.isCrouching?.())).toBe(false)
})
