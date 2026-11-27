import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Atributos cuantizados (KHR_mesh_quantization: i16/i8 normalizados, escala en la matriz del nodo) => float32, para poder
// aplicarles la matriz y unirlos.
function toFloat(src: THREE.BufferGeometry, m: THREE.Matrix4) {
  const g = new THREE.BufferGeometry()
  for (const [name, a] of Object.entries(src.attributes)) {
    const out = new Float32Array(a.count * a.itemSize)
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k)
    g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize))
  }
  const n = src.attributes.position.count
  g.setIndex(src.index ? Array.from(src.index.array) : [...Array(n).keys()])
  return g.applyMatrix4(m)
}

/**
 * Une las mallas de `root` que comparten material en una sola (un draw call por material y no por nodo). Solo vale
 * para piezas estáticas. Si un grupo no se puede unir (atributos distintos) queda como estaba. Devuelve cuántas mallas
 * quitó.
 */
export function mergeByMaterial(root: THREE.Object3D): number {
  root.updateMatrixWorld(true)
  const inv = root.matrixWorld.clone().invert()
  const groups = new Map<THREE.Material, THREE.Mesh[]>()
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || Array.isArray(m.material) || (m as THREE.InstancedMesh).isInstancedMesh) return
    const list = groups.get(m.material) ?? []
    list.push(m)
    groups.set(m.material, list)
  })
  let removed = 0
  for (const [material, meshes] of groups) {
    if (meshes.length < 2) continue
    const merged = mergeGeometries(meshes.map((m) => toFloat(m.geometry, inv.clone().multiply(m.matrixWorld))))
    if (!merged) continue
    for (const m of meshes) m.removeFromParent()
    const mesh = new THREE.Mesh(merged, material)
    mesh.name = material.name
    root.add(mesh)
    removed += meshes.length - 1
  }
  return removed
}
