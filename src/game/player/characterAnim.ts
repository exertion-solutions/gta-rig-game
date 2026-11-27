import { RUN_SPEED, WALK_SPEED } from './movement'

export type Clip = 'idle' | 'walk' | 'run' | 'seated' | 'jump' | 'land' | 'climb' | 'operate' | 'crouch'
export type Action = { climbing?: boolean; operating?: boolean; airborne?: boolean; landing?: boolean; crouching?: boolean }

export const LAND_MS = 300 // agachado de aterrizaje tras tocar el suelo (clip 'land', poseClips.ts)
const IDLE_BELOW = WALK_SPEED / 2 // por debajo de media caminata: quieto (absorbe el ruido del controlador)
const RUN_ABOVE = (WALK_SPEED + RUN_SPEED) / 2

// El modelo no trae clip sentado: en la camioneta el personaje se oculta y queda en 'idle'.
// Acciones: trepar > operar > en el aire (tras un salto) > aterrizando (justo al tocar el suelo) > velocidad.
export function pickClip(speed: number, mode: 'foot' | 'truck', a: Action = {}): Clip {
  if (mode === 'truck') return 'idle'
  if (a.climbing) return 'climb'
  if (a.operating) return 'operate'
  if (a.airborne) return 'jump'
  if (a.landing) return 'land'
  if (a.crouching) return 'crouch' // pose fija: sin ciclo de caminar agachado, mueve los pies pero no patina el torso
  if (speed < IDLE_BELOW) return 'idle'
  return speed > RUN_ABOVE ? 'run' : 'walk'
}

/** Fin del aterrizaje (ms): arranca solo en el paso de en-el-aire a apoyado, así el salto largo no aterriza en el aire. */
export const nextLandUntil = (wasAirborne: boolean, airborne: boolean, now: number, until: number) =>
  wasAirborne && !airborne ? now + LAND_MS : until
