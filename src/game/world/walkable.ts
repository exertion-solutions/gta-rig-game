// Superficies caminables, barandas y anclajes de recorrido medidos de los GLB (src/game/world/traversal.json,
// generado por scripts/extract-traversal.mjs). Escenario ilustrativo, no as-built: ver docs/traversal-inventory.md.
import data from './traversal.json' with { type: 'json' }

export type Vec3 = [number, number, number]
export type Traversal = 'ground' | 'stairs' | 'ladder' | 'platform'
export type Evidence = { status: 'documentado' | 'ilustrativo'; ref: string }
// Caja de colisión con rotación opcional (Euler XYZ, radianes): rampas, escaleras y barandas inclinadas.
export type BoxCollider = { id: string; center: Vec3; half: Vec3; rot?: Vec3; only?: 'stair' | 'truckBlock' }
export type LadderVolume = { id: string; partId: string; bottom: Vec3; top: Vec3; facing: number }
export type Interactable = {
  id: string
  kind: 'valve'
  partId: string
  position: Vec3
  label: string
  sourceId: string
  // Sin fuente que documente estados: no hay estado hasta que el jugador opera (registro propio, ver interactables.ts).
  state?: 'open' | 'closed'
}
type Incline = { id: string; bottom: number[]; top: number[]; width: number; slopeDeg: number; rise?: number }
type Rail = { id: string; a: number[]; b: number[]; height: number }
type Solid = { id: string; center: number[]; half: number[] }
export type TraversalData = {
  replaces: string[]
  solids: Solid[]
  rails: Rail[]
  stairs: Incline[]
  ramps: Incline[]
  ladders: (LadderVolume & { evidence: Evidence })[]
  interactables: (Interactable & { evidence: Evidence })[]
  platforms: { id: string; partId: string; y: number; min: number[]; max: number[] }[]
}
export const TRAVERSAL = data as unknown as TraversalData

const SLAB = 0.12 // espesor de la losa de colisión bajo una rampa/escalera
const RAIL_T = 0.05 // espesor de la colisión de una baranda

export const slopeDeg = (rise: number, run: number) => (Math.atan2(rise, run) * 180) / Math.PI

// Marco de una caja orientada de `a` a `b`: eje X local a lo largo, Y local "arriba" (inclinado con la pendiente).
// Euler XYZ [0, yaw, pitch] => R = Ry(yaw)·Rz(pitch).
function frame(a: readonly number[], b: readonly number[]) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const h = Math.hypot(d[0], d[2])
  const yaw = Math.atan2(-d[2], d[0])
  const pitch = Math.atan2(d[1], h)
  const up: Vec3 = [-Math.sin(pitch) * Math.cos(yaw), Math.cos(pitch), Math.sin(pitch) * Math.sin(yaw)]
  const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
  return { len: Math.hypot(h, d[1]), up, mid, rot: [0, yaw, pitch] as Vec3 }
}

// Rampa (o escalera como rampa por la línea de narices): cara superior exactamente sobre bottom->top.
export function inclineCollider(id: string, bottom: readonly number[], top: readonly number[], width: number, thickness = SLAB): BoxCollider {
  const f = frame(bottom, top)
  return { id, center: f.mid.map((v, i) => v - (f.up[i] * thickness) / 2) as Vec3, half: [f.len / 2, thickness / 2, width / 2], rot: f.rot }
}

// Baranda: de la línea base a..b (nivel del piso) hasta `height` por encima.
export function railCollider(id: string, a: readonly number[], b: readonly number[], height: number, thickness = RAIL_T): BoxCollider {
  const f = frame(a, b)
  return { id, center: f.mid.map((v, i) => v + (f.up[i] * height) / 2) as Vec3, half: [f.len / 2, height / 2, thickness / 2], rot: f.rot }
}

// Volumen bajo de cada escalera, solo para la camioneta (groups.ts): del pie al borde de la cubierta, a lo ancho de la
// escalera y hasta la altura del pasamanos sobre la línea de narices en el pie (0,90 m, la de A1; ESTIMADA): queda dentro
// de lo dibujado (escalera + pasamanos) y alcanza al chasis (0,6–1,2 m), que choca de frente en vez de subir la rampa.
export const TRUCK_BLOCK_H = 0.9
export function truckBlockCollider(s: Incline): BoxCollider {
  const x0 = Math.min(s.bottom[0], s.top[0])
  const x1 = Math.max(s.bottom[0], s.top[0])
  const h = Math.min(TRUCK_BLOCK_H, Math.max(s.bottom[1], s.top[1]))
  return { id: `${s.id}_camioneta`, center: [(x0 + x1) / 2, h / 2, s.bottom[2]], half: [(x1 - x0) / 2, h / 2, s.width / 2], only: 'truckBlock' }
}

export function walkableColliders(t: TraversalData = TRAVERSAL): BoxCollider[] {
  return [
    ...t.solids.map((s) => ({ id: s.id, center: s.center as Vec3, half: s.half as Vec3 })),
    ...t.stairs.map((s) => ({ ...inclineCollider(s.id, s.bottom, s.top, s.width), only: 'stair' as const })),
    ...t.stairs.map(truckBlockCollider),
    ...t.ramps.map((s) => inclineCollider(s.id, s.bottom, s.top, s.width)),
    ...t.rails.map((r) => railCollider(r.id, r.a, r.b, r.height)),
  ]
}

// Piezas cuyo bbox completo se reemplaza por las cajas medidas de traversal.json.
export const REPLACED_PARTS: ReadonlySet<string> = new Set(TRAVERSAL.replaces)
export const LADDERS: readonly LadderVolume[] = TRAVERSAL.ladders
export const INTERACTABLES: readonly Interactable[] = TRAVERSAL.interactables
// Pendiente máxima medida entre escaleras y rampas (para el autostep/pendiente del controlador, Task 18B).
export const MAX_MEASURED_SLOPE_DEG = Math.max(...[...TRAVERSAL.stairs, ...TRAVERSAL.ramps].map((s) => s.slopeDeg))

// Bandas verticales de cada piso para contar una llegada (sectorsAt). Derivadas solo de alturas medidas:
// media banda = la mitad del menor salto entre niveles caminables = (piso de trabajo − cubierta más alta del nivel del
// suelo) / 2 = (3,606 − 2,639) / 2. Entre bandas (p. ej. a mitad de la escalera vertical) no cuenta.
const platformY = (id: string) => TRAVERSAL.platforms.find((p) => p.id === id)!.y
const PT_Y = platformY('piso_trabajo')
const PE_Y = platformY('piso_enganche')
const GROUND_DECKS = TRAVERSAL.platforms.filter((p) => p.y < PT_Y)
const GROUND_TOP = Math.max(...GROUND_DECKS.map((p) => p.y))
export const LEVEL_HALF_BAND = (PT_Y - GROUND_TOP) / 2
export const FLOOR_BANDS = {
  pisoTrabajo: [PT_Y - LEVEL_HALF_BAND, PT_Y + LEVEL_HALF_BAND],
  pisoEnganche: [PE_Y - LEVEL_HALF_BAND, PE_Y + LEVEL_HALF_BAND],
} as const satisfies Record<string, readonly [number, number]>
// Nivel del suelo: de pie sobre el suelo (y 0) o sobre una cubierta medida del nivel del suelo (pasarela 1,05, piletas
// 2,05, trip tank 2,64), solo DENTRO de su huella. Antes era una banda única hasta 3,12 m y la rampa de la V (que sube de
// 1,09 a 3,62) contaba como suelo para BOP y mástil. Holgura = la contrahuella mayor medida (escaleras de traversal.json).
export const GROUND_TOL = Math.max(...TRAVERSAL.stairs.map((s) => s.rise ?? 0))
export const groundLevelAt = (x: number, z: number) =>
  Math.max(0, ...GROUND_DECKS.filter((p) => x >= p.min[0] && x <= p.max[0] && z >= p.min[1] && z <= p.max[1]).map((p) => p.y))
export type Floor = 'terreno' | keyof typeof FLOOR_BANDS
export const onFloor = (pos: readonly number[], floor: Floor) =>
  floor === 'terreno'
    ? pos[1] < groundLevelAt(pos[0], pos[2]) + GROUND_TOL
    : pos[1] >= FLOOR_BANDS[floor][0] && pos[1] < FLOOR_BANDS[floor][1]
