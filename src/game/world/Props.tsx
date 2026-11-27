import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { assetUrl, DRACO_PATH } from './assetUrl'
import { BARRELS, CONES, type Spot } from './propsLayout'

// Props instanciados del escenario ilustrativo añadido por el juego, no as-built (docs/scenario-additions.md A5, A6).
// Un draw call por pieza sin importar la cantidad. Posiciones en propsLayout.ts (solo zonas libres del perímetro).
// Tambor: Poly Haven "Barrel 03" (CC0, Serhii Khromov), 1.473 triángulos, sin marcas ni logos (NOTICE.md).
const BARREL_URL = assetUrl('models/props/barrel.glb')
useGLTF.preload(BARREL_URL, DRACO_PATH)

const place = (s: Spot, y: number) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(s.x, y, s.z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.rot),
    new THREE.Vector3(1, 1, 1),
  )

function Barrels() {
  const { scene } = useGLTF(BARREL_URL, DRACO_PATH)
  const group = useMemo(() => {
    scene.updateMatrixWorld(true)
    const base = -new THREE.Box3().setFromObject(scene).min.y // apoya sobre el suelo
    const g = new THREE.Group()
    g.name = 'props_tambores'
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const inst = new THREE.InstancedMesh(m.geometry, m.material, BARRELS.length)
      BARRELS.forEach((s, i) => inst.setMatrixAt(i, place(s, base).multiply(m.matrixWorld)))
      inst.castShadow = true
      inst.receiveShadow = true
      g.add(inst)
    })
    return g
  }, [scene])
  useEffect(() => () => group.children.forEach((c) => (c as THREE.InstancedMesh).dispose()), [group])
  return <primitive object={group} />
}

// Cono de tránsito: tres bandas (naranja / blanca / naranja) por vértice + base cuadrada; 84 triángulos.
export function coneGeometry() {
  const H = 0.7
  const rAt = (y: number) => 0.16 - (0.13 * (y - 0.04)) / (H - 0.04)
  const orange = new THREE.Color('#ff6a13')
  const white = new THREE.Color('#e9e9e4')
  const base = new THREE.Color('#2b2b2b')
  const paint = (g: THREE.BufferGeometry, c: THREE.Color) => {
    const n = g.attributes.position.count
    g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => c.toArray()).flat(), 3))
    return g
  }
  const band = (y0: number, y1: number, c: THREE.Color) =>
    paint(new THREE.LatheGeometry([new THREE.Vector2(rAt(y0), y0), new THREE.Vector2(rAt(y1), y1)], 12), c)
  const slab = new THREE.BoxGeometry(0.38, 0.04, 0.38).translate(0, 0.02, 0)
  return mergeGeometries([paint(slab, base), band(0.04, 0.38, orange), band(0.38, 0.54, white), band(0.54, H, orange)])
}

function Cones() {
  const geo = useMemo(() => coneGeometry(), [])
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.55,
        metalness: 0,
      }),
    [],
  )
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geo, mat, CONES.length)
    CONES.forEach((s, i) => m.setMatrixAt(i, place(s, 0)))
    m.castShadow = false // presupuesto de triángulos del pase de sombra (docs/perf.md)
    m.receiveShadow = true
    m.name = 'props_conos'
    return m
  }, [geo, mat])
  useEffect(
    () => () => {
      mesh.dispose()
      geo.dispose()
      mat.dispose()
    },
    [mesh, geo, mat],
  )
  return <primitive object={mesh} />
}

export function Props() {
  return (
    <>
      <Barrels />
      <Cones />
    </>
  )
}
