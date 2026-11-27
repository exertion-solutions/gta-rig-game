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


const clearcoat = (color: string) => new THREE.MeshPhysicalMaterial({ color, metalness: 0.6, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.12 })
const std = (color: string, roughness: number, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  return mesh
}
// Perfil lateral [z, y] (frente = z negativo) extruido a lo ancho `w`, centrado en x, con un bisel chico para que tome luz como chapa.
function extrude(profile: [number, number][], w: number, m: THREE.Material, bevel = 0.04) {
  const shape = new THREE.Shape(profile.map(([z, y]) => new THREE.Vector2(z, y)))
  const depth = w - 2 * bevel
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 1 })
  g.rotateY(-Math.PI / 2) // x' = -z, z' = x: el perfil queda con z a lo largo y la extrusión a lo ancho
  g.translate(depth / 2, 0, 0)
  const mesh = new THREE.Mesh(g, m)
  mesh.castShadow = true
  return mesh
}

// Camioneta modelada en código con primitivas (sin GLB, sin marcas ni texto): capot, cabina, vidrios, caja, paragolpes,
// faros, luces traseras, espejos y ruedas con llanta. `body` agrupa todo menos las ruedas (se inclina con la suspensión
// visual); cada rueda va en un grupo `pivot` (dirección + altura) con la goma `tire`, que gira sobre X.
export function buildTruckModel() {
  const group = new THREE.Group()
  const body = new THREE.Group()
  group.add(body)
  const paint = clearcoat('#2d5f8f')
  const dark = std('#23262b', 0.8, 0.2)
  const chrome = std('#b9bec5', 0.25, 0.9)
  const glass = new THREE.MeshStandardMaterial({ color: '#16222d', roughness: 0.05, metalness: 0.85, side: THREE.DoubleSide })
  const rubber = std('#141414', 0.95)
  const headMat = new THREE.MeshStandardMaterial({ color: '#f4f1e6', emissive: '#fff2c0', emissiveIntensity: 0.1, roughness: 0.15 })
  const tailMat = new THREE.MeshStandardMaterial({ color: '#7a0d0d', emissive: '#ff1a1a', emissiveIntensity: 0.25, roughness: 0.3 })

  body.add(box(1.76, 0.42, 4.4, 0, -0.14, 0, dark)) // piso / chasis
  body.add(extrude([[-2.2, -0.34], [-2.2, 0.3], [-1.85, 0.44], [-1.0, 0.5], [-1.0, -0.34]], 1.86, paint)) // capot y trompa
  body.add(extrude([[-1.0, -0.34], [-1.0, 0.5], [-0.72, 1.12], [0.3, 1.16], [0.5, 0.5], [0.5, -0.34]], 1.84, paint)) // cabina
  // vidrios: parabrisas y luneta (planos inclinados como la chapa) y laterales
  const screen = (w: number, dz: number, dy: number, z: number, y: number) => {
    const n = Math.hypot(dz, dy)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, n - 0.08), glass)
    m.rotation.x = Math.atan2(dz, dy)
    m.position.set(0, y + (dz / n) * 0.015, z - (dy / n) * 0.015) // 1,5 cm hacia afuera de la chapa
    return m
  }
  body.add(screen(1.6, 0.28, 0.62, -0.86, 0.81)) // parabrisas
  body.add(screen(1.4, -0.2, 0.66, 0.4, 0.83)) // luneta
  for (const sx of [-1, 1]) {
    const side = extrude([[-0.85, 0.58], [-0.66, 1.06], [0.22, 1.1], [0.38, 0.58]], 0.02, glass, 0)
    side.position.x = sx * 0.93
    side.castShadow = false
    body.add(side)
  }
  // caja: piso, laterales, frente y compuerta
  body.add(box(1.76, 0.1, 1.95, 0, 0.12, 1.4, dark))
  for (const sx of [-1, 1]) {
    const wall = extrude([[0.5, 0.1], [0.5, 0.62], [2.3, 0.62], [2.3, 0.1]], 0.1, paint, 0.015)
    wall.position.x = sx * 0.9
    body.add(wall)
  }
  body.add(box(1.86, 0.5, 0.08, 0, 0.36, 2.28, paint))
  body.add(box(1.86, 0.5, 0.08, 0, 0.36, 0.52, paint))
  // guardabarros: media caña abierta sobre cada rueda
  for (const p of WHEEL_POINTS) {
    const fender = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.32, 14, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), paint)
    fender.position.set(p[0], p[1] - TRUCK.suspensionRest, p[2])
    fender.castShadow = true
    body.add(fender)
  }
  // paragolpes, parrilla, faros, luces traseras y espejos
  body.add(box(1.96, 0.2, 0.18, 0, -0.2, -2.28, chrome))
  body.add(box(1.96, 0.2, 0.18, 0, -0.2, 2.34, chrome))
  body.add(box(1.0, 0.16, 0.05, 0, 0.2, -2.22, dark))
  const headlights = [-1, 1].map((sx) => {
    const m = box(0.34, 0.16, 0.06, sx * 0.68, 0.24, -2.22, headMat)
    m.castShadow = false
    body.add(m)
    return m
  })
  const taillights = [-1, 1].map((sx) => {
    const m = box(0.26, 0.2, 0.05, sx * 0.76, 0.42, 2.34, tailMat)
    m.castShadow = false
    body.add(m)
    return m
  })
  for (const sx of [-1, 1]) {
    body.add(box(0.16, 0.04, 0.04, sx * 1.0, 0.78, -0.8, dark)) // brazo
    body.add(box(0.08, 0.16, 0.2, sx * 1.1, 0.82, -0.82, paint)) // espejo
  }

  const rimMat = std('#c3c7cd', 0.3, 0.85)
  const wheels = WHEEL_POINTS.map((p) => {
    const pivot = new THREE.Group()
    pivot.position.set(p[0], p[1] - TRUCK.suspensionRest, p[2])
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(TRUCK.wheelRadius, TRUCK.wheelRadius, TRUCK.wheelWidth, 20).rotateZ(Math.PI / 2), rubber)
    tire.castShadow = true
    tire.add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, TRUCK.wheelWidth + 0.02, 14).rotateZ(Math.PI / 2), rimMat))
    for (let k = 0; k < 5; k++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(TRUCK.wheelWidth + 0.04, 0.05, 0.4), dark) // radios: se ve el giro
      spoke.rotation.x = (k * Math.PI) / 5
      tire.add(spoke)
    }
    pivot.add(tire)
    group.add(pivot)
    return { pivot, tire }
  })
  // haz de los faros: apagado de día (visible=false para no sumar una luz al resto de los materiales)
  const beam = new THREE.SpotLight('#fff3d0', 0, 40, 0.55, 0.6, 1.5)
  beam.position.set(0, 0.25, -2.3)
  beam.target.position.set(0, -0.5, -14)
  beam.visible = false
  body.add(beam, beam.target)
  return { group, body, wheels, headlights, taillights, headMat, tailMat, beam }
}
