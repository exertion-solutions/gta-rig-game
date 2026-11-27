import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { exposeGame } from '../dev'
import { playerBody } from '../player/Player'
import { usePlayerStore } from '../player/store'
import { truckBody } from '../vehicle/Truck'
import { PLAYER_GROUPS } from '../world/groups'
import type { Vec3 } from '../player/movement'
import { cameraDistance } from './cameraDistance'
import { advancePivot, computeCameraTarget, resolveCameraCollision, smoothDistance } from './followCamera'

const DISTANCE = 5
const TRUCK_DISTANCE = 8
const TRUCK_PIVOT_HEIGHT = 2
const PIVOT_HEIGHT = 1.5 // punto que la cámara mira (hombros/cabeza)
const CROUCH_PIVOT_HEIGHT = 1.05 // agachado (la cámara baja; el pivote se suaviza con advancePivot)
const MARGIN = 0.3
const SMOOTH_K = 12 // 1/s; el factor real es 1 - exp(-K*dt)
const DIST_K = 6 // 1/s, alejamiento de la cámara tras liberarse del obstáculo
const MAX_DT = 0.1 // tras una pausa de pestaña no salta de golpe

export function FollowCamera() {
  const { world, rapier } = useRapier()
  const camera = useThree((s) => s.camera)
  const pivot = useRef<{ pivot: Vec3; seq: number } | null>(null)
  const dist = useRef<number | null>(null)

  useEffect(() => {
    const frustum = () => {
      camera.updateMatrixWorld()
      return new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
    }
    exposeGame({
      getCamera: () => camera.position.toArray(),
      // DEV: ¿se ven estos puntos / esta caja en el cuadro actual? (e2e del encuadre inicial)
      inFrustum: (pts: number[][]) => {
        const f = frustum()
        return pts.map((p) => f.containsPoint(new THREE.Vector3(...p)))
      },
      boxInFrustum: (min: number[], max: number[]) => frustum().intersectsBox(new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max))),
    })
  }, [camera])

  useFrame((_, delta) => {
    const { position, yaw, pitch, mode, teleportSeq, crouching } = usePlayerStore.getState()
    const driving = mode === 'truck'
    const distance = driving ? TRUCK_DISTANCE : DISTANCE
    const goal: Vec3 = [position[0], position[1] + (driving ? TRUCK_PIVOT_HEIGHT : crouching ? CROUCH_PIVOT_HEIGHT : PIVOT_HEIGHT), position[2]]
    // El store avanza a 60 Hz (paso fijo); el suavizado por dt reparte el movimiento entre frames a cualquier fps.
    const p = (pivot.current = advancePivot(pivot.current, goal, teleportSeq, SMOOTH_K, Math.min(delta, MAX_DT))).pivot
    const hitPos = resolveCameraCollision(
      p,
      computeCameraTarget(p, yaw, pitch, distance),
      (o, d) => {
        const hit = world.castRay(
          new rapier.Ray({ x: o[0], y: o[1], z: o[2] }, { x: d[0], y: d[1], z: d[2] }),
          distance,
          true,
          rapier.QueryFilterFlags.EXCLUDE_SENSORS,
          PLAYER_GROUPS, // no ve los volúmenes solo-camioneta de las escaleras
          undefined,
          (driving ? truckBody.current : playerBody.current) ?? undefined,
        )
        return hit ? hit.timeOfImpact : null
      },
      MARGIN,
    )
    // acerca de golpe, aleja suave: sin sacudidas al rozar el obstáculo ni atravesarlo
    const raw = Math.hypot(hitPos[0] - p[0], hitPos[1] - p[1], hitPos[2] - p[2])
    const d = (dist.current = smoothDistance(dist.current ?? raw, raw, DIST_K, Math.min(delta, MAX_DT)))
    const k = raw > 0 ? d / raw : 1
    const pos: Vec3 = [p[0] + (hitPos[0] - p[0]) * k, p[1] + (hitPos[1] - p[1]) * k, p[2] + (hitPos[2] - p[2]) * k]
    cameraDistance.current = d
    camera.position.set(pos[0], pos[1], pos[2])
    camera.lookAt(p[0], p[1], p[2])
  })

  return null
}
