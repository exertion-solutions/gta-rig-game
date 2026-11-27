import type * as THREE from 'three'
import type { RigRole } from './frame'

export type LoadedPart = { id: string; role: RigRole; bounds: THREE.Box3 }
export type ColliderDesc = {
  id: string
  shape: 'cuboid' | 'convexHull' // nunca trimesh: ~678k tris en los GLB
  center: [number, number, number]
  half: [number, number, number]
}

// Vientos y tiros son cables finos: sin colisión aunque alguien los marque 'collide'.
const NO_COLLIDE = new Set(['sk575_vientos', 'sk575_tiros'])

export function boxFromBounds(b: THREE.Box3, margin = 0) {
  const c: [number, number, number] = [(b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2]
  const h: [number, number, number] = [
    (b.max.x - b.min.x) / 2 - margin,
    (b.max.y - b.min.y) / 2 - margin,
    (b.max.z - b.min.z) / 2 - margin,
  ]
  return { center: c, half: h }
}

// shortcut: una caja por componente; `replaced` = piezas que ya tienen cajas medidas en traversal.json (walkable.ts).
export function buildColliders(parts: LoadedPart[], replaced: ReadonlySet<string> = new Set()): ColliderDesc[] {
  return parts
    .filter((p) => p.role === 'collide' && !NO_COLLIDE.has(p.id) && !replaced.has(p.id))
    .map((p) => ({ id: p.id, shape: 'cuboid' as const, ...boxFromBounds(p.bounds) }))
}
