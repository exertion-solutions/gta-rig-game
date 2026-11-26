import type { Sector, Vec3 } from '../data/sectors'
import type { MissionDef, MissionState } from './types'

/** Posiciones de los sectores que el objetivo activo pide alcanzar (reach / visitAll pendientes); [] si no aplica. */
export function objectiveTargets(def: MissionDef | undefined, st: MissionState, sectors: Sector[]): Vec3[] {
  const obj = st.status === 'active' ? def?.objectives[st.objectiveIndex] : undefined
  const ids = obj?.kind === 'reach' ? [obj.sectorId] : obj?.kind === 'visitAll' ? obj.sectorIds.filter((i) => !st.visited.includes(i)) : []
  return ids.flatMap((id) => {
    const p = sectors.find((s) => s.id === id)?.position
    return p ? [p] : []
  })
}
