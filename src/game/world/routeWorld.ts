// Lo que puebla la ruta: base operativa, ciudad, semáforos, árboles, obstáculos, tránsito y animales. Todo inventado
// por el juego y generado con una semilla fija (igual en cada carga). Las posiciones que se mueven son función del
// tiempo de simulación: el dibujo y la colisión evalúan la misma función y no se desfasan.
import { BASE, LIGHTS_S, ROAD_HALF, ROUTE_END_S, pointAt, roadY, terrainY } from './route'

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
/** Punto a `side` m a la derecha del eje (negativo = izquierda) en `s`, apoyado en el terreno. */
export function beside(s: number, side: number, onRoad = false) {
  const p = pointAt(s)
  const x = p.x - p.tz * side
  const z = p.z + p.tx * side
  return { x, z, y: onRoad ? roadY(s) : terrainY(x, z), yaw: p.yaw }
}

// --- Edificios (caja: centro en el suelo, ancho a lo largo del camino, fondo, alto) ---
export type Box = { x: number; y: number; z: number; yaw: number; w: number; d: number; h: number; color: string }
const CITY = { from: 780, to: 3060 }
const WALLS = ['#b9b2a6', '#c8bca8', '#a8adb3', '#bfa58e', '#9aa6a0', '#d1c7b5', '#8f9499']
const CROSS_HALF = 6 // semi-ancho de las calles transversales
function buildings(): Box[] {
  const r = rng(7)
  const out: Box[] = []
  for (const side of [-1, 1])
    for (let s = CITY.from; s < CITY.to; ) {
      const w = 12 + r() * 12
      const d = 9 + r() * 8
      const h = r() < 0.2 ? 12 + r() * 10 : 3.5 + r() * 5
      const mid = s + w / 2
      // deja libres las bocacalles de los semáforos y la curva de la ciudad (ahí el frente de las casas se cruzaría)
      const clear = LIGHTS_S.every((l) => Math.abs(mid - l) > CROSS_HALF + w / 2 + 3)
      if (clear && r() > 0.12) {
        const p = beside(mid, side * (ROAD_HALF + 5 + d / 2 + r() * 3))
        out.push({ x: p.x, y: p.y, z: p.z, yaw: p.yaw, w, d, h, color: WALLS[Math.floor(r() * WALLS.length)] })
      }
      s += w + 2 + r() * 7
    }
  return out
}
// Base operativa: galpón, oficinas y depósito alrededor del playón, del lado derecho del arranque.
function baseBuildings(): Box[] {
  const at = (along: number, side: number, w: number, d: number, h: number, color: string): Box => {
    const p = beside(40 + along, side)
    return { x: p.x, y: p.y, z: p.z, yaw: p.yaw, w, d, h, color }
  }
  return [at(-6, 62, 34, 16, 8, '#8e969c'), at(34, 54, 16, 9, 3.6, '#d7d2c4'), at(-38, 44, 12, 12, 5, '#a38a6f'), at(48, 30, 6, 6, 3, '#c2b8a6')]
}
export const BUILDINGS: Box[] = [...baseBuildings(), ...buildings()]

// --- Semáforos: 24 s de ciclo (10 verde, 3 amarillo, 11 rojo), desfasados entre sí ---
export const LIGHT_CYCLE = { green: 10, yellow: 3, red: 11 }
const CYCLE = LIGHT_CYCLE.green + LIGHT_CYCLE.yellow + LIGHT_CYCLE.red
export type LightState = 'green' | 'yellow' | 'red'
export function lightState(i: number, t: number): LightState {
  const u = (((t + i * 9) % CYCLE) + CYCLE) % CYCLE
  return u < LIGHT_CYCLE.green ? 'green' : u < LIGHT_CYCLE.green + LIGHT_CYCLE.yellow ? 'yellow' : 'red'
}
/** Poste del semáforo `i`: a la derecha, antes de la bocacalle. */
export const lightPost = (i: number) => beside(LIGHTS_S[i] - CROSS_HALF - 2, ROAD_HALF + 1.2)

// --- Árboles y arbustos ---
export type Plant = { x: number; y: number; z: number; s: number; h: number; kind: 'alamo' | 'arbusto' }
function plants(): Plant[] {
  const r = rng(21)
  const out: Plant[] = []
  const add = (s: number, side: number, h: number, kind: Plant['kind']) => {
    const p = beside(s, side)
    out.push({ x: p.x, y: p.y, z: p.z, s, h, kind })
  }
  // cortinas de álamos de las chacras, a los dos lados; y arbolado ralo en la ciudad y la base
  for (let s = 3150; s < 5550; s += 11) for (const side of [-1, 1]) if (r() > 0.1) add(s, side * (ROAD_HALF + 5 + r() * 1.5), 11 + r() * 6, 'alamo')
  for (let s = 60; s < CITY.to; s += 37) if (r() > 0.45) add(s, (r() < 0.5 ? -1 : 1) * (ROAD_HALF + 2.2), 6 + r() * 4, 'alamo')
  // jarillas y coirones de la estepa, las bardas y la sierra
  for (let s = 5200; s < 19300; s += 9) for (const side of [-1, 1]) if (r() > 0.25) add(s + r() * 9, side * (ROAD_HALF + 3 + r() ** 2 * 70), 0.6 + r() * 1.1, 'arbusto')
  return out
}
export const PLANTS: Plant[] = plants()

// --- Obstáculos fijos sobre la calzada o al borde ---
export type Obstacle = { x: number; y: number; z: number; yaw: number; s: number; kind: 'roca' | 'cono' | 'valla' | 'guardaganado'; r: number }
function obstacles(): Obstacle[] {
  const r = rng(99)
  const out: Obstacle[] = []
  const add = (s: number, side: number, kind: Obstacle['kind'], rad: number) => {
    const p = beside(s, side, true)
    out.push({ x: p.x, y: p.y, z: p.z, yaw: p.yaw, s, kind, r: rad })
  }
  // desprendimientos en las bardas y la sierra: rocas que ocupan parte de un carril
  for (let s = 9900; s < 18600; s += 380 + r() * 420) add(s, (r() < 0.5 ? -1 : 1) * (1.2 + r() * 2.6), 'roca', 0.5 + r() * 0.7)
  // obra en la ciudad: vallas y conos que cierran el carril derecho
  for (let k = 0; k < 5; k++) add(2180 + k * 6, 1.4 + k * 0.35, 'cono', 0.25)
  for (let k = 0; k < 3; k++) add(2212 + k * 7, 2.6, 'valla', 0.9)
  // guardaganados al entrar a la estepa y antes de la llegada (franja a lo ancho; no frena, sacude)
  for (const s of [5650, 18850]) add(s, 0, 'guardaganado', ROAD_HALF)
  return out
}
export const OBSTACLES: Obstacle[] = obstacles()

// --- Tránsito: autos y camiones que recorren la ruta en los dos sentidos ---
export type Vehicle = { kind: 'auto' | 'camion'; dir: 1 | -1; speed: number; phase: number; color: string; len: number; wid: number; hgt: number }
const LANE = 2.25
const T_FROM = 500
const T_SPAN = 18300 // circulan entre la base y el pie de la meseta, no entran a la locación
const PAINT = ['#b23a2e', '#d8d8d4', '#2f3b46', '#c9a227', '#5b6f52', '#7d7f86', '#1f4f8a']
function vehicles(): Vehicle[] {
  const r = rng(404)
  return Array.from({ length: 26 }, (_, i) => {
    const camion = r() < 0.35
    return {
      kind: camion ? 'camion' : 'auto',
      dir: i % 2 ? 1 : -1,
      speed: camion ? 13 + r() * 5 : 17 + r() * 7,
      phase: (i / 26) * T_SPAN + r() * 300,
      color: camion ? '#d9d6cf' : PAINT[Math.floor(r() * PAINT.length)],
      len: camion ? 9.5 : 4.4,
      wid: camion ? 2.5 : 1.9,
      hgt: camion ? 3.4 : 1.5,
    } as Vehicle
  })
}
export const VEHICLES: Vehicle[] = vehicles()
/** Dónde está el vehículo `v` a los `t` segundos: en su carril (se circula por la derecha) y mirando hacia donde va. */
export function vehicleAt(v: Vehicle, t: number) {
  const u = (((v.phase + v.dir * v.speed * t) % T_SPAN) + T_SPAN) % T_SPAN
  const s = T_FROM + u
  const p = pointAt(s)
  return { x: p.x - p.tz * LANE * v.dir, y: roadY(s), z: p.z + p.tx * LANE * v.dir, yaw: v.dir > 0 ? p.yaw : p.yaw + Math.PI, s }
}

// --- Animales: tropillas a los costados; algunos cruzan la calzada de un lado al otro ---
export type Animal = { kind: 'guanaco' | 'oveja' | 'caballo'; s: number; side: number; cross: number; period: number; phase: number; scale: number }
function animals(): Animal[] {
  const r = rng(555)
  const out: Animal[] = []
  const herd = (kind: Animal['kind'], s: number, n: number, crossers: number) => {
    const side = r() < 0.5 ? -1 : 1
    for (let k = 0; k < n; k++)
      out.push({
        kind,
        s: s + (r() - 0.5) * 34,
        side: side * (ROAD_HALF + 6 + r() * 26),
        cross: k < crossers ? 1 : 0,
        period: 26 + r() * 20,
        phase: r() * 60,
        scale: 0.85 + r() * 0.3,
      })
  }
  for (const s of [3900, 4800]) herd('oveja', s, 7, 2)
  for (const s of [6400, 7900, 9100, 11200, 13300, 15800, 17600]) herd('guanaco', s, 4 + Math.floor(r() * 3), 1 + Math.floor(r() * 2))
  for (const s of [5300, 8500]) herd('caballo', s, 3, 1)
  return out
}
export const ANIMALS: Animal[] = animals()
/** Dónde está el animal `a` a los `t` segundos. Los que cruzan van y vuelven de un lado al otro del camino, despacio. */
export function animalAt(a: Animal, t: number) {
  const w = a.cross ? Math.cos(((t + a.phase) / a.period) * Math.PI * 2) : 1
  const side = a.side * w
  const p = beside(a.s, side)
  const going = a.cross ? -Math.sin(((t + a.phase) / a.period) * Math.PI * 2) * Math.sign(a.side) : 0
  // mira hacia donde camina (cruzando) o a lo largo del camino (pastando)
  return { x: p.x, y: p.y, z: p.z, yaw: going === 0 ? p.yaw + a.phase : p.yaw + (going > 0 ? -Math.PI / 2 : Math.PI / 2), side }
}
export const ANIMAL_SIZE = { guanaco: [0.5, 1.7, 1.5], oveja: [0.55, 0.9, 1.0], caballo: [0.6, 1.8, 2.2] } as const // ancho, alto, largo

/** Reloj de la simulación de la ruta (s). Lo avanza el paso de física: con la pausa, tránsito y animales se detienen. */
export const routeClock = { t: 0 }
export const BASE_CENTER = BASE.center
export const ROUTE_WORLD_END = ROUTE_END_S
