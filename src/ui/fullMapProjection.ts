import type { Sector, Vec3 } from '../game/data/sectors'

type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number }

/** Mundo -> fracciones 0..1 del mapa en planta (arriba = -Z, derecha = +X), acotadas al cuadro. Solo posiciones: sin distancias. */
export function mapPoint(w: Vec3, b: Bounds) {
  const f = (v: number, lo: number, hi: number) => Math.min(1, Math.max(0, (v - lo) / (hi - lo)))
  return { x: f(w[0], b.minX, b.maxX), y: f(w[2], b.minZ, b.maxZ) }
}

/** Solo sectores con posición documentada: los de position null no se dibujan (no se inventa dónde están). */
export const mappableSectors = (sectors: readonly Sector[]) => sectors.filter((s): s is Sector & { position: Vec3 } => s.position !== null)
