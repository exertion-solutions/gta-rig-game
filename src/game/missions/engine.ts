import type { Sector, Vec3 } from '../data/sectors'
import { onFloor } from '../world/walkable'
import type { GameData, GameEvent, MissionDef, MissionState, Objective, Omitted } from './types'

/** Radio de llegada (m): regla de interacción del juego. No se muestra en pantalla. */
export const ARRIVAL_RADIUS = 6

// Raíces prohibidas (sin acentos, sin mayúsculas) en los TEXTOS de misión; ids y kinds no se revisan.
const FORBIDDEN = /aprob|habilit|certific/
const plain = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const textsOf = (def: MissionDef): string[] => [
  def.title,
  def.briefing,
  ...def.objectives.flatMap((o) => [
    o.text,
    ...(o.kind === 'choose' ? o.options.map((x) => x.text) : o.kind === 'order' ? o.items.map((x) => x.text) : []),
  ]),
]

/**
 * Sectores cuyo radio contiene (x,z) y cuyo piso contiene la altura del jugador (FLOOR_BANDS, derivadas de las alturas
 * medidas), del más cercano al más lejano; ignora sectores sin posición documentada. Sin piso = nivel del suelo.
 */
export function sectorsAt(pos: Vec3, sectors: Sector[], radius = ARRIVAL_RADIUS): string[] {
  return sectors
    .flatMap((s) =>
      s.position && onFloor(pos[1], s.floor ?? 'terreno') ? [{ id: s.id, d: Math.hypot(pos[0] - s.position[0], pos[2] - s.position[2]) }] : [],
    )
    .filter((x) => x.d <= radius)
    .sort((a, b) => a.d - b.d)
    .map((x) => x.id)
}

/** Sector más cercano cuyo radio contiene (x,z) (null = ninguno). */
export const sectorAt = (pos: Vec3, sectors: Sector[], radius = ARRIVAL_RADIUS): string | null =>
  sectorsAt(pos, sectors, radius)[0] ?? null

export const idleState = (): MissionState => ({
  status: 'idle', missionId: null, objectiveIndex: 0, visited: [], results: {}, feedback: null,
})

const sectorRefs = (o: Objective) => (o.kind === 'reach' ? [o.sectorId] : o.kind === 'visitAll' ? o.sectorIds : [])

const sameSet = (a: string[], b: string[]) => a.length === b.length && b.every((x) => a.includes(x))

function problems(def: MissionDef, data: GameData): string[] {
  const out: string[] = []
  try {
    out.push(...def.requires(data))
  } catch (e) {
    out.push(`requires falló: ${String(e)}`)
  }
  if (def.objectives.length === 0) out.push('sin objetivos')
  if (textsOf(def).some((t) => FORBIDDEN.test(plain(t))))
    out.push('texto con términos no permitidos (raíces aprob/habilit/certific)')
  const ids = new Set<string>()
  for (const o of def.objectives) {
    if (ids.has(o.id)) out.push(`objetivo duplicado: ${o.id}`)
    ids.add(o.id)
    if (o.kind === 'visitAll' && (o.sectorIds.length === 0 || new Set(o.sectorIds).size !== o.sectorIds.length))
      out.push(`visitAll ${o.id}: sectorIds vacío o con repetidos (no se puede completar)`)
    if (o.kind === 'choose') {
      const oids = o.options.map((x) => x.id)
      if (new Set(oids).size !== oids.length) out.push(`choose ${o.id}: opciones con id repetido`)
      if (o.correct.length === 0 || new Set(o.correct).size !== o.correct.length || o.correct.some((c) => !oids.includes(c)))
        out.push(`choose ${o.id}: correct vacío, repetido o fuera de options (no se puede completar)`)
    }
    if (o.kind === 'order') {
      const iids = o.items.map((x) => x.id)
      if (o.items.length === 0 || new Set(iids).size !== iids.length || !sameSet(iids, o.correctOrder) || new Set(o.correctOrder).size !== o.correctOrder.length)
        out.push(`order ${o.id}: correctOrder no coincide con items (no se puede completar)`)
    }
    if (o.kind === 'interact' && !data.interactables?.some((x) => x.id === o.targetId))
      out.push(`interactuable inexistente: ${o.targetId}`)
    for (const sid of sectorRefs(o)) {
      const s = data.sectors.find((x) => x.id === sid)
      if (!s) out.push(`sector inexistente: ${sid}`)
      else if (!s.position) out.push(`sector sin posición documentada: ${sid}`)
    }
  }
  return out
}

export function createEngine(defs: MissionDef[], data: GameData) {
  const available: MissionDef[] = []
  const omitted: Omitted[] = []
  const seen = new Set<string>()
  for (const def of defs) {
    const p = problems(def, data)
    if (seen.has(def.id)) p.push(`id de misión duplicado: ${def.id}`)
    seen.add(def.id)
    if (p.length) {
      const reason = p.join('; ')
      omitted.push({ id: def.id, reason })
      console.warn(`[misiones] "${def.id}" omitida: ${reason}`)
    } else available.push(def)
  }

  let st = idleState()
  let armed = new Set<string>() // sectores de los que el jugador ya salió desde el inicio de la misión
  const subs = new Set<() => void>()
  const set = (s: MissionState) => {
    st = s
    subs.forEach((f) => f())
  }
  const current = (): { def: MissionDef; obj: Objective } | null => {
    const def = available.find((d) => d.id === st.missionId)
    const obj = def?.objectives[st.objectiveIndex]
    return st.status === 'active' && def && obj ? { def, obj } : null
  }
  const advance = (patch: Partial<MissionState> = {}) => {
    const c = current()!
    const next = st.objectiveIndex + 1
    set({
      ...st, ...patch, feedback: null, visited: [],
      objectiveIndex: next,
      status: next >= c.def.objectives.length ? 'completed' : 'active',
    })
  }
  const start = (id: string) => {
    if (!available.some((d) => d.id === id)) return
    armed = new Set()
    set({ ...idleState(), status: 'active', missionId: id })
  }

  return {
    available,
    omitted,
    start,
    /** Reintento sin penalización: vuelve al estado inicial de la misión en curso. */
    restart() {
      if (st.missionId) start(st.missionId)
    },
    /** Salir de la misión sin penalización. */
    exit() {
      armed = new Set()
      set(idleState())
    },
    report(ev: GameEvent) {
      const c = current()
      if (!c) return
      const { obj } = c
      if (ev.type === 'at') {
        // Todo sector en cuyo radio NO está el jugador queda "fuera": desde ahí puede contar una llegada.
        const inside = ev.inside ?? (ev.sectorId ? [ev.sectorId] : [])
        for (const s of data.sectors) if (!inside.includes(s.id)) armed.add(s.id)
        if (obj.kind === 'reach' && inside.includes(obj.sectorId) && armed.has(obj.sectorId)) {
          armed.delete(obj.sectorId)
          advance()
        } else if (obj.kind === 'visitAll') {
          const fresh = obj.sectorIds.filter((id) => inside.includes(id) && armed.has(id) && !st.visited.includes(id))
          if (fresh.length === 0) return
          fresh.forEach((id) => armed.delete(id))
          const visited = [...st.visited, ...fresh]
          if (obj.sectorIds.every((id) => visited.includes(id))) advance()
          else set({ ...st, visited })
        }
        return
      }
      if (ev.type === 'interact') {
        // Registro propio: cualquier operación de la válvula pedida cuenta; desiredState solo si la fuente lo documenta.
        if (obj.kind === 'interact' && ev.targetId === obj.targetId && (!obj.desiredState || ev.state === obj.desiredState))
          advance({ results: { ...st.results, [obj.id]: { kind: 'interact', targetId: ev.targetId, state: ev.state } } })
        return
      }
      if (ev.objectiveId !== obj.id) return
      if (ev.type === 'choose' && obj.kind === 'choose') {
        const ok = sameSet(ev.picked, obj.correct)
        if (ok || obj.advanceOnWrong) advance({ results: { ...st.results, [obj.id]: { kind: 'choose', correct: ok } } })
        else set({ ...st, feedback: 'retry' })
      } else if (ev.type === 'order' && obj.kind === 'order') {
        const ok = ev.order.length === obj.correctOrder.length && ev.order.every((x, i) => x === obj.correctOrder[i])
        if (ok) advance({ results: { ...st.results, [obj.id]: { kind: 'order' } } })
        else set({ ...st, feedback: 'retry' })
      } else if (ev.type === 'mark' && obj.kind === 'mark') {
        advance({ results: { ...st.results, [obj.id]: { kind: 'mark', value: ev.value } } })
      }
    },
    state: (): MissionState => ({ ...st, visited: [...st.visited], results: { ...st.results } }),
    subscribe(fn: () => void) {
      subs.add(fn)
      return () => void subs.delete(fn)
    },
  }
}

export type MissionEngine = ReturnType<typeof createEngine>
