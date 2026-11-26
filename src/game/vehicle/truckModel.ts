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
  maxSteer: 0.5, // rad
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

// Mapea input a fuerzas por rueda. speed = velocidad firmada hacia adelante (m/s). Corta la fuerza al llegar al tope.
export function driveCommand(i: { throttle: number; steer: number; brake: boolean }, speed: number) {
  const limit = i.throttle >= 0 ? TRUCK.maxSpeed : TRUCK.maxReverse
  let engine = 0
  let brake = 0
  if (i.brake) brake = TRUCK.brakeForce
  else if (i.throttle === 0) brake = TRUCK.idleBrake
  else if (i.throttle * speed < -0.5) brake = TRUCK.brakeForce // pide ir al revés: primero frena
  else if (Math.abs(speed) < limit) engine = i.throttle * TRUCK.engineForce
  const steer = i.steer * (TRUCK.maxSteer / (1 + Math.abs(speed) * 0.08))
  return { engine, brake, steer }
}

// Ángulo entre el "arriba" del chasis y el arriba del mundo, en grados (0 = plano, 180 = volcada).
export function inclinationDeg(q: { x: number; y: number; z: number; w: number }) {
  const upY = 1 - 2 * (q.x * q.x + q.z * q.z)
  return (Math.acos(Math.min(1, Math.max(-1, upY))) * 180) / Math.PI
}

// Segundos seguidos con inclinación > límite; se reinicia al enderezarse.
export const tiltTimer = (t: number, incl: number, dt: number) => (incl > TRUCK.tiltLimitDeg ? t + dt : 0)

export function countTriangles(root: THREE.Object3D) {
  let n = 0
  root.traverse((o) => {
    const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined
    if (g) n += (g.index ? g.index.count : g.attributes.position.count) / 3
  })
  return n
}

const mat = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  return mesh
}

// Camioneta modelada en código con primitivas (sin GLB). Cada rueda va en un grupo `pivot` (dirección + altura)
// con la goma hija `tire`, que gira sobre X.
export function buildTruckModel() {
  const group = new THREE.Group()
  const body = mat('#c8372d')
  const dark = mat('#2a2d33')
  const glass = mat('#7fb4d6')
  group.add(box(2.0, 0.5, 4.6, 0, 0, 0, body)) // chasis
  group.add(box(1.9, 0.8, 1.5, 0, 0.65, -1.0, body)) // cabina
  group.add(box(1.7, 0.4, 0.05, 0, 0.8, -1.76, glass)) // parabrisas
  group.add(box(1.9, 0.12, 2.2, 0, 0.31, 1.15, dark)) // piso de la caja
  group.add(box(0.08, 0.4, 2.2, -0.95, 0.5, 1.15, body)) // laterales
  group.add(box(0.08, 0.4, 2.2, 0.95, 0.5, 1.15, body))
  group.add(box(1.9, 0.4, 0.08, 0, 0.5, 2.26, body)) // compuerta
  const wheels = WHEEL_POINTS.map((p) => {
    const pivot = new THREE.Group()
    pivot.position.set(p[0], p[1] - TRUCK.suspensionRest, p[2])
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(TRUCK.wheelRadius, TRUCK.wheelRadius, TRUCK.wheelWidth, 16).rotateZ(Math.PI / 2), dark)
    tire.castShadow = true
    pivot.add(tire)
    group.add(pivot)
    return { pivot, tire }
  })
  return { group, wheels }
}
