export type Vec3 = [number, number, number]
export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number }

export const WALK_SPEED = 1.4
export const RUN_SPEED = 4.5
export const PLAYER_RADIUS = 0.35
export const EYE_HEIGHT = 1.7

// PROVISIONAL: punto de reaparición en el acceso de la locación (borde -X, frente al carrier).
// Task 7 lo reemplaza por el Acceso de `sectors`.
export const RESPAWN: Vec3 = [-35, 0, 0]

// input.x = strafe (+ derecha), input.z = avance (+ adelante). yaw 0 mira hacia -Z (convención three).
// Devuelve velocidad en el plano XZ del mundo (m/s). dt se acepta por contrato; sin rampa de aceleración.
export function stepMovement(input: { x: number; z: number; run: boolean }, yaw: number, _dt: number) {
  const len = Math.hypot(input.x, input.z)
  if (len === 0) return { vx: 0, vz: 0 }
  const speed = input.run ? RUN_SPEED : WALK_SPEED
  const x = input.x / len
  const z = input.z / len
  const s = Math.sin(yaw)
  const c = Math.cos(yaw)
  return { vx: speed * (x * c - z * s), vz: speed * (-x * s - z * c) }
}

// Los límites de la locación no son simétricos (X -45..33.5), por eso reciben min/max y no un semi-ancho.
export function clampToBounds(p: Vec3, b: Bounds): Vec3 {
  return [Math.min(Math.max(p[0], b.minX), b.maxX), p[1], Math.min(Math.max(p[2], b.minZ), b.maxZ)]
}

export function needsRespawn(p: Vec3, b: Bounds): boolean {
  const c = clampToBounds(p, b)
  return Math.abs(p[1]) > 5 || c[0] !== p[0] || c[2] !== p[2]
}
