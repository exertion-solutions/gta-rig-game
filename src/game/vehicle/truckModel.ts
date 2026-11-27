import * as THREE from 'three'
import type { Vec3 } from '../player/movement'

// Valores arcade, sin pretensión realista. Chasis en el origen del cuerpo; la camioneta mira a -Z local (convención three).
export const TRUCK = {
  maxSpeed: 12, // m/s
  maxReverse: 5,
  wheelBase: 2.9, // distancia entre ejes
  halfWidth: 1.0,
  halfLength: 2.3,
  wheelRadius: 0.4,
  wheelWidth: 0.3,
  suspensionRest: 0.3,
  connectionY: -0.1, // altura del anclaje de rueda respecto del centro del chasis
  rideHeight: 0.8, // centro del chasis sobre el suelo en reposo (= -connectionY + descanso + radio)
  mass: 1200,
  engineForce: 1500, // por rueda (4x4)
  brakeForce: 30,
  idleBrake: 8,
  maxSteer: 0.55, // rad, parada
  maxPitch: 0.05, // rad: cabeceo cosmético máximo
  maxRoll: 0.06, // rad: balanceo cosmético máximo
  tiltLimitDeg: 60,
  tiltSeconds: 3,
} as const

// Anclajes de rueda [x, y, z] en el chasis: delanteras (z<0) primero, luego traseras.
export const WHEEL_POINTS: Vec3[] = [
  [-TRUCK.halfWidth, TRUCK.connectionY, -TRUCK.wheelBase / 2 - 0.05],
  [TRUCK.halfWidth, TRUCK.connectionY, -TRUCK.wheelBase / 2 - 0.05],
  [-TRUCK.halfWidth, TRUCK.connectionY, TRUCK.wheelBase / 2 - 0.05],
  [TRUCK.halfWidth, TRUCK.connectionY, TRUCK.wheelBase / 2 - 0.05],
]

// Giro máximo (rad): amplio parado y cerrado a velocidad, para no volcar en curva.
export const steerLimit = (speed: number) => TRUCK.maxSteer / (1 + (Math.abs(speed) * 0.2) ** 1.5 * 1.2)

// Mueve `v` hacia `target` como mucho `step` (sin pasarse).
export const approach = (v: number, target: number, step: number) => (Math.abs(target - v) <= step ? target : v + Math.sign(target - v) * step)

// Cabeceo y balanceo cosmético del modelo (rad) según aceleración longitudinal (+ = acelera) y lateral (+ = hacia la
// izquierda, o sea giro a la izquierda). Frenar baja la trompa (pitch < 0); en curva el cuerpo se inclina hacia afuera.
export function leanTarget(longAccel: number, latAccel: number) {
  const c = (v: number, m: number) => Math.max(-m, Math.min(m, v))
  return { pitch: c(longAccel * 0.008, TRUCK.maxPitch), roll: c(-latAccel * 0.01, TRUCK.maxRoll) }
}

// Faros de noche: de 18:30 a 6:30 (el sol sale a las 6 y se pone a las 18, ver DayNight).
export const headlightsOn = (hour: number) => hour >= 18.5 || hour < 6.5

// Mapea input a fuerzas por rueda. speed = velocidad firmada hacia adelante (m/s). Corta la fuerza al llegar al tope.
export function driveCommand(i: { throttle: number; steer: number; brake: boolean }, speed: number) {
  const limit = i.throttle >= 0 ? TRUCK.maxSpeed : TRUCK.maxReverse
  let engine = 0
  let brake = 0
  if (i.brake) brake = TRUCK.brakeForce
  else if (i.throttle === 0) brake = TRUCK.idleBrake
  else if (i.throttle * speed < -0.5) brake = TRUCK.brakeForce // pide ir al revés: primero frena
  else if (Math.abs(speed) < limit) engine = i.throttle * TRUCK.engineForce * (1 - 0.55 * (Math.abs(speed) / limit) ** 2) // par que decae hacia el tope
  const steer = i.steer * steerLimit(speed)
  return { engine, brake, steer }
}

// Ángulo entre el "arriba" del chasis y el arriba del mundo, en grados (0 = plano, 180 = volcada).
export function inclinationDeg(q: { x: number; y: number; z: number; w: number }) {
  const upY = 1 - 2 * (q.x * q.x + q.z * q.z)
  return (Math.acos(Math.min(1, Math.max(-1, upY))) * 180) / Math.PI
}

// Segundos seguidos con inclinación > límite; se reinicia al enderezarse.
export const tiltTimer = (t: number, incl: number, dt: number) => (incl > TRUCK.tiltLimitDeg ? t + dt : 0)


// Nodos de rueda de pickup.glb, en el mismo orden que WHEEL_POINTS.
const WHEEL_KEYS = ['FL', 'FR', 'RL', 'RR']

/**
 * Arma el modelo de la camioneta sobre la escena de `public/models/vehicle/pickup.glb` (scripts/build-truck.py; original,
 * sin marcas ni texto). `body` agrupa todo menos las ruedas (se inclina con la suspensión visual); cada rueda es un
 * `wheel_*` (dirección + altura) con hijo `tire_*`, que gira sobre X. Si el GLB cambia de estructura, falla acá.
 */
export function truckModelFrom(group: THREE.Object3D) {
  const need = (name: string) => {
    const o = group.getObjectByName(name)
    if (!o) throw new Error(`pickup.glb: falta el nodo "${name}"`)
    return o
  }
  const body = need('body')
  const wheels = WHEEL_KEYS.map((k) => ({ pivot: need(`wheel_${k}`), tire: need(`tire_${k}`) }))
  const mats: Record<string, THREE.MeshStandardMaterial> = {}
  group.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const mat = m.material as THREE.MeshStandardMaterial
    mats[mat.name] = mat
    m.castShadow = !mat.name.endsWith('light')
  })
  const headMat = mats.truck_headlight
  const tailMat = mats.truck_taillight
  if (!headMat || !tailMat) throw new Error('pickup.glb: faltan los materiales truck_headlight / truck_taillight')
  // haz de los faros: apagado de día (visible=false para no sumar una luz al resto de los materiales).
  // La escena viene de la caché de useGLTF: si ya tiene el haz (remontaje), se reusa.
  let beam = body.getObjectByName('truck_beam') as THREE.SpotLight | undefined
  if (!beam) {
    beam = new THREE.SpotLight('#fff3d0', 0, 40, 0.55, 0.6, 1.5)
    beam.name = 'truck_beam'
    beam.position.set(0, 0.25, -2.3)
    beam.target.position.set(0, -0.5, -14)
    beam.visible = false
    body.add(beam, beam.target)
  }
  return { group, body, wheels, headMat, tailMat, beam }
}
