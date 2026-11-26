// @vitest-environment node
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { RIG_PARTS } from '../../src/game/world/frame'
import { boxFromBounds, buildColliders, type LoadedPart } from '../../src/game/world/colliders'

const box = (a: number[], b: number[]) => new THREE.Box3(new THREE.Vector3(...a), new THREE.Vector3(...b))
const loaded = (): LoadedPart[] =>
  RIG_PARTS.map((p) => ({ id: p.id, role: p.role, bounds: box([0, 0, 0], [2, 4, 6]) }))

describe('colliders', () => {
  it('boxFromBounds devuelve centro y semi-ejes correctos para un Box3 conocido', () => {
    expect(boxFromBounds(box([-1, 0, 2], [3, 4, 8]))).toEqual({ center: [1, 2, 5], half: [2, 2, 3] })
    expect(boxFromBounds(box([-1, 0, 2], [3, 4, 8]), 0.5).half).toEqual([1.5, 1.5, 2.5])
  })

  it('buildColliders no genera trimesh', () => {
    const d = buildColliders(loaded())
    expect(d.length).toBeGreaterThan(0)
    for (const c of d) expect(['cuboid', 'convexHull']).toContain(c.shape)
  })

  it('buildColliders omite vientos y tiros (y todo lo no collide)', () => {
    const ids = buildColliders(loaded()).map((c) => c.id)
    expect(ids).not.toContain('sk575_vientos')
    expect(ids).not.toContain('sk575_tiros')
    expect(ids.sort()).toEqual(['sk575_bop', 'sk575_carrier', 'sk575_mastil', 'sk575_piletas'])
    // aun con role 'collide' forzado, vientos/tiros se omiten
    const forced = loaded().map((p) => ({ ...p, role: 'collide' as const }))
    const f = buildColliders(forced).map((c) => c.id)
    expect(f).not.toContain('sk575_vientos')
    expect(f).not.toContain('sk575_tiros')
  })
})
