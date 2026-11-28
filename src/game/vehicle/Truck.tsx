import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody, useBeforePhysicsStep, useRapier, type RapierRigidBody } from '@react-three/rapier'
import { useEffect, useMemo, useRef } from 'react'
import { exposeGame } from '../dev'
import { PLAYER_RADIUS, atLimit, needsRespawn, type Vec3 } from '../player/movement'
import { readPad } from '../input/gamepad'
import { keys } from '../player/keys'
import { uiBlocking } from '../../ui/hudStore'
import { TRUCK_SPAWN, TRUCK_SPAWN_HEADING, teleportTo, usePlayerStore } from '../player/store'
import { truckSpeed } from '../player/telemetry'
import { useTime } from '../world/DayNight'
import { assetUrl, DRACO_PATH } from '../world/assetUrl'
import { WORLD_BOUNDS, inLocacion, pointAt, roadSpawn, terrainY } from '../world/route'
import { PLAYER_GROUPS, TRUCK_GROUPS } from '../world/groups'
import { toggleMode } from './enterExit'
import { TRUCK, WHEEL_POINTS, approach, driveCommand, headlightsOn, inclinationDeg, leanTarget, tiltTimer, truckModelFrom } from './truckModel'

const PICKUP_URL = assetUrl('models/vehicle/pickup.glb')
useGLTF.preload(PICKUP_URL, DRACO_PATH)

const FIXED_DT = 1 / 60 // = timeStep por defecto de <Physics>
const DROP = 0.1 // la camioneta nace así de alto sobre su posición de reposo y asienta sobre la suspensión
// Signos del controlador de Rapier respecto de nuestra convención (frente = -Z local; steer > 0 = izquierda).
const ENGINE_SIGN = -1
const STEER_SIGN = 1
const STEER_RATE = 2.5 // rad/s: la dirección no salta, se gira con el volante

type Drive = { throttle: number; steer: number; brake: boolean }
let override: Drive | null = null // solo lo usa window.__game (tests)
let truckSteps = 0 // pasos de física de la camioneta (DEV: los e2e esperan pasos, no tiempo)
// cuerpo de la camioneta: la cámara de seguimiento lo excluye de su raycast cuando se conduce
export const truckBody: { current: RapierRigidBody | null } = { current: null }

// Teclado + mando (stick izquierdo acelera y gira, A frena). Con un panel abierto el mando no maneja.
const readDrive = (): Drive => {
  const pad = uiBlocking() ? null : readPad()
  const c = (v: number) => Math.max(-1, Math.min(1, v))
  return (
    override ?? {
      throttle: c((keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0) + (pad?.move.z ?? 0)),
      steer: c((keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0) - (pad?.move.x ?? 0)),
      brake: keys.has('Space') || !!pad?.jump,
    }
  )
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

// En la locación vuelve al Acceso (TRUCK_SPAWN); en la ruta, a la calzada más cercana, en su carril.
export function respawnTruck() {
  const rb = truckBody.current
  if (!rb) return
  const t = rb.translation()
  if (inLocacion(t.x, t.z, 40)) return placeTruck(rb, TRUCK_SPAWN, TRUCK_SPAWN_HEADING)
  const r = roadSpawn(t.x, t.z)
  placeTruck(rb, r.position, r.yaw)
}

export function Truck() {
  const body = useRef<RapierRigidBody>(null)
  const { world, rapier } = useRapier()
  const { scene } = useGLTF(PICKUP_URL, DRACO_PATH)
  const model = useMemo(() => truckModelFrom(scene), [scene])
  const ctl = useRef<ReturnType<typeof world.createVehicleController> | null>(null)
  const ctlBody = useRef<RapierRigidBody | null>(null)
  const tilt = useRef(0)
  const steerNow = useRef(0) // dirección suavizada (rad)
  const braking = useRef(false)
  const lean = useRef({ pitch: 0, roll: 0, acc: 0, speed: 0 })
  const night = useRef(false)

  useEffect(
    () => () => {
      if (ctl.current) world.removeVehicleController(ctl.current) // StrictMode monta/desmonta dos veces
      ctl.current = null
    },
    [world],
  )

  // faros: de noche según la hora del juego (useTime de DayNight, sin re-renderizar la camioneta)
  useEffect(() => {
    const apply = (hour: number) => {
      night.current = headlightsOn(hour)
      model.beam.visible = night.current
      model.beam.intensity = night.current ? 400 : 0
      model.headMat.emissiveIntensity = night.current ? 2.5 : 0.1
    }
    apply(useTime.getState().hour)
    return useTime.subscribe((st) => apply(st.hour))
  }, [model])

  useEffect(() => {
    const isFree = (p: Vec3) =>
      !needsRespawn(p, WORLD_BOUNDS, terrainY(p[0], p[2])) &&
      !world.intersectionWithShape({ x: p[0], y: p[1] + 0.9, z: p[2] }, { x: 0, y: 0, z: 0, w: 1 }, new rapier.Ball(PLAYER_RADIUS), rapier.QueryFilterFlags.EXCLUDE_SENSORS, PLAYER_GROUPS)
    const down = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' && !e.repeat) toggleMode(isFree)
    }
    window.addEventListener('keydown', down)
    // X del mando = tecla E (subir / bajar), por flanco
    let raf = 0
    let prevX = false
    const poll = () => {
      raf = requestAnimationFrame(poll)
      const x = !uiBlocking() && !!readPad()?.interact
      if (x && !prevX) toggleMode(isFree)
      prevX = x
    }
    raf = requestAnimationFrame(poll)
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
      routeSpot: (sAlong: number) => { // DEV: punto de la calzada a `sAlong` m de la base, en el carril propio
        const p = pointAt(sAlong)
        return roadSpawn(p.x, p.z)
      },
      flipTruck: () => body.current?.setRotation({ x: 0, y: 0, z: 1, w: 0 }, true), // boca abajo (test del respawn por vuelco)
      setTilt: (seconds: number) => (tilt.current = seconds), // para probar el respawn por vuelco sin esperar
    })
    return () => {
      window.removeEventListener('keydown', down)
      cancelAnimationFrame(raf)
    }
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
        c.setWheelSideFrictionStiffness(i, 1.4) // agarre lateral algo mayor: menos deriva y menos vuelco en curva
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
    truckSpeed.current = speed
    // a pie: estacionada (freno puesto)
    const drive = mode === 'truck' ? readDrive() : { throttle: 0, steer: 0, brake: true }
    const t0 = rb.translation()
    const cmd = driveCommand(drive, speed, inLocacion(t0.x, t0.z, 15) ? TRUCK.maxSpeed : TRUCK.roadSpeed) // en la locación, a paso de hombre
    steerNow.current = approach(steerNow.current, cmd.steer, STEER_RATE * FIXED_DT)
    braking.current = mode === 'truck' && cmd.brake > TRUCK.idleBrake
    for (let i = 0; i < WHEEL_POINTS.length; i++) {
      c.setWheelEngineForce(i, ENGINE_SIGN * cmd.engine)
      c.setWheelBrake(i, cmd.brake)
      if (i < 2) c.setWheelSteering(i, STEER_SIGN * steerNow.current)
    }
    c.updateVehicle(FIXED_DT, rapier.QueryFilterFlags.EXCLUDE_SENSORS, TRUCK_GROUPS)

    const t = rb.translation()
    const ground: Vec3 = [t.x, t.y - TRUCK.rideHeight, t.z]
    tilt.current = tiltTimer(tilt.current, inclinationDeg(q), FIXED_DT)
    if (tilt.current >= TRUCK.tiltSeconds || needsRespawn(ground, WORLD_BOUNDS, terrainY(ground[0], ground[2]))) {
      tilt.current = 0
      respawnTruck()
      return
    }
    usePlayerStore.setState({ truck: { position: ground, heading: headingOf(q) } })
    if (mode === 'truck') {
      const limit = drive.throttle !== 0 && atLimit(ground, TRUCK.halfLength + 0.5, WORLD_BOUNDS) // QA D-11
      usePlayerStore.setState(usePlayerStore.getState().atLimit !== limit ? { position: ground, atLimit: limit } : { position: ground })
    }
  })

  // Ruedas: altura de suspensión, giro y dirección; y cabeceo/balanceo del modelo (todo cosmético, no toca la física).
  useFrame((_, dt) => {
    const c = ctl.current
    const rb = body.current
    if (!c || !rb) return
    if (dt > 0) {
      const l = lean.current
      const speed = truckSpeed.current
      const k = 1 - Math.exp(-6 * Math.min(dt, 0.1))
      l.acc += ((speed - l.speed) / dt - l.acc) * k // aceleración longitudinal filtrada
      l.speed = speed
      const t = leanTarget(l.acc, rb.angvel().y * speed)
      l.pitch += (t.pitch - l.pitch) * k
      l.roll += (t.roll - l.roll) * k
      model.body.rotation.set(l.pitch, 0, l.roll)
      model.tailMat.emissiveIntensity = braking.current ? 2.2 : night.current ? 0.8 : 0.25
    }
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
      <CuboidCollider args={[TRUCK.halfWidth, 0.3, TRUCK.halfLength]} position={[0, 0.1, 0]} mass={TRUCK.mass} collisionGroups={TRUCK_GROUPS} />
      <CuboidCollider args={[0.95, 0.4, 0.95]} position={[0, 0.65, 0]} density={0} collisionGroups={TRUCK_GROUPS} />
      <primitive object={model.group} />
    </RigidBody>
  )
}
