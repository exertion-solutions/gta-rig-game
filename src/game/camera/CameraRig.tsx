import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import { exposeGame } from '../dev'
import { playerBody, usePlayerStore } from '../player/Player'
import type { Vec3 } from '../player/movement'
import { computeCameraTarget, resolveCameraCollision, smoothStep } from './followCamera'

const DISTANCE = 5
const PIVOT_HEIGHT = 1.5 // punto que la cámara mira (hombros/cabeza)
const MARGIN = 0.3
const SMOOTH_K = 12 // 1/s; el factor real es 1 - exp(-K*dt)
const MAX_DT = 0.1 // tras una pausa de pestaña no salta de golpe

export function FollowCamera() {
  const { world, rapier } = useRapier()
  const camera = useThree((s) => s.camera)
  const pivot = useRef<Vec3 | null>(null)

  useEffect(() => exposeGame({ getCamera: () => camera.position.toArray() }), [camera])

  useFrame((_, delta) => {
    const { position, yaw, pitch } = usePlayerStore.getState()
    const goal: Vec3 = [position[0], position[1] + PIVOT_HEIGHT, position[2]]
    // El store avanza a 60 Hz (paso fijo); el suavizado por dt reparte el movimiento entre frames a cualquier fps.
    const p = (pivot.current = pivot.current ? smoothStep(pivot.current, goal, SMOOTH_K, Math.min(delta, MAX_DT)) : goal)
    const pos = resolveCameraCollision(
      p,
      computeCameraTarget(p, yaw, pitch, DISTANCE),
      (o, d) => {
        const hit = world.castRay(
          new rapier.Ray({ x: o[0], y: o[1], z: o[2] }, { x: d[0], y: d[1], z: d[2] }),
          DISTANCE,
          true,
          rapier.QueryFilterFlags.EXCLUDE_SENSORS,
          undefined,
          undefined,
          playerBody.current ?? undefined,
        )
        return hit ? hit.timeOfImpact : null
      },
      MARGIN,
    )
    camera.position.set(pos[0], pos[1], pos[2])
    camera.lookAt(p[0], p[1], p[2])
  })

  return null
}
