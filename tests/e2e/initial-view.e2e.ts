import { expect, test } from '@playwright/test'
import { waitFrames } from './wait'

// QA B P0-2: el primer cuadro debe mostrar el equipo visto desde el Acceso (antes miraba al borde del mundo).
const PARTS = ['sk575_mastil', 'sk575_piso', 'sk575_bop', 'sk575_carrier', 'sk575_planchada', 'sk575_piletas']

test('al cargar, el equipo está dentro del cuadro de la cámara (sin tocar nada)', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => {
    const w = (window as any).__game
    return w?.inFrustum && w.renderedBounds('sk575_mastil') && w.renderedBounds('sk575_piletas')
  }, null, { timeout: 90_000 })
  await waitFrames(page, 30) // la cámara de seguimiento se ubica por cuadro
  const r = await page.evaluate((ids) => {
    const w = (window as any).__game
    const bs = ids.map((id: string) => w.renderedBounds(id) as { min: number[]; max: number[] })
    const min = [0, 1, 2].map((i) => Math.min(...bs.map((b) => b.min[i])))
    const max = [0, 1, 2].map((i) => Math.max(...bs.map((b) => b.max[i])))
    const center = [0, 1, 2].map((i) => (min[i] + max[i]) / 2)
    // centro del conjunto a la altura del piso de trabajo, pie del mástil y centro del carrier
    const pts = [[center[0], 3.6, center[2]], [0, 3.6, 0], [(bs[3].min[0] + bs[3].max[0]) / 2, 2, 0]]
    return { inside: w.inFrustum(pts) as boolean[], box: w.boxInFrustum(min, max) as boolean }
  }, PARTS)
  expect(r.box).toBe(true)
  expect(r.inside).toEqual([true, true, true])
})
