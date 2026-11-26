import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getSectors } from '../data/sectors'
import { usePlayerStore } from '../player/store'
import { useHudStore } from '../../ui/hudStore'
import { sectorsAt } from './engine'
import { useMissionStore } from './store'
import { objectiveTargets } from './targets'
import type { MissionState } from './types'

/** Cada frame: sectores en cuyo radio está el jugador (o la camioneta que conduce: su posición es la del jugador) -> motor de misiones. */
export function SectorReporter() {
  const sectors = useMemo(getSectors, [])
  const last = useRef<{ key: string | undefined; m: MissionState | null }>({ key: undefined, m: null })
  useFrame(() => {
    const inside = sectorsAt(usePlayerStore.getState().position, sectors)
    const key = inside.join('|')
    const ms = useMissionStore.getState()
    const l = last.current
    // Solo ante cambio de sectores o de estado de misión; al empezar/avanzar se re-informa para que el motor sepa dónde está el jugador.
    if (key === l.key && ms.mission === l.m) return
    if (key !== l.key) useHudStore.getState().setAt(inside[0] ?? null)
    l.key = key
    // Varios sectores comparten planta (mástil, pisos, BOP): tras avanzar se re-informa por si el siguiente objetivo ya se cumple.
    let m = ms.mission
    for (let i = 0; i < 20; i++) {
      ms.report({ type: 'at', sectorId: inside[0] ?? null, inside })
      const n = useMissionStore.getState().mission
      if (n === m) break
      m = n
    }
    l.m = m
  })
  return null
}

const AMBER = '#f2a900'
function Beacon({ position }: { position: [number, number, number] }) {
  const ring = useRef<THREE.Mesh>(null)
  const beam = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    const k = (clock.elapsedTime % 1.6) / 1.6
    ring.current?.scale.setScalar(0.7 + k * 1.1)
    if (beam.current) beam.current.opacity = 0.22 + 0.12 * Math.sin(clock.elapsedTime * 3)
  })
  return (
    <group position={[position[0], position[1], position[2]]}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]}>
        <ringGeometry args={[0.9, 1.1, 40]} />
        <meshBasicMaterial color={AMBER} transparent opacity={0.9} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 4, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 8, 16, 1, true]} />
        <meshBasicMaterial ref={beam} color={AMBER} transparent opacity={0.3} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/** Baliza 3D en el/los sector(es) que pide el objetivo activo. Sin texto ni distancias. */
export function ObjectiveMarker() {
  const mission = useMissionStore((s) => s.mission)
  const available = useMissionStore((s) => s.available)
  const sectors = useMemo(getSectors, [])
  const targets = objectiveTargets(available.find((d) => d.id === mission.missionId), mission, sectors)
  return (
    <>
      {targets.map((p) => (
        <Beacon key={p.join()} position={p} />
      ))}
    </>
  )
}
