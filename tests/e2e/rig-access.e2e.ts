import { expect, test, type Page } from '@playwright/test'
import { settle, waitFrames } from './wait'

// Carrier, casilla del maquinista, comando de izaje y llave de potencia (src/game/world/rigAccess.ts). Ilustrativo.
type Pos = [number, number, number]
const g = <T,>(page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(([f, a]) => (window as any).__game[f as string](...(a as unknown[])), [fn, args] as const) as Promise<T>
const pos = (page: Page) => g<Pos>(page, 'getPosition')
const prompt = (page: Page) => page.getByTestId('interact-prompt')

async function boot(page: Page) {
  await page.goto('/?quality=low')
  await page.waitForFunction(() => {
    const w = (window as any).__game
    return w?.getPosition && w.rigMotion && w.climbState && w.renderedBounds?.('sk575_mastil')
  }, null, { timeout: 120_000 })
}
// E engancha la escalera, W la sube hasta que suelta sola arriba
async function climbUp(page: Page) {
  await page.keyboard.press('KeyE')
  await page.waitForFunction(() => (window as any).__game.climbState() !== null)
  await g(page, 'setInput', { x: 0, z: 1, run: false })
  await page.waitForFunction(() => (window as any).__game.climbState() === null, null, { timeout: 60_000 })
  await g(page, 'setInput', null)
  await settle(page)
}

test('sube del suelo a la cubierta del carrier y de ahí a la casilla del maquinista', async ({ page }) => {
  await boot(page)
  await g(page, 'teleport', [-12, 0, 1.9])
  await settle(page)
  await expect(prompt(page)).toContainText('subir por la escalera')
  await climbUp(page)
  expect((await pos(page))[1]).toBeCloseTo(1.35, 1) // cubierta
  await g(page, 'teleport', [-5.6, 1.35, 1.5])
  await settle(page)
  await climbUp(page)
  const p = await pos(page)
  expect(p[1]).toBeCloseTo(3.55, 1) // descanso de la casilla
  expect(p[0]).toBeGreaterThan(-4)
})

test('el comando de izaje sube y baja el aparejo', async ({ page }) => {
  await boot(page)
  await g(page, 'teleport', [-2.2, 3.55, 1.9]) // dentro de la casilla, frente al comando
  await settle(page)
  await expect(prompt(page)).toContainText('izar el aparejo')
  await page.keyboard.press('KeyE')
  await page.waitForFunction(() => (window as any).__game.rigMotion().hoistOffset > 1, null, { timeout: 60_000 })
  await expect(prompt(page)).toContainText('bajar el aparejo')
  await page.keyboard.press('KeyE')
  await page.waitForFunction(() => (window as any).__game.rigMotion().hoistOffset < 0, null, { timeout: 60_000 })
})

test('la llave de potencia se acciona desde el piso de trabajo: gira y vuelve', async ({ page }) => {
  await boot(page)
  await g(page, 'teleport', [0.3, 3.606, 1.3])
  await settle(page)
  await expect(prompt(page)).toContainText('Llave de potencia')
  await page.keyboard.press('KeyE')
  await page.waitForFunction(() => (window as any).__game.rigMotion().tongAngle > 0.2, null, { timeout: 60_000 })
  await page.waitForFunction(() => (window as any).__game.rigMotion().tongAngle === 0, null, { timeout: 60_000 })
  await waitFrames(page, 2)
})
