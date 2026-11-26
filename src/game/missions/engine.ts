import type { Sector, Vec3 } from '../data/sectors'
import type { GameData, GameEvent, MissionDef, MissionState, Objective, Omitted } from './types'

/** Radio de llegada (m): regla de interacción del juego. No se muestra en pantalla. */
export const ARRIVAL_RADIUS = 6

const FORBIDDEN = /aprobad|habilitad|certificad/i

/** Sector cuyo radio contiene (x,z) (el más cercano); ignora sectores sin posición documentada. */
export function sectorAt(pos: Vec3, sectors: Sector[], radius = ARRIVAL_RADIUS): string | null {
  let best: string | null = null
  let bestD = radius
  for (const s of sectors) {
    if (!s.position) continue
    const d = Math.hypot(pos[0] - s.position[0], pos[2] - s.position[2])
    if (d <= bestD) {
      best = s.id
      bestD = d
    }
  }
  return best
}

export const idleState = (): MissionState => ({
  status: 'idle', missionId: null, objectiveIndex: 0, visited: [], results: {}, feedback: null,
})

const sectorRefs = (o: Objective) => (o.kind === 'reach' ? [o.sectorId] : o.kind === 'visitAll' ? o.sectorIds : [])

function problems(def: MissionDef, data: GameData): string[] {
  const out: string[] = []
  try {
    out.push(...def.requires(data))
  } catch (e) {
    out.push(`requires falló: ${String(e)}`)
  }
  if (def.objectives.length === 0) out.push('sin objetivos')
  if (FORBIDDEN.test(JSON.stringify([def.title, def.briefing, def.objectives])))
    out.push('texto con términos no permitidos (aprobado/habilitado/certificado)')
  const ids = new Set<string>()
  for (const o of def.objectives) {
    if (ids.has(o.id)) out.push(`objetivo duplicado: ${o.id}`)
    ids.add(o.id)
    for (const sid of sectorRefs(o)) {
      const s = data.sectors.find((x) => x.id === sid)
      if (!s) out.push(`sector inexistente: ${sid}`)
      else if (!s.position) out.push(`sector sin posición documentada: ${sid}`)
    }
  }
  return out
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && b.every((x) => a.includes(x))

export function createEngine(defs: MissionDef[], data: GameData) {
  const available: MissionDef[] = []
  const omitted: Omitted[] = []
  for (const def of defs) {
    const p = problems(def, data)
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
        // Todo sector distinto del actual queda "fuera": desde ahí puede contar una llegada.
        for (const s of data.sectors) if (s.id !== ev.sectorId) armed.add(s.id)
        const sid = ev.sectorId
        if (!sid || !armed.has(sid)) return
        if (obj.kind === 'reach' && obj.sectorId === sid) {
          armed.delete(sid)
          advance()
        } else if (obj.kind === 'visitAll' && obj.sectorIds.includes(sid) && !st.visited.includes(sid)) {
          armed.delete(sid)
          const visited = [...st.visited, sid]
          if (visited.length >= obj.sectorIds.length) advance()
          else set({ ...st, visited })
        }
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
