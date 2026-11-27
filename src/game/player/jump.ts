// Salto a pie (Espacio). Valores de juego, no medidas: ápice = v²/2g ≈ 0,49 m. Acotado para que salto + autostep
// (0,3 m) quede por debajo de la baranda más baja (1,0 m): con 0,9 m el jugador subía a la baranda de la rampa y la saltaba.
export const GRAVITY = 9.81
export const JUMP = { velocity: 3.1, coyoteMs: 120 }
export const jumpApex = (v: number, g = GRAVITY) => (v * v) / (2 * g)

/** vy: velocidad vertical (m/s); airMs: tiempo desde el último paso apoyado (Infinity tras saltar: sin doble salto). */
export type VState = { vy: number; airMs: number }

/** Un paso fijo: `grounded` es el del paso anterior del controlador. */
export function stepVertical(s: VState, grounded: boolean, wantJump: boolean, dt: number): VState {
  let airMs = grounded ? 0 : s.airMs + dt * 1000
  let vy = grounded && s.vy < 0 ? 0 : s.vy
  if (wantJump && airMs <= JUMP.coyoteMs && vy <= 0) {
    vy = JUMP.velocity
    airMs = Infinity
  }
  return { vy: vy - GRAVITY * dt, airMs }
}
