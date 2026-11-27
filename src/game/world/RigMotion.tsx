import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { exposeGame } from '../dev'
import { approach } from '../vehicle/truckModel'
import { useValveStore } from './interactables'
import { HOIST, hoistTarget, isTongPart, splitIndex, tongAngle } from './rigAccess'

// Movimiento ilustrativo del aparejo (sube y baja con el comando de izaje) y de la llave de potencia (gira sobre el eje
// del pozo y vuelve). Trabaja sobre las piezas ya cargadas por loadRig (clones: los GLB y su caché no se tocan).
const BLOCK = ['acero', 'acero_oscuro', 'amarillo', 'goma', 'rojo'].map((m) => `sk575_aparejo_${m}`)
const CABLE = 'sk575_aparejo_cable'
const Y_AXIS = new THREE.Vector3(0, 1, 0)

type Hoist = { block: THREE.Group; cable: THREE.Group; top: number; len: number }
type Tong = { body: THREE.Group; cable: THREE.Group; top: THREE.Vector3; bottom: THREE.Vector3 }

// Agrupa `nodes` bajo un grupo nuevo, hermano de ellos, sin moverlos.
function wrap(nodes: THREE.Object3D[], name: string) {
  const g = new THREE.Group()
  g.name = name
  nodes[0].parent!.add(g)
  nodes.forEach((n) => g.add(n))
  return g
}

function prepareHoist(root: THREE.Object3D): Hoist | null {
  const block = BLOCK.map((n) => root.getObjectByName(n)).filter((o): o is THREE.Object3D => !!o)
  const cable = root.getObjectByName(CABLE)
  if (!block.length || !cable) return null
  root.updateMatrixWorld(true)
  const b = new THREE.Box3().setFromObject(cable)
  return { block: wrap(block, 'aparejo_movil'), cable: wrap([cable], 'aparejo_cable_movil'), top: b.max.y, len: b.max.y - b.min.y }
}

// Separa de cada malla de la llave los triángulos que cuelgan (rigAccess.isTongPart) y los agrupa para girarlos.
function prepareTong(root: THREE.Object3D): Tong | null {
  root.updateMatrixWorld(true)
  const meshes: THREE.Mesh[] = []
  root.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o as THREE.Mesh))
  const body = new THREE.Group()
  body.name = 'llave_movil'
  const cable = new THREE.Group()
  cable.name = 'llave_cable_movil'
  const v = new THREE.Vector3()
  const span = new THREE.Box3()
  for (const m of meshes) {
    const pos = m.geometry.attributes.position
    const world = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).toArray(world, i * 3)
    const index = m.geometry.index ? m.geometry.index.array : Uint32Array.from({ length: pos.count }, (_, i) => i)
    const { picked, rest } = splitIndex(world, index, isTongPart)
    if (!picked.length) continue
    const share = (idx: number[]) => {
      const g = new THREE.BufferGeometry()
      for (const [k, a] of Object.entries(m.geometry.attributes)) g.setAttribute(k, a)
      g.setIndex(idx)
      return g
    }
    const moving = new THREE.Mesh(share(picked), m.material)
    moving.name = `${m.name}_movil`
    moving.applyMatrix4(m.matrixWorld) // queda en coordenadas de mundo (la pieza no tiene transformación propia)
    moving.receiveShadow = true
    const isCable = m.name.endsWith('_cable')
    ;(isCable ? cable : body).add(moving)
    if (isCable) for (const i of picked) span.expandByPoint(v.fromArray(world, i * 3))
    m.geometry = share(rest) // solo en el clon
  }
  if (!body.children.length || span.isEmpty()) return null
  // el cable va del resorte (abajo) al mástil (arriba): al girar la llave, pivota en su punto alto y sigue al resorte
  let top = new THREE.Vector3(0, -Infinity, 0)
  let bottom = new THREE.Vector3(0, Infinity, 0)
  for (const m of cable.children as THREE.Mesh[]) {
    const idx = m.geometry.index!.array
    const pos = m.geometry.attributes.position
    for (const i of idx) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrix)
      if (v.y > top.y) top = v.clone()
      if (v.y < bottom.y) bottom = v.clone()
    }
  }
  cable.position.copy(top)
  cable.children.forEach((c) => c.position.sub(top))
  root.add(body, cable)
  return { body, cable, top, bottom }
}

export function RigMotion() {
  const scene = useThree((s) => s.scene)
  const hoist = useRef<{ root: THREE.Object3D; h: Hoist | null } | null>(null)
  const tong = useRef<{ root: THREE.Object3D; t: Tong | null } | null>(null)
  const offset = useRef(0)
  const tongAt = useRef({ turns: 0, t: Infinity })
  const tmp = useRef({ a: new THREE.Vector3(), b: new THREE.Vector3() })

  useEffect(() => exposeGame({ rigMotion: () => ({ hoistOffset: offset.current, tongAngle: tongAngle(tongAt.current.t) }) }), [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const { states, turns } = useValveStore.getState()
    // las piezas son 'scenery' (cargan tarde) y pueden remontarse: se preparan cuando aparecen
    const hr = scene.getObjectByName('sk575_aparejo')
    if (hr && hoist.current?.root !== hr) hoist.current = { root: hr, h: prepareHoist(hr) }
    const tr = scene.getObjectByName('sk575_llave')
    if (tr && tong.current?.root !== tr) tong.current = { root: tr, t: prepareTong(tr) }

    offset.current = approach(offset.current, hoistTarget(states.comando_izaje), HOIST.speed * dt)
    const h = hoist.current?.h
    if (h) {
      h.block.position.y = offset.current
      const s = (h.len - offset.current) / h.len // el cable se estira o acorta desde la corona
      h.cable.scale.y = s
      h.cable.position.y = h.top * (1 - s)
    }

    const n = turns.llave_potencia ?? 0
    if (n !== tongAt.current.turns) tongAt.current = { turns: n, t: 0 }
    else tongAt.current.t += dt
    const t = tong.current?.t
    if (t) {
      const a = tongAngle(tongAt.current.t)
      t.body.rotation.y = a
      const { a: d0, b: d1 } = tmp.current
      d0.copy(t.bottom).sub(t.top).normalize()
      d1.copy(t.bottom).applyAxisAngle(Y_AXIS, a).sub(t.top).normalize()
      t.cable.quaternion.setFromUnitVectors(d0, d1)
    }
  })
  return null
}
