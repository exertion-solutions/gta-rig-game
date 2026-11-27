import * as THREE from 'three'
import { RIG_NAME } from '../data/evidence'

// Nodos de los GLB del equipo que son solo el rótulo con el nombre anterior (letras como geometría, mirando a +Z).
const LABEL_NODES = ['sk575_motor_blanco', 'sk575_enganche_blanco']
const W = 1024
const H = 160

function labelTexture() {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = '#fff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = 'bold 100px Arial, Helvetica, sans-serif'
  const size = Math.min(150, (100 * (W - 16)) / g.measureText(RIG_NAME).width) // entra a lo ancho
  g.font = `bold ${size}px Arial, Helvetica, sans-serif`
  g.fillText(RIG_NAME, W / 2, H / 2 + size * 0.04)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/**
 * Cambia el rótulo del equipo: quita los nodos con el nombre anterior y pone en su lugar un plano con RIG_NAME, del mismo
 * ancho. Los GLB quedan intactos (tienen hash en assets.lock.json). Devuelve lo que hay que liberar al desmontar.
 */
export function relabel(root: THREE.Object3D): { dispose(): void }[] {
  root.updateMatrixWorld(true)
  const inv = root.matrixWorld.clone().invert()
  const made: { dispose(): void }[] = []
  for (const name of LABEL_NODES) {
    const node = root.getObjectByName(name)
    if (!node) continue
    const box = new THREE.Box3().setFromObject(node).applyMatrix4(inv)
    node.removeFromParent()
    const size = box.getSize(new THREE.Vector3())
    const map = labelTexture()
    const mat = new THREE.MeshStandardMaterial({ map, transparent: true, alphaTest: 0.4, roughness: 0.7 })
    const geo = new THREE.PlaneGeometry(size.x, (size.x * H) / W)
    const plane = new THREE.Mesh(geo, mat)
    plane.name = `${name}_rotulo`
    plane.position.set((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, box.max.z + 0.003)
    root.add(plane)
    made.push(map, mat, geo)
  }
  return made
}
