import type { Vec3 } from '../player/movement'
import { usePlayerStore } from '../player/store'

// Radio de interacción de juego: nunca se muestra en pantalla.
export const ENTER_RADIUS = 2.5
const EXIT_DISTANCE = 2.2 // del centro de la camioneta al costado donde baja el jugador

// Desnivel máximo pies del jugador <-> suelo de la camioneta: la altura del jugador (cápsula 2·0,55 + 2·0,35 = 1,8 m,
// Player.tsx). Más que eso (piso de trabajo 3,61, piso de enganche 20,65) no se alcanza la puerta aunque esté "debajo" en planta.
export const ENTER_DY = 1.8

export const canEnter = (player: Vec3, truck: Vec3, radius = ENTER_RADIUS) =>
  Math.hypot(player[0] - truck[0], player[2] - truck[2]) <= radius && Math.abs(player[1] - truck[1]) <= ENTER_DY

/** E es de la camioneta solo a pie, sin estar colgado de una escalera, y con la camioneta al alcance (lo usan Truck, Player y el aviso). */
export const eBelongsToTruck = (s: { mode: 'foot' | 'truck'; climbing: boolean; position: Vec3; truck: { position: Vec3 } }) =>
  s.mode === 'truck' || (!s.climbing && canEnter(s.position, s.truck.position))

// Primer lugar libre: izquierda (puerta del conductor), derecha, atrás, adelante. null si no hay.
export function exitSpot(truck: Vec3, heading: number, isFree: (p: Vec3) => boolean = () => true): Vec3 | null {
  const f: [number, number] = [-Math.sin(heading), -Math.cos(heading)] // adelante (yaw 0 mira a -Z)
  const r: [number, number] = [Math.cos(heading), -Math.sin(heading)] // derecha
  const at = (a: [number, number], k: number): Vec3 => [truck[0] + a[0] * k, truck[1], truck[2] + a[1] * k]
  const candidates = [at(r, -EXIT_DISTANCE), at(r, EXIT_DISTANCE), at(f, -(EXIT_DISTANCE + 1)), at(f, EXIT_DISTANCE + 1)]
  return candidates.find(isFree) ?? null
}

// Tecla E: sube si la camioneta está cerca, baja si se está conduciendo. true si cambió el modo.
export function toggleMode(isFree?: (p: Vec3) => boolean): boolean {
  const s = usePlayerStore.getState()
  if (s.mode === 'foot') {
    if (!eBelongsToTruck(s)) return false
    usePlayerStore.setState({ mode: 'truck', position: s.truck.position })
    return true
  }
  const spot = exitSpot(s.truck.position, s.truck.heading, isFree)
  if (!spot) return false
  usePlayerStore.setState({ mode: 'foot', position: spot })
  return true
}
