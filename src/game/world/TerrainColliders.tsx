import { useBeforePhysicsStep, useRapier } from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import { usePlayerStore } from '../player/store'
import { CELL, PHYS, chunksAround, physHeights } from './Terrain'

// Aparte de Terrain.tsx: esto usa Rapier y va en el chunk diferido de la física (PhysicsScene).
type Collider = ReturnType<ReturnType<typeof useRapier>['world']['createCollider']>

// Colisión: 3 × 3 tramos bajo el jugador y bajo la camioneta (estacionada lejos también necesita suelo).
export function TerrainColliders() {
  const { world, rapier } = useRapier()
  const live = useRef(new Map<string, Collider>())
  useEffect(
    () => () => {
      live.current.forEach((c) => world.removeCollider(c, false))
      live.current.clear()
    },
    [world],
  )
  useBeforePhysicsStep(() => {
    const s = usePlayerStore.getState()
    const want = chunksAround([s.position, s.truck.position], PHYS, 1)
    for (const [k, c] of live.current)
      if (!want.has(k)) {
        world.removeCollider(c, false)
        live.current.delete(k)
      }
    for (const [k, [cx, cz]] of want)
      if (!live.current.has(k)) {
        const desc = rapier.ColliderDesc.heightfield(PHYS / CELL, PHYS / CELL, physHeights(cx, cz), { x: PHYS, y: 1, z: PHYS }).setTranslation((cx + 0.5) * PHYS, 0, (cz + 0.5) * PHYS)
        live.current.set(k, world.createCollider(desc))
      }
  })
  return null
}

