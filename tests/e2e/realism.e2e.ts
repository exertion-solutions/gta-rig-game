import { expect, test, type Page } from '@playwright/test'
import { waitFrames } from './wait'

// Realismo visual (Task 16): el juego arranca en cada calidad, presupuesto en Alta (con posproceso forzado con ?post=1,
// porque en automatización se desactiva) y degradación automática con cuadros lentos simulados.
const g = <T>(page: Page, fn: string, ...a: unknown[]) => page.evaluate(([f, args]) => (window as any).__game[f as string](...(args as unknown[])) as T, [fn, a] as const)

async function boot(page: Page, query: string) {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/?' + query)
  await page.waitForFunction(() => {
    const w = (window as any).__game
    return w?.renderInfo && w.getQuality && w.skyReady && w.renderedBounds && w.renderedBounds('sk575_mastil')
  }, null, { timeout: 120_000 })
  await waitFrames(page, 20)
}

for (const q of ['high', 'medium', 'low'] as const) {
  test(`arranca en calidad ${q}`, async ({ page }) => {
    await boot(page, `quality=${q}`)
    expect((await g<{ quality: string; auto: boolean }>(page, 'getQuality')).quality).toBe(q)
    const info = await g<{ calls: number; triangles: number }>(page, 'renderInfo')
    expect(info.calls).toBeGreaterThan(0)
    expect(info.calls).toBeLessThan(250)
    expect(info.triangles).toBeLessThan(1_000_000)
  })
}

test('Alta con posproceso: draw calls < 250 y triángulos < 1 M', async ({ page }) => {
  await boot(page, 'quality=high&post=1')
  await waitFrames(page, 10)
  const info = await g<{ calls: number; triangles: number }>(page, 'renderInfo')
  test.info().annotations.push({ type: 'perf', description: `${info.calls} draw calls, ${info.triangles} triángulos` })
  expect(info.calls).toBeGreaterThan(0)
  expect(info.calls).toBeLessThan(250)
  expect(info.triangles).toBeLessThan(1_000_000)
})

test('degradación automática: cuadros lentos bajan de nivel y el ajuste fijo la detiene', async ({ page }) => {
  await boot(page, 'quality=auto')
  expect(await g(page, 'getQuality')).toEqual({ quality: 'high', auto: true })
  await g(page, 'feedFrameMs', 40, 400) // FPS simulados bajos (25 FPS)
  const q = await g<{ quality: string; auto: boolean }>(page, 'getQuality')
  expect(['medium', 'low']).toContain(q.quality)
  await g(page, 'setQuality', 'high')
  expect(await g(page, 'getQuality')).toEqual({ quality: 'high', auto: false })
})
