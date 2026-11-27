import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import type { TraversalData } from '../../src/game/world/walkable'
import { waitFrames } from './wait'
import { standSpots } from '../reach'

// Task 18B: salto, escalera vertical, válvulas y objetivo `interact`. Espera estados (no tiempos fijos) con los ganchos DEV.
type Pos = [number, number, number]
const TRAVERSAL: TraversalData = JSON.parse(readFileSync('src/game/world/traversal.json', 'utf8'))
const PT = TRAVERSAL.platforms.find((p) => p.id === 'piso_trabajo')!.y
const PE = TRAVERSAL.platforms.find((p) => p.id === 'piso_enganche')!.y
const LADDER = TRAVERSAL.ladders.find((l) => l.id === 'mastil_escalera')!
const DISTANCE = /\d\s?(m|metros|mts)\b/i
// De pie al norte de M1, fuera de las cajas de los volantes (QA D-07) y del lado de la calle (z <= -9,4: la camioneta
// estacionada en z = -8 ocupa hasta z = -9).
const M1_SPOT = (): Pos => {
  const v = TRAVERSAL.interactables.find((x) => x.id === 'manifold_M1')!
  return standSpots(v as never).filter((p) => p[2] <= -9.4).sort((a, b) => b[2] - a[2])[0] as Pos
}

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

// Muestrea posición y clip en cada cuadro con pasos nuevos hasta que `done` se cumpla o pasen `maxSteps` pasos de física
// (tiempo de SIMULACIÓN, no de reloj: con la máquina cargada una ventana de 400 ms cubría menos pasos que el salto).
// En `done`, `n` = pasos desde el inicio del muestreo. Tope de reloj solo de seguridad (simulación trabada).
async function sample(page: Page, done: string, maxSteps = 2400) {
  return page.evaluate(
    async ([cond, max]) => {
      const w = (window as any).__game
      const f = new Function('w', 'n', `return (${cond})`) as (w: unknown, n: number) => boolean
      const out: { p: number[]; clip: string | null; anim: string | null; at: string | null }[] = []
      const s0 = w.steps()
      let last = -1
      const t0 = performance.now()
      while (performance.now() - t0 < 90_000) {
        const n = w.steps() - s0
        if (n !== last) {
          last = n
          out.push({ p: w.getPosition(), clip: w.currentClip(), anim: w.playingClip(), at: w.getAtSector() })
          if (f(w, n) || n >= (max as number)) break
        }
        await new Promise((r) => requestAnimationFrame(r))
      }
      return out
    },
    [done, maxSteps] as const,
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
  // un solo muestreo: subida y caída hasta volver a apoyar (antes dos ventanas por reloj; entre ellas se perdía el ápice)
  const all = await sample(page, 'n > 24 && w.isGrounded() && Math.abs(w.getPosition()[1]) < 0.02', 300)
  // ápice medido en el paso de física (hook DEV), no por muestreo de cuadros: con pocos FPS el muestreo perdía el ápice
  const js = await g<{ rise: number; cuts: unknown[] }>(page, 'jumpStats')
  console.log(`[salto] ascenso ${js.rise.toFixed(4)} m, muestreo ${Math.max(...all.map((s) => s.p[1])).toFixed(4)} m, cortes ${JSON.stringify(js.cuts)}`)
  expect(js.cuts).toEqual([]) // en salto libre nada corta la subida
  expect(js.rise).toBeGreaterThan(0.63) // ápice de juego v²/2g ≈ 0,68 m
  expect(js.rise).toBeLessThan(0.74)
  expect(all.some((s) => s.clip === 'jump')).toBe(true)
  expect(all.some((s) => s.anim === 'jump')).toBe(true) // clip propio en el mezclador, no la pose de 'idle'
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
  expect(up.some((s) => s.anim === 'climb')).toBe(true) // clip propio de trepar, no 'walk'
  // a mitad de camino no cuenta ningún piso
  const mid = up.find((s) => s.p[1] > 11 && s.p[1] < 13)
  expect(mid).toBeTruthy()
  expect(mid!.at).toBeNull()
  const top = await pos(page)
  expect(Math.abs(top[1] - PE)).toBeLessThan(0.06)
  await page.waitForFunction(() => (window as any).__game.getAtSector() === 'piso-enganche')
  // se queda: ni cae ni lo reubica el respawn (último punto firme = el piso de enganche)
  await sample(page, 'false', 120) // 2 s de simulación
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
  await sample(page, 'false', 36) // 0,6 s de simulación
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
  await page.getByTestId('mission-panel').locator('[data-mission="dev-valvula"]').getByRole('button', { name: 'Iniciar' }).click() // Iniciar ya cierra el panel (Esc sin nada abierto abre la pausa)
  await expect(page.getByTestId('hud-objective')).toHaveText('Operá la válvula M1 del manifold')
  const v = TRAVERSAL.interactables.find((x) => x.id === 'manifold_M1')!
  await place(page, M1_SPOT(), 0)
  await page.waitForFunction(() => (window as any).__game.nearInteractable() === 'manifold_M1')
  const prompt = page.getByTestId('interact-prompt')
  await expect(prompt).toContainText('E: operar')
  await expect(prompt).toContainText('ilustrativo: no es un procedimiento')
  await expect(prompt.getByTestId('valve-state')).toHaveText('Registro propio: sin operar')
  expect(await prompt.innerText()).not.toMatch(DISTANCE)
  // D-14: válvulas juntas; el aro ámbar marca en la escena la que opera E (centrado en su volante)
  await waitFrames(page, 2)
  const hl = (await g<{ min: number[]; max: number[] }>(page, 'renderedBounds', 'valvula_al_alcance'))!
  expect(Math.abs((hl.min[0] + hl.max[0]) / 2 - v.position[0])).toBeLessThan(0.05)
  expect(Math.abs((hl.min[2] + hl.max[2]) / 2 - v.position[2])).toBeLessThan(0.05)
  // con el panel abierto E no opera
  await page.keyboard.press('KeyM')
  await page.keyboard.press('KeyE')
  await page.keyboard.press('Escape')
  expect(await g(page, 'valveState', 'manifold_M1')).toBeNull()
  await page.keyboard.press('KeyE')
  await page.waitForFunction(() => (window as any).__game.valveState('manifold_M1') === 'open')
  const tr = await sample(page, "w.currentClip() === 'operate'", 180)
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
  const tr = await sample(page, 'n > 24 && w.isGrounded() && w.getPosition()[1] < ' + (PE + 0.02), 300)
  expect(Math.max(...tr.map((s) => s.p[1]))).toBeGreaterThan(PE + 0.25)
  await sample(page, 'false', 30) // 0,5 s de simulación
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
    tr2.push(...(await sample(page, 'false', 42))) // 0,7 s de simulación
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
  await expect(page.getByTestId('interact-prompt')).toContainText('E soltar la escalera') // en el extremo, E la suelta
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
  await expect(page.getByTestId('interact-prompt')).toContainText('W/S subir o bajar')
  await expect(page.getByTestId('interact-prompt')).not.toContainText('soltar') // a mitad de la escalera E no suelta
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
  await place(page, M1_SPOT(), 0)
  await page.waitForFunction(() => (window as any).__game.nearInteractable() === 'manifold_M1')
  const prompt = page.getByTestId('interact-prompt')
  await expect(prompt).toContainText('E subir a la camioneta') // E es de la camioneta y el aviso lo dice
  await expect(prompt).not.toContainText('operar')
  await page.keyboard.press('KeyE')
  await page.waitForFunction(() => (window as any).__game.getMode() === 'truck')
  await expect(prompt).toContainText('E bajar de la camioneta')
  expect(await g(page, 'valveState', 'manifold_M1')).toBeNull()
})

// QA D-10: saltar repetido contra la esquina mástil/baranda del piso de trabajo dejaba al jugador parado en el aire
// (salto + autostep = 0,78 m sobre el piso) o flotando con el clip de salto.
test('salto repetido contra una esquina: no trepa la esquina ni queda flotando, vuelve a apoyarse en el piso', async ({ page }) => {
  await place(page, [-0.5, PT, -1.4], Math.PI / 2)
  await g(page, 'setInput', { x: 0, z: 1, run: true })
  let top = 0
  for (let i = 0; i < 10; i++) {
    await g(page, 'jump')
    const tr = await sample(page, 'n >= 24', 30) // 0,4 s de simulación entre saltos
    top = Math.max(top, ...tr.map((s) => s.p[1]))
  }
  await g(page, 'setInput', null)
  const tr = await sample(page, 'n >= 90', 100) // 1,5 s de simulación sin teclas
  top = Math.max(top, ...tr.map((s) => s.p[1]))
  expect(top).toBeLessThan(PT + 0.8) // el ápice de un salto (≈ 0,68 m), nunca encima de la esquina
  expect(await g(page, 'isGrounded')).toBe(true)
  const y = (await pos(page))[1]
  expect(y).toBeGreaterThan(PT - 0.06) // sigue sobre el piso de trabajo
  expect(y).toBeLessThan(PT + 0.08)
  expect(await g(page, 'currentClip')).not.toBe('jump')
})
