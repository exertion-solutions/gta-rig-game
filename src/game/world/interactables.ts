import { create } from 'zustand'
import type { ValveState } from '../missions/types'
import type { Interactable, Vec3 } from './walkable'

// Alcance de juego para operar (no se muestra en pantalla).
export const INTERACT_REACH = 1.5

/** Interactuable más cercano (distancia 3D) dentro del alcance; la tapada detrás de otra queda más lejos y no gana. */
export function nearestInteractable(player: Vec3, list: readonly Interactable[], reach = INTERACT_REACH): Interactable | null {
  let best: Interactable | null = null
  let bd = reach
  for (const it of list) {
    const d = Math.hypot(player[0] - it.position[0], player[1] - it.position[1], player[2] - it.position[2])
    if (d <= bd) [best, bd] = [it, d]
  }
  return best
}

// Ninguna fuente documenta estados: sin registro previo, la primera operación registra 'open' (convención del juego).
export const nextValveState = (s: ValveState | undefined): ValveState => (s === 'open' ? 'closed' : 'open')

type ValveStore = {
  /** Registro propio del jugador (ilustrativo: no simula flujo ni presión). */
  states: Record<string, ValveState>
  /** Vueltas visuales del volante (sube en cada operación). */
  turns: Record<string, number>
  /** Interactuable al alcance ahora (para el aviso "E: operar"). */
  near: string | null
  /** Extremo de escalera al alcance ahora (aviso de subir/bajar). */
  ladder: 'bottom' | 'top' | null
  operate: (id: string) => ValveState
}

export const useValveStore = create<ValveStore>((set, get) => ({
  states: {},
  turns: {},
  near: null,
  ladder: null,
  operate(id) {
    const state = nextValveState(get().states[id])
    set((s) => ({ states: { ...s.states, [id]: state }, turns: { ...s.turns, [id]: (s.turns[id] ?? 0) + 1 } }))
    return state
  },
}))
