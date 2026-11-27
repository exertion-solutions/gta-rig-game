import { RUN_SPEED, WALK_SPEED } from './movement'

export type Clip = 'idle' | 'walk' | 'run' | 'seated' | 'jump' | 'climb' | 'operate'
export type Action = { climbing?: boolean; operating?: boolean; airborne?: boolean }

const IDLE_BELOW = WALK_SPEED / 2 // por debajo de media caminata: quieto (absorbe el ruido del controlador)
const RUN_ABOVE = (WALK_SPEED + RUN_SPEED) / 2

// El modelo no trae clip sentado: en la camioneta el personaje se oculta y queda en 'idle'.
// Acciones: trepar > operar > en el aire (tras un salto) > velocidad.
export function pickClip(speed: number, mode: 'foot' | 'truck', a: Action = {}): Clip {
  if (mode === 'truck') return 'idle'
  if (a.climbing) return 'climb'
  if (a.operating) return 'operate'
  if (a.airborne) return 'jump'
  if (speed < IDLE_BELOW) return 'idle'
  return speed > RUN_ABOVE ? 'run' : 'walk'
}
