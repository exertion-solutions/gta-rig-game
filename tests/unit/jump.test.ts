import { describe, expect, it } from 'vitest'
import { GRAVITY, JUMP, stepVertical, type VState } from '../../src/game/player/jump'

const jumpApex = (v: number) => (v * v) / (2 * GRAVITY) // oráculo: ápice balístico
import { STEP_MAX } from '../../src/game/player/movement'

const DT = 1 / 60
// Suelo plano en y = 0: integra el estado vertical como lo hace Player (grounded del paso anterior).
function simulate(steps: number, jumpAt: (i: number) => boolean, startY = 0, startGrounded = true) {
  let s: VState = { vy: 0, airMs: 0 }
  let y = startY
  let grounded = startGrounded
  let apex = y
  const ys: number[] = []
  for (let i = 0; i < steps; i++) {
    s = stepVertical(s, grounded, jumpAt(i), DT)
    y += s.vy * DT
    if (y <= 0) {
      y = 0
      grounded = true
    } else grounded = false
    apex = Math.max(apex, y)
    ys.push(y)
  }
  return { apex, y, ys }
}

describe('salto', () => {
  it('altura de ápice = v²/2g (valor de juego)', () => expect(jumpApex(JUMP.velocity)).toBeCloseTo((JUMP.velocity ** 2) / (2 * GRAVITY)))
  it('salto + autostep queda por debajo de la baranda más baja (1,0 m)', () => expect(jumpApex(JUMP.velocity) + STEP_MAX).toBeLessThan(1.0))
  it('sube hasta el ápice y vuelve a y = 0', () => {
    const r = simulate(180, (i) => i === 1)
    expect(r.apex).toBeGreaterThan(jumpApex(JUMP.velocity) * 0.93)
    expect(r.apex).toBeLessThan(jumpApex(JUMP.velocity) * 1.02)
    expect(r.y).toBe(0)
  })
  it('sin pedir salto no despega', () => expect(simulate(60, () => false).apex).toBe(0))
  it('mantener la tecla no encadena saltos en el aire', () => {
    const r = simulate(30, () => true)
    expect(r.apex).toBeLessThan(jumpApex(JUMP.velocity) * 1.02)
  })
  it('coyote: se puede saltar poco después de dejar el suelo, no mucho después', () => {
    const fall = (afterMs: number) => {
      let s: VState = { vy: 0, airMs: 0 }
      const n = Math.round(afterMs / 1000 / DT)
      for (let i = 0; i < n; i++) s = stepVertical(s, false, false, DT)
      return stepVertical(s, false, true, DT).vy > 0
    }
    expect(fall(JUMP.coyoteMs / 2)).toBe(true)
    expect(fall(JUMP.coyoteMs * 2)).toBe(false)
  })
})
