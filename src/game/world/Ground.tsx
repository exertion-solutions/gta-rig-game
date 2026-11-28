import { useGLTF } from '@react-three/drei'
import { CuboidCollider, Physics, RigidBody } from '@react-three/rapier'
import { useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { useHudStore } from '../../ui/hudStore'
import { DRACO_PATH, rigUrl } from './assetUrl'
import { buildColliders } from './colliders'
import { useGroundMaterial } from './GroundMaterial'
import { LOCACION_BOUNDS as B, LOCACION_M, RIG_PARTS } from './frame'
import { stripLines } from './stripLines'
import { STAIR_GROUPS, TRUCK_BLOCK_GROUPS } from './groups'
import { WORLD_BOUNDS as W } from './route'
import { REPLACED_PARTS, walkableColliders } from './walkable'

const mx = (B.minX + B.maxX) / 2
const EDGE_T = 1 // semi-espesor de la pared del borde del mapa
const EDGE_H = 900 // semi-altura: cubre de la base (−180 m) a los cerros

export function PhysicsWorld({ children }: { children: ReactNode }) {
  // Con el menú de pausa abierto Rapier no avanza (la camioneta no sigue rodando); solo lectura del hudStore.
  const paused = useHudStore((s) => s.pauseOpen)
  return (
    <Physics gravity={[0, -9.81, 0]} paused={paused}>
      {children}
    </Physics>
  )
}

export function Ground() {
  const material = useGroundMaterial(LOCACION_M.x, LOCACION_M.z)
  return (
    <RigidBody type="fixed" colliders={false}>
      {/* suelo liso: tapa en y=0 */}
      <CuboidCollider args={[LOCACION_M.x / 2, 0.5, LOCACION_M.z / 2]} position={[mx, -0.5, 0]} />
      {/* borde del mapa: paredes invisibles (la locación ya no tiene alambrado; el mundo termina en WORLD_BOUNDS) */}
      <CuboidCollider args={[EDGE_T, EDGE_H, (W.maxZ - W.minZ) / 2]} position={[W.minX - EDGE_T, 0, (W.minZ + W.maxZ) / 2]} />
      <CuboidCollider args={[EDGE_T, EDGE_H, (W.maxZ - W.minZ) / 2]} position={[W.maxX + EDGE_T, 0, (W.minZ + W.maxZ) / 2]} />
      <CuboidCollider args={[(W.maxX - W.minX) / 2, EDGE_H, EDGE_T]} position={[(W.minX + W.maxX) / 2, 0, W.minZ - EDGE_T]} />
      <CuboidCollider args={[(W.maxX - W.minX) / 2, EDGE_H, EDGE_T]} position={[(W.minX + W.maxX) / 2, 0, W.maxZ + EDGE_T]} />
      <mesh rotation-x={-Math.PI / 2} position={[mx, 0, 0]} receiveShadow material={material}>
        <planeGeometry args={[LOCACION_M.x, LOCACION_M.z]} />
      </mesh>
    </RigidBody>
  )
}

// Cajas fijas por componente 'collide', a partir de los límites de cada GLB (sin líneas). Mástil, BOP y piletas no:
// su bbox completo tapaba el piso de trabajo y las cubiertas; los cubren las cajas medidas de WalkableColliders.
export function RigColliders() {
  const parts = RIG_PARTS.filter((p) => p.role === 'collide').map((p) => ({
    p,
    gltf: useGLTF(rigUrl(p.glb), DRACO_PATH),
  }))
  const descs = useMemo(
    () =>
      buildColliders(
        parts
          .map(({ p, gltf }) => {
            const c = gltf.scene.clone(true)
            stripLines(c)
            return {
              id: p.id,
              role: p.role,
              bounds: new THREE.Box3().setFromObject(c),
            }
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
          {...(c.only
            ? {
                collisionGroups: c.only === 'stair' ? STAIR_GROUPS : TRUCK_BLOCK_GROUPS,
              }
            : {})}
        />
      ))}
    </RigidBody>
  )
}
