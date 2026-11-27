import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getSectors } from '../data/sectors'
import { usePlayerStore } from '../player/store'
import { useHudStore } from '../../ui/hudStore'
import { INTERACTABLES } from '../world/walkable'
import { sectorsAt } from './engine'
import { useMissionStore } from './store'
import { objectiveTargets } from './targets'
import type { MissionState } from './types'

/**
 * Cada frame: el sector donde está el jugador (o la camioneta que conduce) -> HUD y motor de misiones.
 * Solo se informa el MÁS CERCANO cuyo radio y banda de piso lo contienen (sectorsAt): varios sectores comparten planta
 * (BOP, mástil, pisos, llave) y antes, informándolos todos y re-informando en bucle, llegar al centro completaba varios
 * objetivos seguidos sin moverse. Ahora cada llegada pide ir al sector propio (el que muestra el HUD).
 */
export function SectorReporter() {
  const sectors = useMemo(getSectors, [])
  const last = useRef<{ at: string | null | undefined; m: MissionState | null }>({ at: undefined, m: null })
  useFrame(() => {
    const at = sectorsAt(usePlayerStore.getState().position, sectors)[0] ?? null
    const ms = useMissionStore.getState()
    const l = last.current
    // Solo ante cambio de sector o de estado de misión (al empezar/avanzar el motor necesita saber dónde está el jugador).
    if (at === l.at && ms.mission === l.m) return
    if (at !== l.at) useHudStore.getState().setAt(at)
    l.at = at
    ms.report({ type: 'at', sectorId: at })
    l.m = useMissionStore.getState().mission
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
  const targets = objectiveTargets(available.find((d) => d.id === mission.missionId), mission, sectors, INTERACTABLES)
  return (
    <>
      {targets.map((p) => (
        <Beacon key={p.join()} position={p} />
      ))}
    </>
  )
}
