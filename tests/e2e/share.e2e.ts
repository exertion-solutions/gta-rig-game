import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { settle, waitFrames } from './wait'

// Compartible (sin publicar): modo foto (P), tarjeta de misión completada y enlace ?mision=.
const g = <T>(page: Page, fn: string, ...a: unknown[]) =>
  page.evaluate(([f, args]) => (window as any).__game[f as string](...(args as unknown[])) as T, [fn, a] as const)
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const ready = (page: Page) =>
  page.waitForFunction(() => {
    const w = (window as any).__game
    return w?.getMission && w.getPosition && w.teleport && w.renderedBounds('sk575_mastil')
  }, null, { timeout: 90_000 })
const pngFrom = async (download: import('@playwright/test').Download) => readFileSync((await download.path())!)

test('P oculta el HUD y descarga un PNG; P o Esc vuelven', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  await settle(page)
  await expect(page.getByTestId('hud-mission')).toBeVisible()
  await page.keyboard.press('KeyP')
  await expect(page.getByTestId('hud-mission')).toHaveCount(0)
  await expect(page.getByTestId('radar')).toHaveCount(0)
  await expect(page.getByTestId('photo-bar')).toBeVisible()
  await waitFrames(page, 3)
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), page.keyboard.press('Enter')])
  expect(dl.suggestedFilename()).toMatch(/\.png$/)
  const png = await pngFrom(dl)
  expect(png.subarray(0, 8).equals(PNG)).toBe(true)
  expect(png.length).toBeGreaterThan(5_000)
  // regresión QA: la captura salió en blanco (un useFrame con prioridad cambió el orden de render); debe haber escena
  const colors = await page.evaluate(async (b64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const ctx = c.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const set = new Set<string>()
    for (let x = 0; x < c.width; x += 40) for (let y = 0; y < c.height * 0.9; y += 40) set.add(ctx.getImageData(x, y, 1, 1).data.slice(0, 3).join())
    return set.size
  }, png.toString('base64'))
  expect(colors).toBeGreaterThan(30)
  await expect(page.getByTestId('photo-status')).toHaveText('Foto descargada')
  await page.keyboard.press('KeyP')
  await expect(page.getByTestId('photo-bar')).toHaveCount(0)
  await expect(page.getByTestId('hud-mission')).toBeVisible()
  await page.keyboard.press('KeyP')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('photo-bar')).toHaveCount(0)
  await expect(page.getByTestId('pause-menu')).toHaveCount(0)
})

test('?mision=m3 deja la misión 3 en curso', async ({ page }) => {
  await page.goto('/?mision=m3')
  await page.waitForFunction(() => (window as any).__game?.getMission?.().missionId?.startsWith('m3-'), null, { timeout: 90_000 })
  expect((await g<{ status: string }>(page, 'getMission')).status).toBe('active')
})

test('?mision= desconocida se ignora', async ({ page }) => {
  await page.goto('/?mision=zzz')
  await ready(page)
  await waitFrames(page, 5)
  expect((await g<{ status: string }>(page, 'getMission')).status).toBe('idle')
})

test('con pantalla de título, la misión del enlace empieza al tocar Jugar', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }))
  await page.goto('/?mision=dev-fixture')
  await expect(page.getByTestId('title-play')).toBeVisible({ timeout: 90_000 })
  expect((await g<{ status: string }>(page, 'getMission')).status).toBe('idle')
  await page.getByTestId('title-play').click()
  await page.waitForFunction(() => (window as any).__game.getMission().missionId === 'dev-fixture')
})

test('tarjeta de misión completada: descarga PNG y el texto no usa palabras de aprobación', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/?mision=dev-fixture')
  await ready(page)
  await settle(page)
  await page.waitForFunction(() => (window as any).__game.getAtSector() === 'acceso')
  await waitFrames(page, 2)
  await g(page, 'teleport', [-20.5, 0, 4.6])
  await expect(page.getByTestId('choose-controls')).toBeVisible()
  await page.getByLabel('Opción A').check()
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await page.getByTestId('mark-controls').getByRole('button', { name: 'OK', exact: true }).click()
  const done = page.getByTestId('mission-completed')
  await expect(done).toBeVisible()
  expect(await done.innerText()).not.toMatch(/aprob|habilit|certific/i)
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), page.getByTestId('card-download').click()])
  expect((await pngFrom(dl)).subarray(0, 8).equals(PNG)).toBe(true)
  await page.getByTestId('link-copy').click()
  await expect(page.getByTestId('link-copy')).toHaveText('Enlace copiado')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\?mision=dev$/)
})
