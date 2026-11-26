import { useFrame, useThree } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, useBeforePhysicsStep, useRapier, type RapierRigidBody } from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { create } from 'zustand'
import { exposeGame } from '../dev'
import { LOCACION_BOUNDS } from '../world/frame'
import { EYE_HEIGHT, PLAYER_RADIUS, RESPAWN, needsRespawn, stepMovement, type Vec3 } from './movement'

export const usePlayerStore = create<{ position: Vec3; yaw: number; mode: 'foot' | 'truck' }>(() => ({
  position: RESPAWN,
  yaw: 0,
  mode: 'foot',
}))

const HALF = 0.55 // semi-largo del cilindro: 2*0.55 + 2*PLAYER_RADIUS = 1.8 m de alto
const FOOT = HALF + PLAYER_RADIUS // centro de la cápsula sobre los pies
const GRAVITY = 9.81
const FIXED_DT = 1 / 60 // = timeStep por defecto de <Physics>
const keys = new Set<string>()
let override: { x: number; z: number; run: boolean } | null = null // solo lo usa window.__game (tests)
let pitch = 0

const readInput = () =>
  override ?? {
    x: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0),
    z: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
    run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
  }

export function Player() {
  const body = useRef<RapierRigidBody>(null)
  const { world } = useRapier()
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const vy = useRef(0)
  const ctl = useRef<ReturnType<typeof world.createCharacterController> | null>(null)

  useEffect(() => {
    const c = world.createCharacterController(0.01) // en el efecto: StrictMode lo monta/desmonta dos veces
    ctl.current = c
    c.enableAutostep(0.3, 0.1, false)
    c.enableSnapToGround(0.3)
    c.setMaxSlopeClimbAngle((50 * Math.PI) / 180)
    return () => {
      ctl.current = null
      world.removeCharacterController(c)
    }
  }, [world])

  useEffect(() => {
    const down = (e: KeyboardEvent) => keys.add(e.code)
    const up = (e: KeyboardEvent) => keys.delete(e.code)
    const move = (e: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement) return
      usePlayerStore.setState((s) => ({ yaw: s.yaw - e.movementX * 0.002 }))
      pitch = Math.max(-1.4, Math.min(1.4, pitch - e.movementY * 0.002))
    }
    const lock = () => void gl.domElement.requestPointerLock?.()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    document.addEventListener('mousemove', move)
    gl.domElement.addEventListener('click', lock)
    exposeGame({
      getPosition: () => usePlayerStore.getState().position,
      setYaw: (yaw: number) => usePlayerStore.setState({ yaw }),
      setInput: (i: { x: number; z: number; run: boolean } | null) => (override = i),
      // límites de la pieza tal como se dibuja (sin colliders de por medio), para verificar alineación en el navegador
      renderedBounds: (id: string) => {
        const o = scene.getObjectByName(id)
        if (!o) return null
        const b = new THREE.Box3().setFromObject(o)
        return { min: b.min.toArray(), max: b.max.toArray() }
      },
      teleport: (p: Vec3) => {
        body.current?.setTranslation({ x: p[0], y: p[1] + FOOT, z: p[2] }, true)
        vy.current = 0
        usePlayerStore.setState({ position: p })
      },
    })
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      document.removeEventListener('mousemove', move)
      gl.domElement.removeEventListener('click', lock)
    }
  }, [gl, scene])

  // Movimiento en el paso fijo de Rapier (timeStep 1/60): rb.translation() está al día en cada llamada,
  // así la velocidad no depende de los fps (antes, a >60 fps se movía desde una base vieja).
  useBeforePhysicsStep(() => {
    const rb = body.current
    const c = ctl.current
    if (!rb || !c) return
    const dt = FIXED_DT
    const { yaw } = usePlayerStore.getState()
    const { vx, vz } = stepMovement(readInput(), yaw, dt)
    vy.current -= GRAVITY * dt
    c.computeColliderMovement(rb.collider(0), { x: vx * dt, y: vy.current * dt, z: vz * dt })
    if (c.computedGrounded() && vy.current < 0) vy.current = 0
    const m = c.computedMovement()
    const t = rb.translation()
    const next = { x: t.x + m.x, y: t.y + m.y, z: t.z + m.z }
    let pos: Vec3 = [next.x, next.y - FOOT, next.z]
    if (needsRespawn(pos, LOCACION_BOUNDS)) {
      pos = RESPAWN
      vy.current = 0
      next.x = pos[0]
      next.y = pos[1] + FOOT
      next.z = pos[2]
      rb.setTranslation(next, true)
    }
    rb.setNextKinematicTranslation(next)
    usePlayerStore.setState({ position: pos })
  })

  useFrame(() => {
    const { position: pos, yaw } = usePlayerStore.getState()
    camera.position.set(pos[0], pos[1] + EYE_HEIGHT, pos[2])
    camera.rotation.set(pitch, yaw, 0, 'YXZ')
  })

  return (
    <RigidBody
      ref={body}
      type="kinematicPosition"
      colliders={false}
      position={[RESPAWN[0], RESPAWN[1] + FOOT + 0.02, RESPAWN[2]]}
    >
      <CapsuleCollider args={[HALF, PLAYER_RADIUS]} />
    </RigidBody>
  )
}
