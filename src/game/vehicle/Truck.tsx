import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody, useBeforePhysicsStep, useRapier, type RapierRigidBody } from '@react-three/rapier'
import { useEffect, useMemo, useRef } from 'react'
import { exposeGame } from '../dev'
import { PLAYER_RADIUS, needsRespawn, type Vec3 } from '../player/movement'
import { keys } from '../player/keys'
import { TRUCK_SPAWN, TRUCK_SPAWN_HEADING, teleportTo, usePlayerStore } from '../player/store'
import { LOCACION_BOUNDS } from '../world/frame'
import { toggleMode } from './enterExit'
import { TRUCK, WHEEL_POINTS, buildTruckModel, driveCommand, inclinationDeg, tiltTimer } from './truckModel'

const FIXED_DT = 1 / 60 // = timeStep por defecto de <Physics>
const DROP = 0.1 // la camioneta nace así de alto sobre su posición de reposo y asienta sobre la suspensión
// Signos del controlador de Rapier respecto de nuestra convención (frente = -Z local; steer > 0 = izquierda).
const ENGINE_SIGN = -1
const STEER_SIGN = 1

type Drive = { throttle: number; steer: number; brake: boolean }
let override: Drive | null = null // solo lo usa window.__game (tests)
let truckSteps = 0 // pasos de física de la camioneta (DEV: los e2e esperan pasos, no tiempo)
// cuerpo de la camioneta: la cámara de seguimiento lo excluye de su raycast cuando se conduce
export const truckBody: { current: RapierRigidBody | null } = { current: null }

const readDrive = (): Drive =>
  override ?? {
    throttle: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
    steer: (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0),
    brake: keys.has('Space'),
  }

type Q = { x: number; y: number; z: number; w: number }
// q * (0, 0, -1): frente de la camioneta en el mundo
const forwardOf = (q: Q): Vec3 => [-2 * (q.x * q.z + q.w * q.y), -2 * (q.y * q.z - q.w * q.x), -(1 - 2 * (q.x * q.x + q.y * q.y))]
const headingOf = (q: Q) => {
  const f = forwardOf(q)
  return Math.atan2(-f[0], -f[2])
}

function placeTruck(rb: RapierRigidBody, ground: Vec3, heading: number) {
  rb.setTranslation({ x: ground[0], y: ground[1] + TRUCK.rideHeight + DROP, z: ground[2] }, true)
  rb.setRotation({ x: 0, y: Math.sin(heading / 2), z: 0, w: Math.cos(heading / 2) }, true)
  rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
  rb.setAngvel({ x: 0, y: 0, z: 0 }, true)
  usePlayerStore.setState({ truck: { position: ground, heading } })
  if (usePlayerStore.getState().mode === 'truck') teleportTo(ground) // el conductor viaja con ella (y la cámara se reinicia)
}

// Vuelve a ponerla en el Acceso (ver TRUCK_SPAWN).
export function respawnTruck() {
  if (truckBody.current) placeTruck(truckBody.current, TRUCK_SPAWN, TRUCK_SPAWN_HEADING)
}

export function Truck() {
  const body = useRef<RapierRigidBody>(null)
  const { world, rapier } = useRapier()
  const model = useMemo(() => buildTruckModel(), [])
  const ctl = useRef<ReturnType<typeof world.createVehicleController> | null>(null)
  const ctlBody = useRef<RapierRigidBody | null>(null)
  const tilt = useRef(0)

  useEffect(
    () => () => {
      if (ctl.current) world.removeVehicleController(ctl.current) // StrictMode monta/desmonta dos veces
      ctl.current = null
    },
    [world],
  )

  useEffect(() => {
    const isFree = (p: Vec3) =>
      !needsRespawn(p, LOCACION_BOUNDS) &&
      !world.intersectionWithShape({ x: p[0], y: p[1] + 0.9, z: p[2] }, { x: 0, y: 0, z: 0, w: 1 }, new rapier.Ball(PLAYER_RADIUS), rapier.QueryFilterFlags.EXCLUDE_SENSORS)
    const down = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' && !e.repeat) toggleMode(isFree)
    }
    window.addEventListener('keydown', down)
    exposeGame({
      getMode: () => usePlayerStore.getState().mode,
      getTruck: () => {
        const rb = body.current!
        const t = rb.translation()
        const f = forwardOf(rb.rotation())
        const v = rb.linvel()
        return {
          position: usePlayerStore.getState().truck.position,
          bodyY: t.y,
          heading: usePlayerStore.getState().truck.heading,
          speed: v.x * f[0] + v.y * f[1] + v.z * f[2],
          inclination: inclinationDeg(rb.rotation()),
        }
      },
      setTruckInput: (i: Drive | null) => (override = i),
      truckSteps: () => truckSteps,
      teleportTruck: (p: Vec3, heading = 0) => body.current && placeTruck(body.current, p, heading),
      respawnTruck,
      flipTruck: () => body.current?.setRotation({ x: 0, y: 0, z: 1, w: 0 }, true), // boca abajo (test del respawn por vuelco)
      setTilt: (seconds: number) => (tilt.current = seconds), // para probar el respawn por vuelco sin esperar
    })
    return () => window.removeEventListener('keydown', down)
  }, [world, rapier])

  // Todo en el paso fijo de Rapier (igual que el jugador): updateVehicle debe correr justo antes de world.step.
  useBeforePhysicsStep(() => {
    const rb = body.current
    if (!rb) return
    truckSteps++
    if (!ctl.current || ctlBody.current !== rb) {
      if (ctl.current) world.removeVehicleController(ctl.current)
      const c = world.createVehicleController(rb)
      WHEEL_POINTS.forEach((p) => c.addWheel({ x: p[0], y: p[1], z: p[2] }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, TRUCK.suspensionRest, TRUCK.wheelRadius))
      for (let i = 0; i < WHEEL_POINTS.length; i++) {
        c.setWheelSuspensionStiffness(i, 25)
        c.setWheelMaxSuspensionForce(i, 100000)
        c.setWheelMaxSuspensionTravel(i, 0.3)
        c.setWheelFrictionSlip(i, 4)
      }
      ctl.current = c
      ctlBody.current = rb
    }
    const c = ctl.current
    const { mode } = usePlayerStore.getState()
    const q = rb.rotation()
    const f = forwardOf(q)
    const v = rb.linvel()
    const speed = v.x * f[0] + v.y * f[1] + v.z * f[2]
    // a pie: estacionada (freno puesto)
    const cmd = driveCommand(mode === 'truck' ? readDrive() : { throttle: 0, steer: 0, brake: true }, speed)
    for (let i = 0; i < WHEEL_POINTS.length; i++) {
      c.setWheelEngineForce(i, ENGINE_SIGN * cmd.engine)
      c.setWheelBrake(i, cmd.brake)
      if (i < 2) c.setWheelSteering(i, STEER_SIGN * cmd.steer)
    }
    c.updateVehicle(FIXED_DT, rapier.QueryFilterFlags.EXCLUDE_SENSORS)

    const t = rb.translation()
    const ground: Vec3 = [t.x, t.y - TRUCK.rideHeight, t.z]
    tilt.current = tiltTimer(tilt.current, inclinationDeg(q), FIXED_DT)
    if (tilt.current >= TRUCK.tiltSeconds || needsRespawn(ground, LOCACION_BOUNDS)) {
      tilt.current = 0
      respawnTruck()
      return
    }
    usePlayerStore.setState({ truck: { position: ground, heading: headingOf(q) } })
    if (mode === 'truck') usePlayerStore.setState({ position: ground })
  })

  // Ruedas: altura de suspensión, giro y dirección (cosmético).
  useFrame(() => {
    const c = ctl.current
    if (!c) return
    model.wheels.forEach((w, i) => {
      w.pivot.position.y = WHEEL_POINTS[i][1] - (c.wheelSuspensionLength(i) ?? TRUCK.suspensionRest)
      w.pivot.rotation.y = i < 2 ? STEER_SIGN * (c.wheelSteering(i) ?? 0) : 0
      w.tire.rotation.x = -(c.wheelRotation(i) ?? 0)
    })
  })

  const s = usePlayerStore.getState().truck
  return (
    <RigidBody
      ref={(rb) => {
        body.current = rb
        truckBody.current = rb
      }}
      colliders={false}
      position={[s.position[0], s.position[1] + TRUCK.rideHeight + DROP, s.position[2]]}
      rotation={[0, s.heading, 0]}
      ccd
      canSleep={false}
      linearDamping={0.05}
      angularDamping={0.5}
    >
      <CuboidCollider args={[TRUCK.halfWidth, 0.3, TRUCK.halfLength]} position={[0, 0.1, 0]} mass={TRUCK.mass} />
      <CuboidCollider args={[0.95, 0.4, 0.75]} position={[0, 0.65, -1.0]} density={0} />
      <primitive object={model.group} />
    </RigidBody>
  )
}
