import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { SHADOW, advanceClock, exactHour, lightingAt, useTime } from '../../src/game/world/DayNight'
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
    expect(Math.hypot(...night.sunDir)).toBeCloseTo(1, 6)
  })
  it('reusa el objeto de salida (sin asignar por cuadro)', () => {
    const out = lightingAt(12)
    const top = out.skyTop
    expect(lightingAt(0, out)).toBe(out)
    expect(out.skyTop).toBe(top)
  })
})

describe('sombra del sol', () => {
  it('2048, frustum ±40 m, PCFShadowMap', () => {
    expect(SHADOW).toEqual({ mapSize: 2048, half: 40, type: THREE.PCFShadowMap })
  })
})

describe('reloj', () => {
  it('60 cuadros a 60 Hz cambian el store a lo sumo 2 veces (quien usa useTimeOfDay no se re-renderiza por cuadro)', () => {
    useTime.getState().setHour(10)
    let notified = 0
    const off = useTime.subscribe(() => notified++)
    for (let i = 0; i < 60; i++) advanceClock(1 / 60)
    off()
    expect(notified).toBeLessThanOrEqual(2)
    expect(exactHour()).toBeCloseTo(10 + 1 / 180, 6) // 3 s reales = 1 min de juego (día de 72 min)
  })
  it('cada sesión arranca a media mañana, sin retomar una hora guardada', async () => {
    vi.resetModules()
    vi.stubGlobal('localStorage', { getItem: () => '19.5', setItem: () => {} })
    const fresh = await import('../../src/game/world/DayNight')
    expect(fresh.exactHour()).toBe(10)
    vi.unstubAllGlobals()
  })
  it('setHour normaliza a 0–24', () => {
    useTime.getState().setHour(-1)
    expect(exactHour()).toBe(23)
    expect(useTime.getState().hour).toBe(23)
  })
})

const meshes = (root: THREE.Object3D) => {
  const out: THREE.Mesh[] = []
  root.traverse((o) => (o as THREE.Mesh).isMesh && out.push(o as THREE.Mesh))
  return out
}

describe('mergeByMaterial', () => {
  it('une las mallas del mismo material conservando la posición de mundo', () => {
    const a = new THREE.MeshStandardMaterial()
    const b = new THREE.MeshStandardMaterial()
    const root = new THREE.Group()
    const sub = new THREE.Group()
    sub.position.set(10, 0, 0)
    root.add(sub)
    const box = new THREE.BoxGeometry(1, 1, 1)
    const m2 = new THREE.Mesh(box, a)
    m2.position.set(0, 5, 0)
    sub.add(new THREE.Mesh(box, a), m2, new THREE.Mesh(box, b))
    const before = new THREE.Box3().setFromObject(root)
    expect(mergeByMaterial(root)).toHaveLength(1)
    expect(meshes(root)).toHaveLength(2)
    expect(new THREE.Box3().setFromObject(root).equals(before)).toBe(true)
    expect(meshes(root).find((m) => m.material === a)!.geometry.index!.count).toBe(box.index!.count * 2)
  })

  it('cuantizado int16 normalizado con escala y rotación: mismo vértice de mundo, normal unitaria', () => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Int16Array([32767, 0, 0, 0, 32767, 0, 0, 0, 32767]), 3, true))
    g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array([0, 0, 127, 0, 0, 127, 0, 0, 127]), 3, true))
    const mat = new THREE.MeshStandardMaterial()
    const root = new THREE.Group()
    const m1 = new THREE.Mesh(g, mat)
    m1.scale.set(2, 3, 4)
    m1.rotation.set(0, Math.PI / 2, 0)
    m1.position.set(1, 2, 3)
    root.add(m1, new THREE.Mesh(g, mat))
    root.updateMatrixWorld(true)
    const want = new THREE.Vector3(1, 0, 0).applyMatrix4(m1.matrixWorld)
    const [merged] = mergeByMaterial(root)
    const got = new THREE.Vector3().fromBufferAttribute(merged.attributes.position as THREE.BufferAttribute, 0)
    expect(got.distanceTo(want)).toBeLessThan(1e-3)
    const n = new THREE.Vector3().fromBufferAttribute(merged.attributes.normal as THREE.BufferAttribute, 0)
    expect(n.length()).toBeCloseTo(1, 3)
  })

  const pair = (make: (g: THREE.BufferGeometry, m: THREE.Material) => THREE.Mesh) => {
    const mat = new THREE.MeshStandardMaterial()
    const box = new THREE.BoxGeometry(1, 1, 1)
    const root = new THREE.Group()
    const special = make(box, mat)
    root.add(special, new THREE.Mesh(box, mat), new THREE.Mesh(box, mat))
    return { root, special }
  }

  it('no toca una SkinnedMesh', () => {
    const { root, special } = pair((g, m) => {
      const s = new THREE.SkinnedMesh(g, m)
      s.bind(new THREE.Skeleton([new THREE.Bone()]))
      return s
    })
    mergeByMaterial(root)
    expect(special.parent).toBe(root)
    expect(meshes(root)).toHaveLength(2) // la skinned + las dos normales unidas
  })

  it('no toca una malla con morph targets', () => {
    const { root, special } = pair((g, m) => {
      const mg = g.clone()
      mg.morphAttributes.position = [mg.attributes.position.clone()]
      const mesh = new THREE.Mesh(mg, m)
      mesh.updateMorphTargets()
      return mesh
    })
    mergeByMaterial(root)
    expect(special.parent).toBe(root)
    expect(meshes(root)).toHaveLength(2)
  })

  it('no toca una malla espejada (determinante < 0)', () => {
    const { root, special } = pair((g, m) => {
      const mesh = new THREE.Mesh(g, m)
      mesh.scale.set(-1, 1, 1)
      return mesh
    })
    mergeByMaterial(root)
    expect(special.parent).toBe(root)
    expect(meshes(root)).toHaveLength(2)
  })
})
