import { useGLTF } from '@react-three/drei'
import { CuboidCollider, Physics, RigidBody } from '@react-three/rapier'
import { useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { buildColliders } from './colliders'
import { LOCACION_BOUNDS as B, LOCACION_M, RIG_PARTS } from './frame'
import { stripLines } from './stripLines'

const FENCE_HALF_H = 20 // semi-altura del vallado invisible en el borde de la locación (20 => 40 m de alto)
const mx = (B.minX + B.maxX) / 2
const T = 0.5

export function PhysicsWorld({ children }: { children: ReactNode }) {
  return <Physics gravity={[0, -9.81, 0]}>{children}</Physics>
}

export function Ground() {
  return (
    <RigidBody type="fixed" colliders={false}>
      {/* suelo liso: tapa en y=0 */}
      <CuboidCollider args={[LOCACION_M.x / 2, 0.5, LOCACION_M.z / 2]} position={[mx, -0.5, 0]} />
      <CuboidCollider args={[T, FENCE_HALF_H, LOCACION_M.z / 2]} position={[B.minX - T, FENCE_HALF_H, 0]} />
      <CuboidCollider args={[T, FENCE_HALF_H, LOCACION_M.z / 2]} position={[B.maxX + T, FENCE_HALF_H, 0]} />
      <CuboidCollider args={[LOCACION_M.x / 2, FENCE_HALF_H, T]} position={[mx, FENCE_HALF_H, B.minZ - T]} />
      <CuboidCollider args={[LOCACION_M.x / 2, FENCE_HALF_H, T]} position={[mx, FENCE_HALF_H, B.maxZ + T]} />
      <mesh rotation-x={-Math.PI / 2} position={[mx, 0, 0]}>
        <planeGeometry args={[LOCACION_M.x, LOCACION_M.z]} />
        <meshStandardMaterial color="#8a7a5a" />
      </mesh>
    </RigidBody>
  )
}

const url = (glb: string) => `${import.meta.env.BASE_URL}models/rig10/${glb}`
const DRACO_PATH = `${import.meta.env.BASE_URL}decoders/draco/`

// Cajas fijas por componente 'collide', a partir de los límites de cada GLB (sin líneas).
// planchada/piso (role 'walkable') no llevan caja: ver nota en Player/e2e y el informe de Task 4.
export function RigColliders() {
  const parts = RIG_PARTS.filter((p) => p.role === 'collide').map((p) => ({ p, gltf: useGLTF(url(p.glb), DRACO_PATH) }))
  const descs = useMemo(
    () =>
      buildColliders(
        parts
          .map(({ p, gltf }) => {
            const c = gltf.scene.clone(true)
            stripLines(c)
            return { id: p.id, role: p.role, bounds: new THREE.Box3().setFromObject(c) }
          })
          .filter((l) => !l.bounds.isEmpty()), // Box3 vacío => min/max infinitos => collider NaN
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  return (
    <RigidBody type="fixed" colliders={false}>
      {descs.map((d) => (
        <CuboidCollider key={d.id} args={d.half} position={d.center} />
      ))}
    </RigidBody>
  )
}
