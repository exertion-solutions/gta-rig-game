import { useGLTF } from '@react-three/drei'
import { CuboidCollider, Physics, RigidBody } from '@react-three/rapier'
import { useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { DRACO_PATH, rigUrl } from './assetUrl'
import { buildColliders } from './colliders'
import { LOCACION_BOUNDS as B, LOCACION_M, RIG_PARTS } from './frame'
import { stripLines } from './stripLines'
import { STAIR_GROUPS, TRUCK_BLOCK_GROUPS } from './groups'
import { REPLACED_PARTS, walkableColliders } from './walkable'

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
      <mesh rotation-x={-Math.PI / 2} position={[mx, 0, 0]} receiveShadow>
        <planeGeometry args={[LOCACION_M.x, LOCACION_M.z]} />
        <meshStandardMaterial color="#8a7a5a" />
      </mesh>
    </RigidBody>
  )
}

// Cajas fijas por componente 'collide', a partir de los límites de cada GLB (sin líneas). Mástil, BOP y piletas no:
// su bbox completo tapaba el piso de trabajo y las cubiertas; los cubren las cajas medidas de WalkableColliders.
export function RigColliders() {
  const parts = RIG_PARTS.filter((p) => p.role === 'collide').map((p) => ({ p, gltf: useGLTF(rigUrl(p.glb), DRACO_PATH) }))
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
        REPLACED_PARTS,
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

// Superficies caminables (pisos, cubiertas, escaleras como rampa por la línea de narices), barandas y cajas por banda,
// medidas de los GLB por scripts/extract-traversal.mjs (traversal.json). Solo cajas: nunca trimesh.
export function WalkableColliders() {
  const cs = useMemo(() => walkableColliders(), [])
  return (
    <RigidBody type="fixed" colliders={false}>
      {cs.map((c) => (
        <CuboidCollider
          key={c.id}
          args={c.half}
          position={c.center}
          rotation={c.rot}
          // sin grupo explícito si no hace falta: collisionGroups={undefined} dejaba la caja sin colisión (grupo 0)
          {...(c.only ? { collisionGroups: c.only === 'stair' ? STAIR_GROUPS : TRUCK_BLOCK_GROUPS } : {})}
        />
      ))}
    </RigidBody>
  )
}
