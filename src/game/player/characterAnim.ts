import { RUN_SPEED, WALK_SPEED } from './movement'

export type Clip = 'idle' | 'walk' | 'run' | 'seated'

const IDLE_BELOW = WALK_SPEED / 2 // por debajo de media caminata: quieto (absorbe el ruido del controlador)
const RUN_ABOVE = (WALK_SPEED + RUN_SPEED) / 2

// El modelo no trae clip sentado: en la camioneta el personaje se oculta y queda en 'idle'.
export function pickClip(speed: number, mode: 'foot' | 'truck'): Clip {
  if (mode === 'truck' || speed < IDLE_BELOW) return 'idle'
  return speed > RUN_ABOVE ? 'run' : 'walk'
}
