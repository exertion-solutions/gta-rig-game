// Superficies caminables, barandas y anclajes de recorrido medidos de los GLB (src/game/world/traversal.json,
// generado por scripts/extract-traversal.mjs). Escenario ilustrativo, no as-built: ver docs/traversal-inventory.md.
import data from './traversal.json'

export type Vec3 = [number, number, number]
export type Traversal = 'ground' | 'stairs' | 'ladder' | 'platform'
export type Evidence = { status: 'documentado' | 'ilustrativo'; ref: string }
// Caja de colisión con rotación opcional (Euler XYZ, radianes): rampas, escaleras y barandas inclinadas.
export type BoxCollider = { id: string; center: Vec3; half: Vec3; rot?: Vec3 }
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
type Incline = { id: string; bottom: number[]; top: number[]; width: number; slopeDeg: number }
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

export function walkableColliders(t: TraversalData = TRAVERSAL): BoxCollider[] {
  return [
    ...t.solids.map((s) => ({ id: s.id, center: s.center as Vec3, half: s.half as Vec3 })),
    ...[...t.stairs, ...t.ramps].map((s) => inclineCollider(s.id, s.bottom, s.top, s.width)),
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
// suelo) / 2 = (3,606 − 2,639) / 2. Nivel del suelo = todo lo que queda por debajo de la banda del piso de trabajo
// (suelo, pasarela 1,05, cubiertas de piletas 2,05/2,64). Entre bandas (p. ej. a mitad de la escalera vertical) no cuenta.
const platformY = (id: string) => TRAVERSAL.platforms.find((p) => p.id === id)!.y
const PT_Y = platformY('piso_trabajo')
const PE_Y = platformY('piso_enganche')
const GROUND_TOP = Math.max(...TRAVERSAL.platforms.map((p) => p.y).filter((y) => y < PT_Y))
export const LEVEL_HALF_BAND = (PT_Y - GROUND_TOP) / 2
export const FLOOR_BANDS = {
  terreno: [-Infinity, PT_Y - LEVEL_HALF_BAND],
  pisoTrabajo: [PT_Y - LEVEL_HALF_BAND, PT_Y + LEVEL_HALF_BAND],
  pisoEnganche: [PE_Y - LEVEL_HALF_BAND, PE_Y + LEVEL_HALF_BAND],
} as const satisfies Record<string, readonly [number, number]>
export const onFloor = (y: number, floor: keyof typeof FLOOR_BANDS) => y >= FLOOR_BANDS[floor][0] && y < FLOOR_BANDS[floor][1]
