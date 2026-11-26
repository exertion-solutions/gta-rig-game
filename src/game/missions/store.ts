import { create } from 'zustand'
import { createEngine, idleState, type MissionEngine } from './engine'
import type { GameData, GameEvent, MarkValue, MissionDef, MissionState, Omitted } from './types'

export const STORAGE_KEY = 'gta-rig-game:missions:v1'

/** Registro propio en el navegador. marks: "misión/objetivo" -> valor autorregistrado. */
export type MissionLog = { completed: string[]; marks: Record<string, MarkValue> }

// localStorage puede no existir o lanzar (ventana privada, sitio bloqueado): entonces todo sigue en memoria.
export function loadLog(): MissionLog {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    const p = raw ? JSON.parse(raw) : null
    if (p && Array.isArray(p.completed) && p.marks && typeof p.marks === 'object') return p
  } catch {
    /* sin persistencia */
  }
  return { completed: [], marks: {} }
}

function saveLog(log: MissionLog) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(log))
  } catch {
    /* sigue en memoria */
  }
}

type Store = {
  log: MissionLog
  available: MissionDef[]
  omitted: Omitted[]
  mission: MissionState
  init: (defs: MissionDef[], data: GameData) => void
  start: (id: string) => void
  restart: () => void
  exit: () => void
  report: (ev: GameEvent) => void
}

let engine: MissionEngine | null = null
let unsub: (() => void) | null = null

export const useMissionStore = create<Store>((set, get) => ({
  log: { completed: [], marks: {} },
  available: [],
  omitted: [],
  mission: idleState(),
  init(defs, data) {
    unsub?.()
    const e = (engine = createEngine(defs, data))
    const sync = () => {
      const mission = e.state()
      let log = get().log
      if (mission.missionId) {
        const marks = { ...log.marks }
        for (const [oid, r] of Object.entries(mission.results))
          if (r.kind === 'mark') marks[`${mission.missionId}/${oid}`] = r.value
        const completed =
          mission.status === 'completed' && !log.completed.includes(mission.missionId)
            ? [...log.completed, mission.missionId]
            : log.completed
        if (completed !== log.completed || JSON.stringify(marks) !== JSON.stringify(log.marks)) {
          log = { completed, marks }
          saveLog(log)
        }
      }
      set({ mission, log })
    }
    unsub = e.subscribe(sync)
    set({ log: loadLog(), available: e.available, omitted: e.omitted, mission: e.state() })
  },
  start: (id) => engine?.start(id),
  restart: () => engine?.restart(),
  exit: () => engine?.exit(),
  report: (ev) => engine?.report(ev),
}))
