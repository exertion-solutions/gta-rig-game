import { ACCESO_POSITION } from '../data/sectors'
export type Vec3 = [number, number, number]
export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number }

export const WALK_SPEED = 1.4
export const RUN_SPEED = 4.5
export const PLAYER_RADIUS = 0.35

// Reaparición en el Acceso real (camPos del viewpoint "acceso" del visor), ver data/sectors.ts.
export const RESPAWN: Vec3 = ACCESO_POSITION

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

// Sin daño por caída: solo se reubica si quedó por debajo del suelo (atravesó un piso) o fuera del vallado.
// Estar arriba (piso de enganche a 20,65 m) es válido.
export const FALL_LIMIT_Y = -5
export function needsRespawn(p: Vec3, b: Bounds): boolean {
  const c = clampToBounds(p, b)
  return p[1] < FALL_LIMIT_Y || c[0] !== p[0] || c[2] !== p[2]
}

/** Contra el vallado invisible del borde de la locación (a `margin` o menos de algún lado). Sin cifras en pantalla. */
export const atLimit = (p: Vec3, margin: number, b: Bounds) =>
  p[0] <= b.minX + margin || p[0] >= b.maxX - margin || p[2] <= b.minZ + margin || p[2] >= b.maxZ - margin

/** Último punto firme: se actualiza solo con el jugador de pie (grounded) y dentro del vallado. */
export const trackSafe = (safe: Vec3, p: Vec3, grounded: boolean, b: Bounds): Vec3 => (grounded && !needsRespawn(p, b) ? p : safe)
/** Adónde reubicar (último punto firme) o null si no hace falta. */
export const respawnPoint = (p: Vec3, safe: Vec3, b: Bounds): Vec3 | null => (needsRespawn(p, b) ? safe : null)

// Autostep del controlador (valor de juego): cubre la contrahuella mayor medida (0,26 m, trip tank; docs/traversal-inventory.md);
// las escaleras se recorren como rampas por su línea de narices, el autostep es para bordes chicos.
export const STEP_MAX = 0.3
