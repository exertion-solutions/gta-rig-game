import type { Page } from '@playwright/test'

// Esperas por ESTADO de la simulación (ganchos DEV de window.__game), nunca por tiempo de reloj: con la máquina cargada
// un sleep fijo cubre menos pasos de física y el resultado del test cambia. Los pasos son fijos (1/60 s): `steps` cuenta
// los del jugador a pie y `truckSteps` los de la camioneta (corre siempre, también a pie).
type Counter = 'steps' | 'truckSteps'
const SAFETY = { timeout: 60_000 } // tope de seguridad: si se alcanza, la simulación está trabada (falla el test)

/** Espera `n` pasos de física (n / 60 s de simulación). */
export async function waitSteps(page: Page, n: number, counter: Counter = 'steps') {
  const s0 = await page.evaluate((c) => (window as any).__game[c]() as number, counter)
  await page.waitForFunction(([c, k]) => (window as any).__game[c]() >= k, [counter, s0 + n] as const, SAFETY)
}

/** Espera `n` cuadros dibujados (para lo que se actualiza en useFrame: cámara, clips, renderInfo). */
export const waitFrames = (page: Page, n: number) =>
  page.evaluate(async (k) => {
    for (let i = 0; i < k; i++) await new Promise((r) => requestAnimationFrame(r))
  }, n)

/** A pie: espera a que el jugador quede apoyado y quieto durante `still` pasos de física seguidos. */
export async function settle(page: Page, still = 5) {
  await page.evaluate(() => delete (window as any).__settle)
  await page.waitForFunction(
    (n) => {
      const w = window as any
      const g = w.__game
      const s = g.steps()
      const p = g.getPosition()
      const st = (w.__settle ??= { s, p, k: 0 })
      if (s === st.s) return false
      const moved = Math.hypot(p[0] - st.p[0], p[1] - st.p[1], p[2] - st.p[2])
      st.k = g.isGrounded() && moved < 1e-3 ? st.k + 1 : 0
      st.s = s
      st.p = p
      return st.k >= n
    },
    still,
    SAFETY,
  )
}

/** La camioneta quedó en (x, z) y quieta. */
export const truckParked = (page: Page, x: number, z: number) =>
  page.waitForFunction(
    ([px, pz]) => {
      const t = (window as any).__game.getTruck()
      return Math.hypot(t.position[0] - px, t.position[2] - pz) < 0.3 && Math.abs(t.speed) < 0.05
    },
    [x, z] as const,
    SAFETY,
  )
