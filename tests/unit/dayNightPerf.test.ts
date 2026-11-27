import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { lightingAt } from '../../src/game/world/DayNight'
import { mergeByMaterial } from '../../src/game/world/mergeByMaterial'

describe('lightingAt', () => {
  it('mediodía más luz que medianoche; luminarias de la torre solo de noche; de noche no queda a oscuras', () => {
    const noon = lightingAt(12)
    const night = lightingAt(0)
    expect(noon.sun).toBeGreaterThan(night.sun)
    expect(noon.hemi).toBeGreaterThan(night.hemi)
    expect(noon.lamps).toBe(0)
    expect(night.lamps).toBeGreaterThan(0)
    expect(night.hemi).toBeGreaterThan(0.2)
    expect(noon.sunDir[1]).toBeGreaterThan(0.9)
  })
})

describe('mergeByMaterial', () => {
  it('une las mallas del mismo material conservando la posición de mundo', () => {
    const a = new THREE.MeshStandardMaterial()
    const b = new THREE.MeshStandardMaterial()
    const root = new THREE.Group()
    const sub = new THREE.Group()
    sub.position.set(10, 0, 0)
    root.add(sub)
    const box = new THREE.BoxGeometry(1, 1, 1)
    const m1 = new THREE.Mesh(box, a)
    const m2 = new THREE.Mesh(box, a)
    m2.position.set(0, 5, 0)
    sub.add(m1, m2, new THREE.Mesh(box, b))
    const before = new THREE.Box3().setFromObject(root)
    expect(mergeByMaterial(root)).toBe(1)
    const meshes: THREE.Mesh[] = []
    root.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o as THREE.Mesh))
    expect(meshes).toHaveLength(2)
    expect(new THREE.Box3().setFromObject(root).equals(before)).toBe(true)
    expect(meshes.find((m) => m.material === a)!.geometry.index!.count).toBe(box.index!.count * 2)
  })
})
