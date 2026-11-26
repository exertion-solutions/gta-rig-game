import type { Sector } from '../data/sectors'

/** Datos contra los que las misiones validan sus requisitos (Task 10 puede ampliar con más campos). */
export interface GameData {
  sectors: Sector[]
}

export type MarkValue = 'OK' | 'NOK' | 'N/A'

type Base = { id: string; text: string }

export type Objective =
  | (Base & { kind: 'reach'; sectorId: string })
  | (Base & { kind: 'visitAll'; sectorIds: string[] })
  | (Base & {
      kind: 'choose'
      options: { id: string; text: string }[]
      correct: string[]
      /** true = una respuesta errónea también avanza (queda en results); para conteos tipo 6/8. */
      advanceOnWrong?: boolean
    })
  | (Base & { kind: 'order'; items: { id: string; text: string }[]; correctOrder: string[] })
  /** Autorregistro OK/NOK/N/A: se guarda lo que el jugador marca, sin evaluarlo. */
  | (Base & { kind: 'mark' })

export type MissionDef = {
  id: string
  title: string
  briefing: string
  objectives: Objective[]
  /** Datos faltantes o que no coinciden con la fuente (vacío = la misión se puede jugar). */
  requires: (data: GameData) => string[]
}

/**
 * Eventos del juego hacia el motor.
 * - `at`: sector cuyo radio de llegada contiene hoy al jugador (null = ninguno); ver sectorAt().
 *   Regla anti-spawn: una llegada cuenta solo si el jugador estuvo fuera de ese radio al menos una vez desde
 *   el inicio de la misión (o desde la última vez que esa llegada contó). El spawn en el Acceso no cuenta.
 */
export type GameEvent =
  | { type: 'at'; sectorId: string | null }
  | { type: 'choose'; objectiveId: string; picked: string[] }
  | { type: 'order'; objectiveId: string; order: string[] }
  | { type: 'mark'; objectiveId: string; value: MarkValue }

export type ObjectiveResult =
  | { kind: 'choose'; correct: boolean }
  | { kind: 'order' }
  | { kind: 'mark'; value: MarkValue }

export type MissionState = {
  status: 'idle' | 'active' | 'completed'
  missionId: string | null
  objectiveIndex: number
  /** Sectores ya visitados en el objetivo actual (visitAll). */
  visited: string[]
  results: Record<string, ObjectiveResult>
  /** 'retry' tras una respuesta errónea; sin castigo, reintento ilimitado. */
  feedback: 'retry' | null
}

export type Omitted = { id: string; reason: string }
