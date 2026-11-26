// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { describe, expect, it } from 'vitest'
import { LOCACION_M, RIG_PARTS } from '../../src/game/world/frame'
import { stripLines } from '../../src/game/world/stripLines'

const rig = resolve('public/models/rig10')

describe('stripLines', () => {
  it('elimina todos los Line y deja los Mesh', () => {
    const root = new THREE.Group()
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())
    const nested = new THREE.Group()
    nested.add(new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial()))
    nested.add(new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial()))
    nested.add(new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial()))
    root.add(mesh, nested)
    expect(stripLines(root)).toBe(3)
    let lines = 0
    let meshes = 0
    root.traverse((o) => {
      if ((o as THREE.Line).isLine) lines++
      if ((o as THREE.Mesh).isMesh) meshes++
    })
    expect([lines, meshes]).toEqual([0, 1])
  })
})

describe('RIG_PARTS', () => {
  it('tiene 16 entradas con glb y meta existentes en disco', () => {
    expect(RIG_PARTS).toHaveLength(16)
    for (const p of RIG_PARTS) {
      expect(existsSync(resolve(rig, p.glb)), p.glb).toBe(true)
      expect(existsSync(resolve(rig, p.meta)), p.meta).toBe(true)
    }
  })
})

describe('marco', () => {
  it('LOCACION_M coincide con locacion de viewpoints.json (eje X = largo, Z = ancho)', () => {
    const { min, max } = JSON.parse(readFileSync('vendor/visor/viewpoints.json', 'utf8')).locacion
    expect(LOCACION_M.x).toBeCloseTo(max[0] - min[0])
    expect(LOCACION_M.z).toBeCloseTo(max[1] - min[1])
  })

  it('bounding box de sk575_mastil está dentro de LOCACION_M', async () => {
    const buf = readFileSync(resolve(rig, 'sk575_mastil.glb'))
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    const gltf = await loader.parseAsync(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
      '',
    )
    stripLines(gltf.scene)
    const box = new THREE.Box3().setFromObject(gltf.scene)
    // Tolerancia 1 m: el marco (origen en boca de pozo, signo lateral) no está
    // verificado con el modelo; se usa la huella completa -45..33.5 x +-30.5 (viewpoints.json)
    // y 1 m de holgura para no fallar por redondeos del visor.
    const tol = 1
    expect(box.isEmpty()).toBe(false)
    expect(box.min.x).toBeGreaterThanOrEqual(-45 - tol)
    expect(box.max.x).toBeLessThanOrEqual(33.5 + tol)
    expect(box.min.z).toBeGreaterThanOrEqual(-LOCACION_M.z / 2 - tol)
    expect(box.max.z).toBeLessThanOrEqual(LOCACION_M.z / 2 + tol)
    expect(box.min.y).toBeGreaterThanOrEqual(-tol)
  })
})
