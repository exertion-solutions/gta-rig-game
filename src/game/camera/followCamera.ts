import type { Vec3 } from '../player/movement'

// pitch = elevación de la cámara sobre el objetivo (rad). Sin bajar del suelo ni pasar por encima de la cabeza.
export const PITCH_MIN = -0.15
export const PITCH_MAX = 1.2
export const clampPitch = (p: number) => Math.max(PITCH_MIN, Math.min(PITCH_MAX, p))

// yaw 0 mira hacia -Z (convención three), así que "detrás" es +Z.
export function computeCameraTarget(target: Vec3, yaw: number, pitch: number, distance: number): Vec3 {
  const h = Math.cos(pitch) * distance
  return [target[0] + Math.sin(yaw) * h, target[1] + Math.sin(pitch) * distance, target[2] + Math.cos(yaw) * h]
}

// `hit(origen, dirección unitaria)` devuelve la distancia al primer choque o null. Acerca la cámara a (choque - margin).
export function resolveCameraCollision(origin: Vec3, desired: Vec3, hit: (o: Vec3, d: Vec3) => number | null, margin: number): Vec3 {
  const dx = desired[0] - origin[0]
  const dy = desired[1] - origin[1]
  const dz = desired[2] - origin[2]
  const len = Math.hypot(dx, dy, dz)
  if (len === 0) return desired
  const dir: Vec3 = [dx / len, dy / len, dz / len]
  const toi = hit(origin, dir)
  if (toi === null || toi >= len) return desired
  const d = Math.max(toi - margin, 0)
  return [origin[0] + dir[0] * d, origin[1] + dir[1] * d, origin[2] + dir[2] * d]
}

// Suavizado exponencial: el factor depende del dt, no del número de frames (igual a 60, 120 o 144 Hz).
export function smoothStep(current: Vec3, target: Vec3, k: number, dt: number): Vec3 {
  const a = 1 - Math.exp(-k * dt)
  return [current[0] + (target[0] - current[0]) * a, current[1] + (target[1] - current[1]) * a, current[2] + (target[2] - current[2]) * a]
}
