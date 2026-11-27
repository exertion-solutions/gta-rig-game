import type { Sector, Vec3 } from '../data/sectors'
import type { GameData, MissionDef, MissionState } from './types'

/** Posiciones que el objetivo activo pide alcanzar (reach / visitAll pendientes / válvula de interact); [] si no aplica. */
export function objectiveTargets(def: MissionDef | undefined, st: MissionState, sectors: Sector[], interactables: GameData['interactables'] = []): Vec3[] {
  const obj = st.status === 'active' ? def?.objectives[st.objectiveIndex] : undefined
  if (obj?.kind === 'interact') {
    const p = interactables.find((x) => x.id === obj.targetId)?.position
    return p ? [p] : []
  }
  const ids = obj?.kind === 'reach' ? [obj.sectorId] : obj?.kind === 'visitAll' ? obj.sectorIds.filter((i) => !st.visited.includes(i)) : []
  return ids.flatMap((id) => {
    const p = sectors.find((s) => s.id === id)?.position
    return p ? [p] : []
  })
}
