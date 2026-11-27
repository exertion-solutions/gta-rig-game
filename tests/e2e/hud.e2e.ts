import { expect, test, type Page } from '@playwright/test'
import { settle, waitFrames, waitSteps } from './wait'

const FORBIDDEN = /aprobad|habilitad|certificad/i
// frente al acumulador, fuera de sus cajas de colisión (QA D-07): la camioneta también entra ahí
const ACUM: [number, number, number] = [-20.5, 0, 0.5]
const g = <T>(page: Page, fn: string, ...a: unknown[]) => page.evaluate(([f, args]) => (window as any).__game[f as string](...(args as unknown[])) as T, [fn, a] as const)

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => {
    const w = (window as any).__game
    return w?.getTruck && w.getPosition && w.getMission && w.renderedBounds('sk575_mastil')
  }, null, { timeout: 90_000 })
  await page.waitForFunction(() => document.querySelector('[data-testid="hud"]'))
  await settle(page)
})

test('HUD: leyenda fija, radar, sin zonas ni distancias', async ({ page }) => {
  await expect(page.getByTestId('radar')).toBeVisible()
  const legend = await page.getByTestId('legend').innerText()
  expect(legend.toLowerCase()).toContain('referencia digital, no as-built / ilustrativo')
  expect(legend).toContain('+Y = este')
  const hud = await page.getByTestId('hud').innerText()
  expect(hud).not.toMatch(/\b(alto|medio|bajo)\b|\d\s?m\b|exclusi|área segura/i)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.setViewportSize({ width: 390, height: 800 })
  await page.waitForFunction(() => window.innerWidth === 390)
  await waitFrames(page, 2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('misión de prueba de punta a punta (a pie): M, iniciar, llegar, elegir, marcar, pantalla final', async ({ page }) => {
  await page.keyboard.press('KeyM')
  const panel = page.getByTestId('mission-panel')
  await expect(panel.locator('[data-mission="dev-fixture"]')).toBeVisible()
  await expect(panel.locator('[data-mission="dev-omitida"]')).toHaveCount(0)
  expect(await panel.innerText()).not.toContain('dato A2 ausente') // la razón de omisión nunca se muestra
  // con el panel abierto, W no mueve al jugador
  const p0 = await g<number[]>(page, 'getPosition')
  await page.keyboard.down('KeyW')
  await waitSteps(page, 30) // medio segundo de simulación con W apretada
  await page.keyboard.up('KeyW')
  const p1 = await g<number[]>(page, 'getPosition')
  expect(Math.hypot(p1[0] - p0[0], p1[2] - p0[2])).toBeLessThan(0.05)

  await panel.locator('[data-mission="dev-fixture"]').getByRole('button', { name: 'Iniciar' }).click()
  await expect(panel).toHaveCount(0)
  await expect(page.getByTestId('hud-objective')).toHaveText('Andá hasta el acumulador')
  // el reporter informa "estás en el Acceso" (en el cuadro siguiente al inicio) antes de que cuente la llegada
  await page.waitForFunction(() => (window as any).__game.getAtSector() === 'acceso')
  await waitFrames(page, 2)

  await g(page, 'teleport', ACUM)
  await expect(page.getByTestId('hud-sector')).toContainText('Acumulador')
  expect(await page.getByTestId('hud-sector').innerText()).not.toMatch(/koomey/i) // nombre saneado
  await expect(page.getByTestId('choose-controls')).toBeVisible() // avanzó y el panel se abrió solo
  await page.getByLabel('Opción A').check()
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await page.getByTestId('mark-controls').getByRole('button', { name: 'OK', exact: true }).click()

  const done = page.getByTestId('mission-completed')
  await expect(done).toBeVisible()
  const text = await page.getByTestId('mission-panel').innerText()
  expect(text.toLowerCase()).toContain('misión completada')
  expect(text).toContain('Autorregistro: OK')
  expect(text).not.toMatch(FORBIDDEN)
  await page.getByRole('button', { name: 'Cerrar misión' }).click()
  await expect(page.getByTestId('mission-panel')).toHaveCount(0)
})

test('F muestra la ficha saneada del sector donde estás', async ({ page }) => {
  await g(page, 'teleport', ACUM)
  await expect(page.getByTestId('hud-sector')).toBeVisible()
  await page.keyboard.press('KeyF')
  const ficha = page.getByTestId('hud-ficha')
  await expect(ficha).toBeVisible()
  expect(await ficha.innerText()).not.toMatch(/koomey/i)
  await page.keyboard.press('KeyF')
  await expect(ficha).toHaveCount(0)
})

test('conduciendo la camioneta también cuenta la llegada', async ({ page }) => {
  await g(page, 'startMission', 'dev-fixture')
  await page.waitForFunction(() => (window as any).__game.getMission()?.missionId === 'dev-fixture')
  await waitFrames(page, 2) // el reporter informa el sector en el cuadro siguiente al inicio
  await g(page, 'teleportTruck', [-10, 0, 20], 0)
  await g(page, 'teleport', [-10, 0, 21.5])
  // espera estado: el jugador quedó junto a la camioneta (no un tiempo fijo)
  await page.waitForFunction(() => {
    const w = (window as any).__game
    const p = w.getPosition()
    return Math.hypot(p[0] + 10, p[2] - 21.5) < 0.2 && w.isGrounded()
  })
  await page.keyboard.press('KeyE')
  await page.waitForFunction(() => (window as any).__game.getMode() === 'truck')
  await g(page, 'teleportTruck', ACUM, 0)
  await expect(page.getByTestId('choose-controls')).toBeVisible({ timeout: 10_000 })
  expect((await g<{ objectiveIndex: number }>(page, 'getMission')).objectiveIndex).toBe(1)
})
