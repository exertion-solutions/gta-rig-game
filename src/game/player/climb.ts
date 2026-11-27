import type { LadderVolume, Vec3 } from '../world/walkable'

// Modo escalera (valores de juego, no medidas): velocidad de trepado, separación del cuerpo a los peldaños,
// distancia a la que se suelta arriba (sobre la plancha), alcance para engancharse y tolerancia de altura.
export const CLIMB_SPEED = 1.2 // m/s a lo largo de la escalera
const STANDOFF = 0.4
const TOP_RELEASE = 0.75
const REACH = 0.8 // E engancha
export const WALK_ON_REACH = 0.5 // W engancha solo pegado a la escalera (si no, caminar junto al mástil la tomaba)
const REACH_DY = 0.5

/** Progreso 0..1 a lo largo de la escalera; input +1 sube, −1 baja. */
export const climbStep = (progress: number, input: number, dt: number, length: number) =>
  Math.min(1, Math.max(0, progress + (input * CLIMB_SPEED * dt) / length))

export const ladderLength = (l: LadderVolume) => Math.hypot(l.top[0] - l.bottom[0], l.top[1] - l.bottom[1], l.top[2] - l.bottom[2])

// facing = yaw del que trepa (mira a los peldaños); "atrás" = lejos de la escalera.
const back = (l: LadderVolume, k: number): [number, number] => [Math.sin(l.facing) * k, Math.cos(l.facing) * k]

/** Pies del jugador colgado en `p` (línea de la escalera, separada STANDOFF hacia atrás). */
export function ladderFeet(l: LadderVolume, p: number): Vec3 {
  const [bx, bz] = back(l, STANDOFF)
  return [l.bottom[0] + (l.top[0] - l.bottom[0]) * p + bx, l.bottom[1] + (l.top[1] - l.bottom[1]) * p, l.bottom[2] + (l.top[2] - l.bottom[2]) * p + bz]
}

/** Dónde queda de pie al soltarse: abajo en el arranque, arriba sobre la plancha (alejado del reticulado). */
export function ladderRelease(l: LadderVolume, end: 'bottom' | 'top'): Vec3 {
  if (end === 'bottom') return ladderFeet(l, 0)
  const [bx, bz] = back(l, TOP_RELEASE)
  return [l.top[0] + bx, l.top[1], l.top[2] + bz]
}

/** Escalera y extremo al alcance de los pies del jugador (null = ninguna). */
export function ladderEndNear(feet: Vec3, ladders: readonly LadderVolume[], reach = REACH): { ladder: LadderVolume; end: 'bottom' | 'top' } | null {
  for (const ladder of ladders)
    for (const end of ['bottom', 'top'] as const) {
      const q = ladderRelease(ladder, end)
      if (Math.hypot(feet[0] - q[0], feet[2] - q[2]) <= reach && Math.abs(feet[1] - q[1]) <= REACH_DY) return { ladder, end }
    }
  return null
}
