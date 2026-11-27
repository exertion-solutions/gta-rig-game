import { expect, test, type Page } from '@playwright/test'
import { waitFrames } from './wait'

// Presupuesto de rendimiento (spec: escritorio < 250 draw calls y < 1 M triángulos visibles) y ciclo día/noche.
// renderInfo = renderer.info.render del último cuadro (incluye el pase de sombras). El FPS de este navegador sin GPU
// (SwiftShader, render por software) no representa hardware real: solo se anota, no se exige (docs/perf.md).
const g = <T>(page: Page, fn: string, ...a: unknown[]) => page.evaluate(([f, args]) => (window as any).__game[f as string](...(args as unknown[])) as T, [fn, a] as const)

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/')
  await page.waitForFunction(() => {
    const w = (window as any).__game
    return w?.renderInfo && w.lights && w.inFrustum && w.renderedBounds('sk575_mastil') && w.renderedBounds('sk575_carrier')
  }, null, { timeout: 90_000 })
  await waitFrames(page, 30)
})

test('en escritorio, draw calls < 250 y triángulos visibles < 1 M', async ({ page }) => {
  for (const hour of [12, 0]) {
    await g(page, 'setHour', hour)
    await waitFrames(page, 5)
    const info = await g<{ calls: number; triangles: number }>(page, 'renderInfo')
    const fps = await page.evaluate(async () => {
      const t0 = performance.now()
      let n = 0
      while (performance.now() - t0 < 2000) {
        await new Promise((r) => requestAnimationFrame(r))
        n++
      }
      return (n * 1000) / (performance.now() - t0)
    })
    test.info().annotations.push({ type: 'perf', description: `hora ${hour}: ${info.calls} draw calls, ${info.triangles} triángulos, ${fps.toFixed(1)} FPS (SwiftShader)` })
    expect(info.calls).toBeGreaterThan(0)
    expect(info.calls).toBeLessThan(250)
    expect(info.triangles).toBeLessThan(1_000_000)
  }
})

test('la hora 0 y la hora 12 producen intensidades de luz distintas', async ({ page }) => {
  type L = { sun: number; hemi: number; lamps: number }
  await g(page, 'setHour', 12)
  await waitFrames(page, 2)
  const noon = await g<L>(page, 'lights')
  await g(page, 'setHour', 0)
  await waitFrames(page, 2)
  const night = await g<L>(page, 'lights')
  expect(noon.sun).toBeGreaterThan(night.sun)
  expect(noon.hemi).toBeGreaterThan(night.hemi)
  expect(night.lamps).toBeGreaterThan(noon.lamps) // luces de la torre: solo emissive, encendidas de noche
  expect(night.hemi).toBeGreaterThan(0) // de noche se sigue viendo el equipo
})
