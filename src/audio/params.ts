import { RUN_SPEED, WALK_SPEED } from '../game/player/movement'
import { TRUCK } from '../game/vehicle/truckModel'

/** Motor de la camioneta según la rapidez (m/s, también marcha atrás): tono (Hz) y volumen relativo. */
export function engineParams(speed: number, max: number = TRUCK.maxSpeed) {
  const r = Math.min(1, Math.abs(speed) / max)
  return { freq: 42 + 78 * r, gain: 0.3 + 0.5 * r }
}

const STEP_WALK = 0.55 // s entre pasos caminando (juego)
const STEP_RUN = 0.3 // s entre pasos corriendo

/** Segundos entre pasos para la rapidez horizontal (m/s); null = quieto (sin pasos). */
export function stepInterval(speed: number): number | null {
  if (speed < 0.3) return null
  const t = Math.min(1, Math.max(0, (speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED)))
  return STEP_WALK + (STEP_RUN - STEP_WALK) * t
}
