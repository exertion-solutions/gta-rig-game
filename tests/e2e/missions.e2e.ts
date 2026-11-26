import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

type Vec = [number, number, number]
const FORBIDDEN = /aprob|habilit|certific/i
const g = <T>(page: Page, fn: string, ...a: unknown[]) =>
  page.evaluate(([f, args]) => (window as any).__game[f as string](...(args as unknown[])) as T, [fn, a] as const)

// Posiciones de los sectores (viewpoints.json, marco del juego). Varios comparten planta: en (0,0) están BOP, piso de trabajo, llave, piso de enganche y mástil.
const AWAY: Vec = [-10, 0, 20]
const ACCESO: Vec = [-26, 0, -24]
const CENTRO: Vec = [0, 0, 0]
const TOUR: Vec[] = [
  [-20.5, 0, 4.6], // acumulador
  [6.2, 0, -11.2], // manifold
  CENTRO, // bop, piso de trabajo, llave, piso de enganche, mástil
  [-6.3, 0, 0], // cuadro
  [8, 0, -1], // planchada
  [-16.2, 0, -15.5], // bomba
  [-6.5, 0, -17.5], // piletas
  [-12.5, 0, 0.5], // carrier
  [11, 0, 5], // pozo vecino
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

const go = async (page: Page, p: Vec) => {
  await g(page, 'teleport', p)
  await page.waitForTimeout(250) // el reporter informa el sector en el frame siguiente
}

async function start(page: Page, id: string) {
  await page.keyboard.press('KeyM')
  await page.getByTestId('mission-panel').locator(`[data-mission="${id}"]`).getByRole('button', { name: 'Iniciar' }).click()
  await page.waitForTimeout(500) // el reporter informa "estás en el Acceso" antes de que cuente una llegada
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
  await go(page, ACCESO) // ya estaba en el Acceso al empezar: no cuenta
  expect((await g<{ objectiveIndex: number }>(page, 'getMission')).objectiveIndex).toBe(0)
  await go(page, AWAY)
  await go(page, ACCESO)
  await expect(page.getByTestId('hud-objective')).toHaveText('Visitá los 14 sectores')
  await go(page, AWAY) // para que el Acceso cuente también como sector del recorrido
  for (const p of [ACCESO, ...TOUR]) await go(page, p)
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
  await go(page, AWAY)
  await go(page, CENTRO)
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
  await go(page, AWAY)
  await go(page, CENTRO) // mástil, piso de enganche y BOP comparten planta: los tres cuentan
  await expect(page.getByTestId('hud-objective')).toContainText('Carrier')
  expect((await g<{ objectiveIndex: number }>(page, 'getMission')).objectiveIndex).toBe(3)
  const list = await page.getByTestId('hud-objectives').innerText() // la lista muestra el texto de la boca de pozo
  expect(list).toContain('Fuente en conflicto')
  expect(list).toContain('Layout A2 Medio')
  expect(list).toContain('RCCO Alto')
  expect(list).not.toMatch(FORBIDDEN)
})
