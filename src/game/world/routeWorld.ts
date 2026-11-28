// Lo que puebla la ruta: base operativa, ciudad, semáforos, árboles, obstáculos, tránsito y animales. Todo inventado
// por el juego y generado con una semilla fija (igual en cada carga). Las posiciones que se mueven son función del
// tiempo de simulación: el dibujo y la colisión evalúan la misma función y no se desfasan.
import { BASE, LIGHTS_S, ROAD_HALF, ROUTE_END_S, nearest, pointAt, roadY, terrainY } from './route'

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
/** `model`: modelo del kit (public/models/ruta/kenney.glb) a escala `scale`, con el frente hacia `face`; sin modelo, una caja. */
export type Box = { x: number; y: number; z: number; yaw: number; w: number; d: number; h: number; color: string; s?: number; model?: string; scale?: number; face?: number }
export const CITY = { from: 780, to: 3060 }
export const CROSS_HALF = 6 // semi-ancho de las calles transversales
export const SIDEWALK = 5.5 // ancho de la vereda de la ciudad

// Medidas (ancho, alto, fondo) de los modelos de Kenney (CC0, NOTICE.md), en unidades del kit: un piso ≈ 0,4.
const dims = (prefix: string, rows: string) =>
  Object.fromEntries(rows.split(' ').map((r) => r.split(':')).map(([k, v]) => [prefix + k, v.split(',').map(Number) as [number, number, number]]))
export const KIT: Record<string, [number, number, number]> = {
  ...dims('building-', 'a:.88,1.29,.94 b:.98,1.29,.94 c:.88,.89,1.1 d:.84,1.29,.9 e:1.64,.89,1 f:.84,1.69,1.03 g:.98,1.69,.92 h:.88,1.29,1 i:1.24,1.68,1.3 k:2.08,1.47,.94 l:1.38,2.27,1.4 m:1.24,3.15,1.24'),
  ...dims('building-skyscraper-', 'a:1.36,2.88,1.36 b:1.36,4.48,1.36 c:1.28,4.08,1.38 d:1.28,5.47,1.38 e:1.3,4.08,1.24'),
  ...dims('building-type-', 'a:1.3,.83,1.02 b:1.82,1.14,1.14 c:1.28,1.03,1.02 d:1.76,1.24,1.02 e:1.3,1.14,1.02 f:1.42,1.14,1.4 g:1.46,.77,1.18 h:1.3,.74,.92 i:1.28,.74,1.02 j:1.38,1.04,.92 k:.92,1.15,1.02 l:1.04,1.05,1.02 m:1.42,.74,1.42 n:1.78,1.14,1.38 o:1.27,1.14,1.02 p:1.24,.92,1 q:1.24,.92,.88 r:1.02,1.14,1.02 s:1.4,1.14,1.08 t:1.31,1.16,1.4 u:1.42,1.14,1.08'),
  ...dims('low-detail-building-', 'a:.5,2,.5 b:.5,2.23,.5 c:.5,2.25,.5 d:.5,1.75,.5 e:.5,1.8,.5 f:.5,2,.5 g:.5,2,.5 h:.5,2.1,.5 i:.5,1.77,.5 j:.5,1.75,.5 k:.5,1.55,.5 l:.5,1.85,.5 m:.5,1.98,.5'),
}
const named = (prefix: string, ids: string) => [...ids].map((c) => prefix + c)
const HOUSES = named('building-type-', 'abcdefghijklmnopqrstu')
const SHOPS = named('building-', 'abcdeh')
const MID = named('building-', 'fgiklm')
const TOWERS = named('building-skyscraper-', 'abcde')
const FAR = named('low-detail-building-', 'abcdefghijklm')
const CENTRO = { from: 1450, to: 2400 }

// Ciudad: casas en los barrios y comercios en el centro sobre la avenida; una segunda fila detrás (torres en el centro) y,
// más lejos, la silueta de edificios de pocos triángulos.
function buildings(): Box[] {
  const r = rng(7)
  const out: Box[] = []
  const pick = (l: string[]) => l[Math.floor(r() * l.length)]
  const centro = (s: number) => s > CENTRO.from && s < CENTRO.to
  const row = (from: number, to: number, off: number, gap: number, skip: number, scale: number, choose: (s: number) => string) => {
    for (const side of [-1, 1])
      for (let s = from; s < to; ) {
        const model = choose(s)
        const [mx, my, mz] = KIT[model]
        const w = mx * scale
        const d = mz * scale
        const mid = s + w / 2
        const c = pointAt(mid)
        const o = side * (ROAD_HALF + off + d / 2)
        const x = c.x - c.tz * o
        const z = c.z + c.tx * o
        // libres: las bocacalles, la calzada del lado de adentro de las curvas, y el lugar de otro edificio
        const clear =
          LIGHTS_S.every((l) => Math.abs(mid - l) > CROSS_HALF + w / 2 + 3) &&
          nearest(x, z).d > ROAD_HALF + off + d / 2 - 1 &&
          out.every((b) => Math.hypot(b.x - x, b.z - z) > (b.w + w) * 0.45)
        if (clear && r() >= skip) out.push({ x, y: terrainY(x, z), z, yaw: c.yaw, w, d, h: my * scale, color: '#fff', s: mid, model, scale, face: Math.atan2(c.tz * o, -c.tx * o) })
        s += w + gap * (0.4 + r())
      }
  }
  row(CITY.from, CITY.to, SIDEWALK + 0.5, 3, 0.06, 8, (s) => (centro(s) ? pick(r() < 0.3 ? MID : SHOPS) : pick(r() < 0.15 ? SHOPS : HOUSES)))
  row(CITY.from, CITY.to, 30, 6, 0.25, 8, (s) => (centro(s) ? pick(r() < 0.35 ? TOWERS : MID) : pick(HOUSES)))
  row(CENTRO.from - 150, CENTRO.to + 150, 62, 14, 0.2, 16, () => pick(FAR))
  return out
}
// Base operativa: galpón, oficinas y depósito alrededor del playón, del lado derecho del arranque.
function baseBuildings(): Box[] {
  const at = (along: number, side: number, model: string, scale: number): Box => {
    const p = beside(40 + along, side)
    const c = pointAt(40 + along)
    const [mx, my, mz] = KIT[model]
    return { x: p.x, y: p.y, z: p.z, yaw: p.yaw, w: mx * scale, d: mz * scale, h: my * scale, color: '#fff', s: 40 + along, model, scale, face: Math.atan2(c.tz, -c.tx) }
  }
  // galpón, oficinas, depósito y garita
  return [at(-6, 62, 'building-e', 18), at(34, 56, 'building-k', 9), at(-38, 46, 'building-c', 11), at(48, 30, 'building-type-h', 5)]
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
/** `model`: modelo del kit de autos de Kenney (frente hacia +Z), dibujado a escala `scale`. */
export type Vehicle = { kind: 'auto' | 'camion'; dir: 1 | -1; speed: number; phase: number; color: string; len: number; wid: number; hgt: number; model: string; scale: number }
const CARS = ['sedan', 'suv', 'truck', 'suv-luxury', 'van', 'hatchback-sports', 'taxi', 'truck', 'police', 'sedan', 'ambulance']
// modelo, escala, largo, ancho, alto. La cisterna (generada, NOTICE.md) viene normalizada a 1 m de largo.
const TRUCKS: [string, number, number, number, number][] = [
  ['cisterna', 8.6, 8.6, 2.9, 3.2],
  ['delivery-flat', 1.75, 5.9, 2.7, 2.9],
  ['truck-flat', 1.75, 5.9, 2.7, 2.9],
  ['cisterna', 8.6, 8.6, 2.9, 3.2],
  ['garbage-truck', 1.75, 5.9, 2.7, 2.9],
  ['firetruck', 1.75, 5.9, 2.7, 2.9],
]
const LANE = 2.25
const T_FROM = 500
const T_SPAN = 18300 // circulan entre la base y el pie de la meseta, no entran a la locación
const PAINT = ['#b23a2e', '#d8d8d4', '#2f3b46', '#c9a227', '#5b6f52', '#7d7f86', '#1f4f8a']
function vehicles(): Vehicle[] {
  const r = rng(404)
  return Array.from({ length: 26 }, (_, i) => {
    const camion = r() < 0.35
    const t = TRUCKS[i % TRUCKS.length]
    return {
      kind: camion ? 'camion' : 'auto',
      dir: i % 2 ? 1 : -1,
      speed: camion ? 13 + r() * 5 : 17 + r() * 7,
      phase: (i / 26) * T_SPAN + r() * 300,
      color: camion ? '#d9d6cf' : PAINT[Math.floor(r() * PAINT.length)],
      len: camion ? t[2] : 3.7,
      wid: camion ? t[3] : 1.95,
      hgt: camion ? t[4] : 1.7,
      model: camion ? t[0] : CARS[i % CARS.length],
      scale: camion ? t[1] : 1.3,
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
