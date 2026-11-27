import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useValveStore } from './interactables'
import { INTERACTABLES } from './walkable'

// Volantes del manifold que giran al operar (ilustrativo, no es un procedimiento). En el GLB los 12 volantes están
// fusionados en una sola malla y no se pueden girar: se dibuja encima una copia del aro y sus rayos, en la posición y
// el radio medidos (aro Ø 0,42 m, horizontal, sobre el vástago). Una sola malla instanciada = 1 draw call.
// Las válvulas del acumulador no tienen volante en el GLB: se operan (registro propio) sin animación de volante.
const WHEELS = INTERACTABLES.filter((v) => v.partId === 'sk575_manifold')
const RING_R = 0.21 // radio medido del aro (scripts/extract-traversal.mjs busca el aro a 0,21 m)
const SPIN = Math.PI * 2 // una vuelta por operación, a una vuelta por segundo (juego)

function wheelGeometry() {
  const ring = new THREE.TorusGeometry(RING_R, 0.016, 6, 28)
  const spokes = [0, 1, 2].map((i) => new THREE.BoxGeometry(RING_R * 2, 0.018, 0.018).rotateZ((i * Math.PI) / 3))
  const hub = new THREE.CylinderGeometry(0.03, 0.03, 0.04, 10).rotateX(Math.PI / 2)
  const g = mergeGeometries([ring, ...spokes, hub])!
  g.rotateX(-Math.PI / 2) // plano XY -> XZ (volante horizontal)
  return g
}

export function Valves() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(wheelGeometry, [])
  const angle = useRef(WHEELS.map(() => 0))
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), [])

  const write = (i: number) => {
    const p = WHEELS[i].position
    mesh.current!.setMatrixAt(i, m4.compose(new THREE.Vector3(p[0], p[1] + 0.005, p[2]), q.setFromAxisAngle(up, angle.current[i]), one))
  }
  useLayoutEffect(() => {
    WHEELS.forEach((_, i) => write(i))
    mesh.current!.instanceMatrix.needsUpdate = true
  })

  // Cada operación suma una vuelta: abrir antihorario, cerrar horario (visto desde arriba), convención visual del juego.
  const target = useRef(WHEELS.map(() => ({ turns: 0, a: 0 })))
  useFrame((_, delta) => {
    const { turns, states } = useValveStore.getState()
    let dirty = false
    WHEELS.forEach((v, i) => {
      const t = target.current[i]
      const n = turns[v.id] ?? 0
      if (n !== t.turns) [t.turns, t.a] = [n, t.a + (states[v.id] === 'closed' ? -SPIN : SPIN)]
      const a = angle.current[i]
      if (Math.abs(t.a - a) < 1e-3) return
      angle.current[i] = a + Math.sign(t.a - a) * Math.min(Math.abs(t.a - a), SPIN * Math.min(delta, 0.1))
      write(i)
      dirty = true
    })
    if (dirty) mesh.current!.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[geo, undefined, WHEELS.length]} name="volantes_manifold" castShadow>
      <meshStandardMaterial color="#2b2f33" metalness={0.8} roughness={0.45} />
    </instancedMesh>
  )
}
