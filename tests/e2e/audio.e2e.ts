import { expect, test, type Page } from '@playwright/test'

// Sonido y radio: subtítulo del instructor al iniciar la misión 1, mute con N y volúmenes en el panel (persistidos),
// y sin errores en consola (headless sin salida de audio; sin archivos de voz -> solo subtítulos).
const g = (page: Page, fn: string, ...a: unknown[]) => page.evaluate(([f, args]) => (window as any).__game[f as string](...(args as unknown[])), [fn, a] as const)

async function ready(page: Page) {
  await page.waitForFunction(() => {
    const w = (window as any).__game
    return w?.getMission && w.holdRadio && w.getMix && w.getMission().status === 'idle'
  }, null, { timeout: 90_000 })
}

test('al iniciar la misión 1 aparece el subtítulo del instructor y después el briefing literal', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('/')
  await ready(page)
  await expect(page.getByTestId('hud-radio')).toHaveCount(0)
  await g(page, 'holdRadio', true)
  await g(page, 'startMission', 'm1-reconocimiento')
  await expect(page.getByTestId('hud-radio-text')).toHaveText('Instructor en línea. Te paso la consigna.')
  await g(page, 'holdRadio', false)
  // la línea de enlace dura su tiempo de lectura; después llega el primer subtítulo del briefing de la misión
  await expect(page.getByTestId('hud-radio-text')).toContainText('Llegá al Acceso de la locación', { timeout: 15_000 })
  expect(await g(page, 'getSubtitle')).toMatch(/^Llegá al Acceso/)
  expect(errors).toEqual([])
})

test('N silencia y lo recuerda al recargar; el panel ajusta volúmenes', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  const mute = page.getByTestId('audio-mute')
  await expect(mute).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('KeyN')
  await expect(mute).toHaveAttribute('aria-pressed', 'true')
  await expect(mute).toContainText('Sin sonido')
  await page.reload()
  await ready(page)
  await expect(page.getByTestId('audio-mute')).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('KeyN')
  await expect(page.getByTestId('audio-mute')).toHaveAttribute('aria-pressed', 'false')

  await page.keyboard.press('KeyM')
  await expect(page.getByTestId('audio-settings')).toBeVisible()
  await page.getByTestId('audio-sfx').fill('30')
  expect((await g(page, 'getMix')).sfx).toBeCloseTo(0.3)
  await page.getByTestId('audio-muted').check()
  expect((await g(page, 'getMix')).muted).toBe(true)
  await page.reload()
  await ready(page)
  expect(await g(page, 'getMix')).toMatchObject({ sfx: 0.3, muted: true })
})
