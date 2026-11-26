import type { Vec3 } from '../game/data/sectors'

/**
 * Mundo -> píxeles del radar circular (size x size), con el jugador en el centro y el frente de la cámara arriba.
 * Convención del juego: yaw 0 mira a -Z; el frente es (-sin yaw, -cos yaw) y la derecha (cos yaw, -sin yaw).
 * Fuera de rangeM: inside=false y el punto queda sobre el borde del círculo, en la misma dirección.
 */
export function projectToRadar(world: Vec3, center: Vec3, yaw: number, rangeM: number, sizePx: number) {
  const dx = world[0] - center[0]
  const dz = world[2] - center[2]
  const s = Math.sin(yaw)
  const c = Math.cos(yaw)
  const right = dx * c - dz * s
  const fwd = -dx * s - dz * c
  const r = sizePx / 2
  const d = Math.hypot(right, fwd)
  const k = d > rangeM ? rangeM / d : 1
  return { x: r + ((right * k) / rangeM) * r, y: r - ((fwd * k) / rangeM) * r, inside: d <= rangeM }
}
