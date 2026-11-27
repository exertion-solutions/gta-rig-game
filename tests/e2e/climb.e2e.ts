import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import type { TraversalData } from '../../src/game/world/walkable'

// Task 18B: salto, escalera vertical, válvulas y objetivo `interact`. Espera estados (no tiempos fijos) con los ganchos DEV.
type Pos = [number, number, number]
const TRAVERSAL: TraversalData = JSON.parse(readFileSync('src/game/world/traversal.json', 'utf8'))
const PT = TRAVERSAL.platforms.find((p) => p.id === 'piso_trabajo')!.y
const PE = TRAVERSAL.platforms.find((p) => p.id === 'piso_enganche')!.y
const LADDER = TRAVERSAL.ladders.find((l) => l.id === 'mastil_escalera')!
const DISTANCE = /\d\s?(m|metros|mts)\b/i

const g = <T,>(page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(([f, a]) => (window as any).__game[f as string](...(a as unknown[])), [fn, args] as const) as Promise<T>
const pos = (page: Page) => g<Pos>(page, 'getPosition')

async function place(page: Page, p: Pos, yaw: number) {
  const n = await page.evaluate(([q, y]) => {
    const w = (window as any).__game
    w.setInput(null)
    w.setYaw(y)
    w.teleport(q)
    return w.steps()
  }, [p, yaw] as const)
  // espera pasos de física reales (la escena puede seguir cargando) y que quede apoyado
  await page.waitForFunction((k) => (window as any).__game.steps() > k + 10 && (window as any).__game.isGrounded(), n, { timeout: 60_000 })
}

// Muestrea posición y clip hasta que `done` se cumpla en el navegador (sin esperas fijas).
async function sample(page: Page, done: string, maxMs = 40_000) {
  return page.evaluate(
    async ([cond, max]) => {
      const w = (window as any).__game
      const f = new Function('w', `return (${cond})`) as (w: unknown) => boolean
      const out: { p: number[]; clip: string | null; at: string | null }[] = []
      const t0 = performance.now()
      while (performance.now() - t0 < (max as number)) {
        out.push({ p: w.getPosition(), clip: w.currentClip(), at: w.getAtSector() })
        if (f(w)) break
        await new Promise((r) => setTimeout(r, 50))
      }
      return out
    },
    [done, maxMs] as const,
  )
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => {
      const w = (window as any).__game
      return w?.getPosition && w.jump && w.climbState && w.renderedBounds?.('sk575_mastil') && w.getMission && w.currentClip?.()
    },
    null,
    { timeout: 90_000 },
  )
  await page.waitForFunction(() => document.querySelector('[data-testid="hud"]'))
})

test('salto con Espacio: sube (clip jump) y vuelve a y = 0', async ({ page }) => {
  await place(page, [-26, 0, -28], 0) // suelo libre junto al Acceso (lejos de la camioneta)
  const y0 = (await pos(page))[1]
  expect(Math.abs(y0)).toBeLessThan(0.05)
  await page.keyboard.press('Space')
  const tr = await sample(page, 'false', 400) // 0,4 s de ascenso
  const rest = await sample(page, 'w.isGrounded() && Math.abs(w.getPosition()[1]) < 0.02', 5000)
  const all = [...tr, ...rest]
  const apex = Math.max(...all.map((s) => s.p[1]))
  expect(apex).toBeGreaterThan(0.35) // ápice de juego ≈ 0,49 m
  expect(apex).toBeLessThan(0.7)
  expect(all.some((s) => s.clip === 'jump')).toBe(true)
  expect(Math.abs((await pos(page))[1])).toBeLessThan(0.05)
})

test('escalera vertical A3: sube al piso de enganche, se queda (sin reubicar), cuenta el sector y vuelve a bajar', async ({ page }) => {
  const bottom: Pos = [LADDER.bottom[0] + 0.4 * Math.sin(LADDER.facing), PT, LADDER.bottom[2] + 0.4 * Math.cos(LADDER.facing)]
  await place(page, bottom, LADDER.facing)
  await expect(page.getByTestId('interact-prompt')).toContainText('subir por la escalera')
  await page.keyboard.press('KeyE')
  await page.waitForFunction(() => (window as any).__game.climbState() !== null)
  await g(page, 'setInput', { x: 0, z: 1, run: false })
  const up = await sample(page, 'w.climbState() === null')
  await g(page, 'setInput', null)
  expect(up.some((s) => s.clip === 'climb')).toBe(true)
  // a mitad de camino no cuenta ningún piso
  const mid = up.find((s) => s.p[1] > 11 && s.p[1] < 13)
  expect(mid).toBeTruthy()
  expect(mid!.at).toBeNull()
  const top = await pos(page)
  expect(Math.abs(top[1] - PE)).toBeLessThan(0.06)
  await page.waitForFunction(() => (window as any).__game.getAtSector() === 'piso-enganche')
  // se queda: ni cae ni lo reubica el respawn (último punto firme = el piso de enganche)
  await sample(page, 'false', 2000)
  const later = await pos(page)
  expect(Math.abs(later[1] - PE)).toBeLessThan(0.06)
  expect(Math.abs((await g<Pos>(page, 'lastSafe'))[1] - PE)).toBeLessThan(0.06)
  // baja
  await expect(page.getByTestId('interact-prompt')).toContainText('bajar por la escalera')
  await page.keyboard.press('KeyE')
  await page.waitForFunction(() => (window as any).__game.climbState()?.progress === 1)
  await g(page, 'setInput', { x: 0, z: -1, run: false })
  await sample(page, 'w.climbState() === null')
  await g(page, 'setInput', null)
  await page.waitForFunction(() => (window as any).__game.isGrounded())
  expect(Math.abs((await pos(page))[1] - PT)).toBeLessThan(0.06)
  expect(await page.getByTestId('hud').innerText()).not.toMatch(DISTANCE)
})

test('de pie en el suelo debajo del piso de enganche y del piso de trabajo no cuenta haberlos visitado', async ({ page }) => {
  await place(page, [1.2, 0, 3.4], 0) // suelo, dentro del radio horizontal de ambos pisos elevados
  await sample(page, 'false', 600)
  const at = await g<string | null>(page, 'getAtSector')
  expect(at).not.toBe('piso-enganche')
  expect(at).not.toBe('piso-trabajo')
  expect(at).not.toBe('llave')
  // sobre el piso de trabajo sí cuenta el piso de trabajo (y no el de enganche)
  await place(page, [-0.6, PT, 1.5], 0)
  await page.waitForFunction(() => ['piso-trabajo', 'llave'].includes((window as any).__game.getAtSector()))
})

test('válvula M1 del manifold: aviso sin distancias, E alterna el registro, clip operate y avanza el objetivo interact (DEV)', async ({ page }) => {
  await page.keyboard.press('KeyM')
  await page.getByTestId('mission-panel').locator('[data-mission="dev-valvula"]').getByRole('button', { name: 'Iniciar' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('hud-objective')).toHaveText('Operá la válvula M1 del manifold')
  const v = TRAVERSAL.interactables.find((x) => x.id === 'manifold_M1')!
  await place(page, [v.position[0], 0, v.position[2] + 0.2], 0)
  await page.waitForFunction(() => (window as any).__game.nearInteractable() === 'manifold_M1')
  const prompt = page.getByTestId('interact-prompt')
  await expect(prompt).toContainText('E: operar')
  await expect(prompt).toContainText('ilustrativo: no es un procedimiento')
  await expect(prompt.getByTestId('valve-state')).toHaveText('Registro propio: sin operar')
  expect(await prompt.innerText()).not.toMatch(DISTANCE)
  // con el panel abierto E no opera
  await page.keyboard.press('KeyM')
  await page.keyboard.press('KeyE')
  await page.keyboard.press('Escape')
  expect(await g(page, 'valveState', 'manifold_M1')).toBeNull()
  await page.keyboard.press('KeyE')
  await page.waitForFunction(() => (window as any).__game.valveState('manifold_M1') === 'open')
  const tr = await sample(page, "w.currentClip() === 'operate'", 3000)
  expect(tr[tr.length - 1].clip).toBe('operate')
  await page.waitForFunction(() => (window as any).__game.getMission().status === 'completed')
  await expect(page.getByTestId('mission-panel')).toContainText('Registro propio: abierta')
  await page.keyboard.press('Escape')
  await page.keyboard.press('KeyE')
  await page.waitForFunction(() => (window as any).__game.valveState('manifold_M1') === 'closed')
  await expect(prompt.getByTestId('valve-state')).toHaveText('Registro propio: cerrada')
  expect(await page.locator('body').innerText()).not.toMatch(/aprob|habilit|certific/i)
})

test('losas finas sin CCD: saltar sobre la plancha del piso de enganche (0,08 m) y contra la baranda de la rampa (0,05 m) no las atraviesa', async ({ page }) => {
  await place(page, [1.0, PE, 0], 0)
  await page.keyboard.press('Space')
  const tr = await sample(page, 'false', 400)
  const rest = await sample(page, 'w.isGrounded() && w.getPosition()[1] < ' + (PE + 0.02), 5000)
  expect(Math.max(...[...tr, ...rest].map((s) => s.p[1]))).toBeGreaterThan(PE + 0.25)
  await sample(page, 'false', 500)
  expect(Math.abs((await pos(page))[1] - PE)).toBeLessThan(0.06) // aterrizó sobre la plancha, no la cruzó
  // rampa de la V: saltando y caminando hacia la baranda añadida (+Z) queda del lado de adentro
  const rail = TRAVERSAL.rails.find((r) => r.id.includes('rampa') && r.a[2] > 0)!
  const ramp = TRAVERSAL.ramps[0]
  const x = (ramp.bottom[0] + ramp.top[0]) / 2
  const y = (ramp.bottom[1] + ramp.top[1]) / 2
  await place(page, [x, y + 0.05, 0], Math.PI) // mira a +Z
  await g(page, 'setInput', { x: 0, z: 1, run: true })
  const tr2: { p: number[] }[] = []
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Space')
    tr2.push(...(await sample(page, 'false', 700)))
  }
  expect(Math.max(...tr2.map((s) => s.p[2]))).toBeLessThan(rail.a[2]) // en ningún momento cruzó
  await g(page, 'setInput', null)
  const end = await pos(page)
  expect(end[2]).toBeLessThan(rail.a[2]) // no cruzó la baranda
  expect(end[1]).toBeGreaterThan(1) // sigue sobre la rampa, no cayó debajo
})

// E tiene un solo dueño: la camioneta solo si está al alcance en planta Y en altura (canEnter) y el jugador no trepa.
async function parkTruck(page: Page, p: Pos, heading: number) {
  await g(page, 'teleportTruck', p, heading)
  await page.waitForFunction(([x, z]) => {
    const t = (window as any).__game.getTruck()
    return Math.hypot(t.position[0] - x, t.position[2] - z) < 0.3 && Math.abs(t.speed) < 0.05
  }, [p[0], p[2]] as const, { timeout: 20_000 })
}

test('E con la camioneta abajo en planta: desde el piso de enganche baja por la escalera, no sube a la camioneta', async ({ page }) => {
  const top: Pos = [LADDER.top[0] + 0.75 * Math.sin(LADDER.facing), PE, LADDER.top[2] + 0.75 * Math.cos(LADDER.facing)]
  await parkTruck(page, [3.0, 0, -1.0], 0)
  const t = (await g<{ position: Pos }>(page, 'getTruck')).position
  expect(Math.hypot(t[0] - top[0], t[2] - top[2])).toBeLessThan(2.5) // al alcance en planta (la regla vieja subía)
  await place(page, top, LADDER.facing + Math.PI)
  await expect(page.getByTestId('interact-prompt')).toContainText('bajar por la escalera')
  await page.keyboard.press('KeyE')
  await page.waitForFunction(() => (window as any).__game.climbState()?.progress === 1)
  expect(await g(page, 'getMode')).toBe('foot')
  // colgado: el aviso pasa a W/S y E sigue sin ser de la camioneta
  await expect(page.getByTestId('interact-prompt')).toContainText('W/S subir o bajar')
  await page.keyboard.press('KeyE') // en el extremo de arriba E lo vuelve a soltar sobre la plancha
  await page.waitForFunction(() => (window as any).__game.climbState() === null)
  expect(await g(page, 'getMode')).toBe('foot')
  expect(Math.abs((await pos(page))[1] - PE)).toBeLessThan(0.06)
})

test('bajar de la camioneta nunca vuelve a colgar al jugador de la escalera (cambio de modo forzado mientras trepa)', async ({ page }) => {
  await parkTruck(page, [3.0, 0, -1.0], 0)
  const bottom: Pos = [LADDER.bottom[0] + 0.4 * Math.sin(LADDER.facing), PT, LADDER.bottom[2] + 0.4 * Math.cos(LADDER.facing)]
  await place(page, bottom, LADDER.facing)
  await page.keyboard.press('KeyE')
  await page.waitForFunction(() => (window as any).__game.climbState() !== null)
  await g(page, 'setInput', { x: 0, z: 1, run: false })
  await page.waitForFunction(() => (window as any).__game.getPosition()[1] > 6)
  await g(page, 'setInput', null)
  await g(page, 'forceMode', 'truck')
  await page.waitForFunction(() => (window as any).__game.getMode() === 'truck')
  await g(page, 'forceMode', 'foot')
  await page.waitForFunction(() => (window as any).__game.getMode() === 'foot')
  const n = await g<number>(page, 'steps')
  await page.waitForFunction((k) => (window as any).__game.steps() > k + 30, n)
  expect(await g(page, 'climbState')).toBeNull()
  expect((await pos(page))[1]).toBeLessThan(2) // quedó junto a la camioneta, no en la escalera
})

test('válvula con la camioneta al alcance: no se ofrece "E: operar" y E sube a la camioneta', async ({ page }) => {
  const v = TRAVERSAL.interactables.find((x) => x.id === 'manifold_M1')!
  await parkTruck(page, [v.position[0], 0, -8.0], -Math.PI / 2)
  await place(page, [v.position[0], 0, v.position[2] + 0.2], 0)
  await page.waitForFunction(() => (window as any).__game.nearInteractable() === 'manifold_M1')
  await expect(page.getByTestId('interact-prompt')).toHaveCount(0)
  await page.keyboard.press('KeyE')
  await page.waitForFunction(() => (window as any).__game.getMode() === 'truck')
  expect(await g(page, 'valveState', 'manifold_M1')).toBeNull()
})
