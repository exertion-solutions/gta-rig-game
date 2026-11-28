// Ruta de la base operativa al equipo: trazado, perfil de alturas y terreno. Escenario inventado por el juego (no
// representa ningún camino ni lugar real): 20 km de manejo con ciudad, chacras, estepa, bardas y un paso de sierra.
// Todo es función pura de la posición: lo usan el render, la física (campo de alturas por tramos) y los tests.
import { LOCACION_BOUNDS as B } from './frame'

export const ROUTE_LENGTH = 20000 // m
export const ROAD_HALF = 4.5 // semi-ancho de la calzada
const STEP = 5 // m entre muestras del eje
const END: [number, number] = [-26, -34] // llega al Acceso de la locación (x −26), entrando hacia +Z

// Eje de diseño (m, sin escalar): sale de la base hacia +X y llega con rumbo +Z. Se escala para que mida ROUTE_LENGTH.
const DESIGN: [number, number][] = [
  [0, 0], [400, 0], [1000, 0], [1900, 0], [2300, 150], [2500, 600], [2500, 1400], [2500, 2200], // base y ciudad
  [2700, 3000], [3300, 3700], [4200, 4100], [5200, 4200], // chacras
  [6200, 4500], [7000, 5200], [7400, 6200], [8300, 6800], [9300, 6900], // estepa
  [9900, 7300], [10100, 8000], [10700, 8300], [11000, 8900], [10700, 9500], [11100, 10000], [11800, 10100], [12100, 10700], // bardas
  [12000, 11300], [12500, 11600], [12200, 12000], [12700, 12300], [12400, 12800], [12900, 13200], [13000, 13900], // sierra
  [13000, 14500], [13000, 15000], // llegada
]

const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t)

function polyline(pts: [number, number][], per = 40) {
  const out: [number, number][] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b, c, d] = [pts[Math.max(i - 1, 0)], pts[i], pts[i + 1], pts[Math.min(i + 2, pts.length - 1)]]
    for (let k = 0; k < per; k++) out.push([catmull(a[0], b[0], c[0], d[0], k / per), catmull(a[1], b[1], c[1], d[1], k / per)])
  }
  out.push(pts[pts.length - 1])
  return out
}
const lengthOf = (p: [number, number][]) => p.reduce((s, q, i) => (i ? s + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0), 0)

// Muestras cada STEP m a lo largo del eje, ya escalado y trasladado: xs[i], zs[i] en s = i·STEP.
function build() {
  const raw = polyline(DESIGN)
  const k = ROUTE_LENGTH / lengthOf(raw)
  const last = DESIGN[DESIGN.length - 1]
  const fine = polyline(DESIGN.map(([x, z]) => [END[0] + (x - last[0]) * k, END[1] + (z - last[1]) * k] as [number, number]))
  const n = Math.floor(lengthOf(fine) / STEP) + 1
  const xs = new Float32Array(n)
  const zs = new Float32Array(n)
  let acc = 0
  let j = 0
  for (let i = 1; i < fine.length && j < n; i++) {
    const seg = Math.hypot(fine[i][0] - fine[i - 1][0], fine[i][1] - fine[i - 1][1])
    while (j < n && j * STEP <= acc + seg) {
      const t = seg ? (j * STEP - acc) / seg : 0
      xs[j] = fine[i - 1][0] + (fine[i][0] - fine[i - 1][0]) * t
      zs[j] = fine[i - 1][1] + (fine[i][1] - fine[i - 1][1]) * t
      j++
    }
    acc += seg
  }
  return { xs: xs.subarray(0, j), zs: zs.subarray(0, j), n: j }
}
const R = build()
export const ROUTE_SAMPLES = R.n
export const ROUTE_END_S = (R.n - 1) * STEP

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Punto del eje en `s` (m desde la base): posición, tangente unitaria y rumbo (yaw del juego: frente = (−sen, −cos)). */
export function pointAt(s: number) {
  const f = clamp(s, 0, ROUTE_END_S) / STEP
  const i = Math.min(Math.floor(f), R.n - 2)
  const t = f - i
  const tx = R.xs[i + 1] - R.xs[i]
  const tz = R.zs[i + 1] - R.zs[i]
  const l = Math.hypot(tx, tz) || 1
  return { x: lerp(R.xs[i], R.xs[i + 1], t), z: lerp(R.zs[i], R.zs[i + 1], t), tx: tx / l, tz: tz / l, yaw: Math.atan2(-tx, -tz) }
}

// --- Tramos (m desde la base) ---
export type Zone = 'base' | 'ciudad' | 'chacras' | 'estepa' | 'bardas' | 'sierra' | 'llegada'
const ZONES: [Zone, number][] = [['base', 0], ['ciudad', 700], ['chacras', 3100], ['estepa', 5600], ['bardas', 9500], ['sierra', 14500], ['llegada', 18900]]
export const zoneAt = (s: number): Zone => ZONES.reduce((z, [name, from]) => (s >= from ? name : z), 'base' as Zone)
export const zoneStart = (z: Zone) => ZONES.find(([n]) => n === z)![1]
/** Asfalto en la base y la ciudad; ripio en el resto. */
export const paved = (s: number) => s < 3100
// peso 0..1 de un tramo, con bordes suaves de `soft` m
const within = (s: number, from: number, to: number, soft = 350) => smooth(from - soft, from + soft, s) * (1 - smooth(to - soft, to + soft, s))
export const LIGHTS_S = [1250, 1900, 2550] // semáforos de la ciudad (m desde la base)

// --- Perfil de alturas del camino: la locación queda en y = 0, arriba de la meseta ---
const PROFILE: [number, number][] = [
  [0, -180], [3100, -180], [5600, -168], [9500, -140], [12000, -118], [14500, -88], [16700, 30], [18700, 0], [ROUTE_LENGTH + 1, 0],
]
export function roadY(s: number) {
  const v = clamp(s, 0, ROUTE_LENGTH)
  let i = 0
  while (i < PROFILE.length - 2 && v >= PROFILE[i + 1][0]) i++
  const [s0, y0] = PROFILE[i]
  const [s1, y1] = PROFILE[i + 1]
  const base = lerp(y0, y1, smooth(s0, s1, v))
  // lomadas: nada en la base, la ciudad ni la llegada
  const w = within(v, 3400, 18400, 500)
  return base + w * (2.6 * Math.sin(v / 210) + 1.2 * Math.sin(v / 83 + 1.3))
}

// --- Punto del eje más cercano ---
const CELL = 64
const grid = new Map<number, number[]>()
const key = (cx: number, cz: number) => cx * 73856093 + cz * 19349663
for (let i = 0; i < R.n; i++) {
  const k = key(Math.floor(R.xs[i] / CELL), Math.floor(R.zs[i] / CELL))
  const l = grid.get(k)
  if (l) l.push(i)
  else grid.set(k, [i])
}
/** Punto del eje más cercano a (x, z): `s` (m desde la base), `d` (distancia) y `side` (+1 a la derecha del avance). */
export function nearest(x: number, z: number) {
  let best = -1
  let bd = Infinity
  const scan = (i: number) => {
    const d = (R.xs[i] - x) ** 2 + (R.zs[i] - z) ** 2
    if (d < bd) [bd, best] = [d, i]
  }
  const cx = Math.floor(x / CELL)
  const cz = Math.floor(z / CELL)
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) grid.get(key(cx + a, cz + b))?.forEach(scan)
  if (best < 0) {
    for (let i = 0; i < R.n; i += 16) scan(i)
    for (let i = Math.max(0, best - 16), e = Math.min(R.n - 1, best + 16); i <= e; i++) scan(i)
  }
  // refina sobre los dos segmentos vecinos
  let s = best * STEP
  let d = Math.sqrt(bd)
  let side = 1
  for (const i of [best - 1, best]) {
    if (i < 0 || i >= R.n - 1) continue
    const ax = R.xs[i]
    const az = R.zs[i]
    const ux = R.xs[i + 1] - ax
    const uz = R.zs[i + 1] - az
    const t = clamp(((x - ax) * ux + (z - az) * uz) / (ux * ux + uz * uz), 0, 1)
    const dd = Math.hypot(x - ax - ux * t, z - az - uz * t)
    if (dd <= d + 1e-9) {
      d = dd
      s = (i + t) * STEP
      side = ux * (z - az) - uz * (x - ax) >= 0 ? 1 : -1 // derecha del avance: (−tz, tx)·(p − a) > 0
    }
  }
  return { s, d, side }
}

// --- Terreno ---
const hash = (x: number, z: number) => {
  const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return h - Math.floor(h)
}
/** Ruido de valor suave en [−1, 1]. */
export function noise(x: number, z: number) {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const u = smooth(0, 1, x - xi)
  const v = smooth(0, 1, z - zi)
  return lerp(lerp(hash(xi, zi), hash(xi + 1, zi), u), lerp(hash(xi, zi + 1), hash(xi + 1, zi + 1), u), v) * 2 - 1
}

// Campo regional: altura del camino y peso de bardas y sierra interpolados sobre puntos del eje cada 400 m. No depende
// del "punto más cercano", así que no salta entre dos ramas del camino (curvas de la sierra).
const COARSE = Array.from({ length: Math.floor(ROUTE_LENGTH / 400) + 1 }, (_, i) => {
  const s = Math.min(i * 400, ROUTE_END_S)
  const p = pointAt(s)
  return { x: p.x, z: p.z, y: roadY(s), barda: within(s, 9500, 14700), sierra: within(s, 14300, 18800), llano: 1 - within(s, 3300, 18800, 400) }
})
function regional(x: number, z: number) {
  let w = 0
  let y = 0
  let barda = 0
  let sierra = 0
  let llano = 0
  for (const c of COARSE) {
    const k = 1 / ((c.x - x) ** 2 + (c.z - z) ** 2 + 400) ** 2
    w += k
    y += k * c.y
    barda += k * c.barda
    sierra += k * c.sierra
    llano += k * c.llano
  }
  return { y: y / w, barda: barda / w, sierra: sierra / w, llano: llano / w }
}

const LOC_Y = -0.05 // bajo la locación el terreno queda apenas por debajo de su piso plano (y = 0)
const locDistance = (x: number, z: number) => Math.hypot(Math.max(B.minX - x, 0, x - B.maxX), Math.max(B.minZ - z, 0, z - B.maxZ))

/** Altura del terreno en (x, z). Sobre la calzada coincide con roadY; la locación es plana. */
export function terrainY(x: number, z: number) {
  const loc = smooth(12, 90, locDistance(x, z))
  if (loc === 0) return LOC_Y
  const { s, d } = nearest(x, z)
  const g = regional(x, z)
  const rough = 1 - g.llano * 0.92 // base y ciudad casi planas
  let relief = rough * (noise(x / 260, z / 260) * 16 + noise(x / 70, z / 70) * 4 + noise(x / 19, z / 19) * 0.8)
  // bardas: paredones escalonados a los costados del camino
  const wall = g.barda * smooth(16, 70, d) * (38 + 22 * noise(x / 180, z / 180))
  const t = wall / 11
  relief += (Math.floor(t) + smooth(0.7, 1, t - Math.floor(t))) * 11
  // sierra: cerros que crecen al alejarse del camino
  relief += g.sierra * smooth(22, 520, d) * (130 + 90 * noise(x / 420, z / 420) + 25 * noise(x / 95, z / 95))
  const y = lerp(roadY(s), g.y + relief, smooth(ROAD_HALF, ROAD_HALF + 26, d))
  return lerp(LOC_Y, y, loc)
}

// --- Límites del mundo y arranque ---
const PAD = 700
let [x0, x1, z0, z1] = [Infinity, -Infinity, Infinity, -Infinity]
for (let i = 0; i < R.n; i++) {
  x0 = Math.min(x0, R.xs[i])
  x1 = Math.max(x1, R.xs[i])
  z0 = Math.min(z0, R.zs[i])
  z1 = Math.max(z1, R.zs[i])
}
/** Caja que contiene la ruta y la locación con margen: fuera de ella se reubica. */
export const WORLD_BOUNDS = { minX: Math.min(x0, B.minX) - PAD, maxX: Math.max(x1, B.maxX) + PAD, minZ: Math.min(z0, B.minZ) - PAD, maxZ: Math.max(z1, B.maxZ) + PAD }
export const inLocacion = (x: number, z: number, margin = 0) => x >= B.minX - margin && x <= B.maxX + margin && z >= B.minZ - margin && z <= B.maxZ + margin

// Base operativa: playón a la derecha del arranque del camino. El operador sale a pie junto a la camioneta, que mira
// hacia la ruta.
const b0 = pointAt(40)
const right = (k: number, along = 0): [number, number] => [b0.x - b0.tz * k + b0.tx * along, b0.z + b0.tx * k + b0.tz * along]
export const BASE = {
  yaw: b0.yaw,
  y: roadY(0),
  center: right(34),
  truck: [right(16)[0], roadY(0), right(16)[1]] as [number, number, number],
  player: [right(20, -4)[0], roadY(0), right(20, -4)[1]] as [number, number, number],
}

/** Punto de la calzada para reubicar la camioneta: el del eje más cercano, en su carril. */
export function roadSpawn(x: number, z: number): { position: [number, number, number]; yaw: number } {
  const p = pointAt(nearest(x, z).s)
  return { position: [p.x - p.tz * 2.2, roadY(nearest(x, z).s), p.z + p.tx * 2.2], yaw: p.yaw }
}
