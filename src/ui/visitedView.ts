import type { MissionDef, MissionState } from '../game/missions/types'

/**
 * Única fuente del contador de sectores que muestra el HUD (tarjeta de misión y tarjeta de visitados). Con un objetivo
 * de recorrido activo cuenta lo del motor (mission.visited, con la regla anti-spawn); si no, los sectores de la sesión.
 * Antes eran dos cuentas distintas a la vez ("13/14 sectores" y "Sectores visitados · 14/14").
 */
export function visitedView(def: MissionDef | undefined, mission: MissionState, session: string[], placed: number) {
  const obj = mission.status === 'active' ? def?.objectives[mission.objectiveIndex] : undefined
  return obj?.kind === 'visitAll'
    ? { mission: true, label: 'Recorrido de la misión', ids: mission.visited, total: obj.sectorIds.length }
    : { mission: false, label: 'Sectores visitados', ids: session, total: placed }
}
