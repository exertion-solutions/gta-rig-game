import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

type Vec = [number, number, number]
const FORBIDDEN = /aprob|habilit|certific/i
const g = <T>(page: Page, fn: string, ...a: unknown[]) =>
  page.evaluate(([f, args]) => (window as any).__game[f as string](...(args as unknown[])) as T, [fn, a] as const)

// Puntos de llegada (marco del juego) y el sector que debe mostrar el HUD ahí. Solo cuenta el sector MÁS CERCANO cuyo
// radio y banda de piso contienen al jugador: BOP, mástil, piso de trabajo, llave y piso de enganche comparten planta
// (antes todos en (0,0)); cada uno pide ir a su lugar, y los pisos elevados piden estar a su altura (medida).
const PT = 3.606 // chapa del piso de trabajo (traversal.json)
const PE = 20.651 // plancha del piso de enganche (traversal.json)
const AWAY: Vec = [-10, 0, 20]
const ACCESO: Vec = [-26, 0, -24]
const MASTIL: Vec = [-3, 0, 3.5] // suelo, lado -X de la subestructura
const ENGANCHE: Vec = [1.0, PE, 0]
const BOP: Vec = [2.5, 0, 0] // suelo, bajo la rampa de la V
const TOUR: [Vec, string][] = [
  [[-20.5, 0, 4.6], 'acumulador'],
  [[6.2, 0, -11.2], 'manifold'],
  [BOP, 'bop'],
  [MASTIL, 'mastil'],
  [[-0.6, PT, 1.5], 'piso-trabajo'],
  [[1.0, PT, 0.5], 'llave'],
  [ENGANCHE, 'piso-enganche'],
  [[-6.3, 0, 0], 'cuadro'],
  [[8, 0, -1.6], 'planchada'],
  [[-16.2, 0, -15.5], 'bomba'],
  [[-6.5, 0, -17.5], 'piletas'],
  [[-12.5, 0, 0.5], 'carrier'],
  [[11, 0, 5], 'pozo-vecino'],
]

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => {
    const w = (window as any).__game
    return w?.getMission && w.getPosition && w.teleport && w.renderedBounds('sk575_mastil')
  }, null, { timeout: 90_000 })
  await page.waitForFunction(() => document.querySelector('[data-testid="hud"]'))
  await page.waitForTimeout(500)
})

// Teletransporta y espera ESTADO (no tiempo): el HUD muestra `at` (el reporter ya informó al motor en ese frame).
const go = async (page: Page, p: Vec, at: string | null) => {
  await g(page, 'teleport', p)
  await page.waitForFunction((want) => (window as any).__game.getAtSector() === want, at, { timeout: 15_000 })
}
const index = async (page: Page, i: number) =>
  page.waitForFunction((k) => (window as any).__game.getMission().objectiveIndex === k, i, { timeout: 15_000 })

async function start(page: Page, id: string) {
  await page.keyboard.press('KeyM')
  await page.getByTestId('mission-panel').locator(`[data-mission="${id}"]`).getByRole('button', { name: 'Iniciar' }).click()
  await page.waitForFunction((m) => (window as any).__game.getMission().missionId === m, id)
}

test('lista: las misiones 1 a 7 están, la 8 se omite y su motivo nunca se muestra', async ({ page }) => {
  await page.keyboard.press('KeyM')
  const panel = page.getByTestId('mission-panel')
  for (const n of [1, 2, 3, 4, 5, 6, 7]) await expect(panel.locator(`[data-mission^="m${n}-"]`)).toHaveCount(1)
  await expect(panel.locator('[data-mission^="m8-"]')).toHaveCount(0)
  const text = await panel.innerText()
  expect(text).not.toMatch(/no están en los datos vendorizados|25 ± 3|se inventan/)
  expect(text).not.toMatch(FORBIDDEN)
  expect(await page.getByTestId('hud').innerText()).not.toMatch(/no están en los datos vendorizados|25 ± 3/)
})

test('misión 1 de punta a punta: Acceso (salir y volver) y los 14 sectores', async ({ page }) => {
  await start(page, 'm1-reconocimiento')
  await expect(page.getByTestId('hud-objective')).toHaveText('Conducí hasta el Acceso a la locación')
  await go(page, ACCESO, 'acceso') // ya estaba en el Acceso al empezar: no cuenta
  expect((await g<{ objectiveIndex: number }>(page, 'getMission')).objectiveIndex).toBe(0)
  await go(page, AWAY, null)
  await go(page, ACCESO, 'acceso')
  await index(page, 1)
  await expect(page.getByTestId('hud-objective')).toHaveText('Visitá los 14 sectores')
  await go(page, AWAY, null) // para que el Acceso cuente también como sector del recorrido
  const tour: [Vec, string][] = [[ACCESO, 'acceso'], ...TOUR]
  for (const [i, [p, at]] of tour.entries()) {
    await go(page, p, at)
    if (i < tour.length - 1)
      await page.waitForFunction((n) => (window as any).__game.getMission().visited.length === n, i + 1, { timeout: 15_000 })
  }
  await page.waitForFunction(() => (window as any).__game.getMission().status === 'completed')
  await expect(page.getByTestId('mission-completed')).toBeVisible()
  expect(await page.getByTestId('mission-panel').innerText()).not.toMatch(FORBIDDEN)
})

test('misión 7: reordena con las flechas, el orden incorrecto reintenta y el correcto completa', async ({ page }) => {
  const expected = (JSON.parse(readFileSync('vendor/visor/secuencia.json', 'utf8')) as { pasos: { orden: number; texto: string }[] }).pasos
    .sort((a, b) => a.orden - b.orden)
    .map((p) => p.texto)
  await start(page, 'm7-orden-del-montaje')
  const controls = page.getByTestId('order-controls')
  await expect(controls).toBeVisible() // el panel se abre solo con un objetivo de orden
  const panelText = (await page.getByTestId('mission-panel').innerText()).toLowerCase()
  expect(panelText).toContain('pendiente de validación')
  expect(panelText).not.toMatch(/\b\d+\s*(min|minutos|horas|seg)\b/)

  await controls.getByRole('button', { name: 'Confirmar orden' }).click() // el orden inicial nunca es la solución
  await expect(controls.getByText('Probá de nuevo, sin penalización.')).toBeVisible()

  const rows = controls.locator('li')
  const texts = () => rows.locator('span').allInnerTexts()
  const before = await texts()
  expect(before.sort()).toEqual([...expected].sort())
  // flecha abajo en la primera fila y arriba en la segunda: vuelve a quedar igual (prueba ↑ y ↓)
  const first = (await texts())[0]
  await rows.nth(0).getByRole('button', { name: 'Bajar' }).click()
  expect((await texts())[1]).toBe(first)
  await rows.nth(1).getByRole('button', { name: 'Subir' }).click()
  expect((await texts())[0]).toBe(first)
  // ordena con Subir (selección)
  for (let i = 0; i < expected.length; i++) {
    let j = (await texts()).indexOf(expected[i])
    expect(j).toBeGreaterThanOrEqual(i)
    for (; j > i; j--) await rows.nth(j).getByRole('button', { name: 'Subir' }).click()
  }
  expect(await texts()).toEqual(expected)
  await controls.getByRole('button', { name: 'Confirmar orden' }).click()
  await expect(page.getByTestId('mission-completed')).toBeVisible()
  expect((await g<{ status: string }>(page, 'getMission')).status).toBe('completed')
})

test('misión 4: llegar al piso de enganche y autorregistrar; el resumen refleja lo marcado, sin calificar', async ({ page }) => {
  await start(page, 'm4-retencion-en-altura')
  await go(page, [1.2, 0, 3.4], 'bop') // en el suelo debajo del piso de enganche: cuenta el BOP, no el piso
  expect((await g<{ objectiveIndex: number }>(page, 'getMission')).objectiveIndex).toBe(0)
  await go(page, ENGANCHE, 'piso-enganche') // la subida por la escalera vertical se prueba en climb.e2e.ts
  await index(page, 1)
  const marks = page.getByTestId('mark-controls')
  await expect(marks).toBeVisible()
  const active = await page.getByTestId('mission-panel').innerText()
  expect(active).toContain('PE-3')
  expect(active).toContain('Primaria')
  await marks.getByRole('button', { name: 'OK', exact: true }).click()
  await expect(page.getByTestId('mark-controls')).toBeVisible()
  expect(await page.getByTestId('mission-panel').innerText()).toContain('PE-4')
  await page.getByTestId('mark-controls').getByRole('button', { name: 'NOK', exact: true }).click()
  const summary = page.getByTestId('mission-summary')
  await expect(summary).toBeVisible()
  const s = await summary.innerText()
  expect(s).toContain('PE-3: OK')
  expect(s).toContain('PE-4: NOK')
  expect(s).not.toMatch(FORBIDDEN)
})

test('misión 2: 8 preguntas; el resumen cuenta coincidencias sin calificar', async ({ page }) => {
  await start(page, 'm2-que-hace-cada-sector')
  for (let i = 0; i < 8; i++) {
    const c = page.getByTestId('choose-controls')
    await expect(c).toBeVisible()
    await c.locator('input[type="checkbox"]').first().check()
    await c.getByRole('button', { name: 'Confirmar' }).click() // una respuesta distinta de la referencia también avanza
  }
  const summary = page.getByTestId('mission-summary')
  await expect(summary).toBeVisible()
  const s = await summary.innerText()
  expect(s).toMatch(/\d de 8/)
  expect(s).toContain('Referencia de repaso: 6 de 8')
  expect(s).not.toMatch(FORBIDDEN)
})

test('misión 3: en boca de pozo se ve la Fuente en conflicto A2 Medio vs RCCO Alto', async ({ page }) => {
  await start(page, 'm3-mapa-de-zonas')
  await go(page, AWAY, null)
  // mástil, piso de enganche y BOP comparten planta: cada uno cuenta solo en su lugar (y el piso, a su altura)
  await go(page, MASTIL, 'mastil')
  await index(page, 1)
  await go(page, BOP, 'bop') // todavía pide el piso de enganche: el BOP no cuenta antes
  expect((await g<{ objectiveIndex: number }>(page, 'getMission')).objectiveIndex).toBe(1)
  await go(page, ENGANCHE, 'piso-enganche')
  await index(page, 2)
  await go(page, AWAY, null)
  await go(page, BOP, 'bop')
  await index(page, 3)
  await expect(page.getByTestId('hud-objective')).toContainText('Carrier')
  const list = await page.getByTestId('hud-objectives').innerText() // la lista muestra el texto de la boca de pozo
  expect(list).toContain('Fuente en conflicto')
  expect(list).toContain('Layout A2 Medio')
  expect(list).toContain('RCCO Alto')
  expect(list).not.toMatch(FORBIDDEN)
})
