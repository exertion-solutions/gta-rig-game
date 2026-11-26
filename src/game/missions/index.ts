import type { MissionDef } from './types'

/** Task 10 completa esta lista; mientras tanto el HUD muestra "sin misiones disponibles". */
export const ALL_MISSIONS: MissionDef[] = []

/** En dev/test suma la misión de prueba; import.meta.env.DEV es false en el build y el chunk no se incluye. */
export async function loadMissionDefs(): Promise<MissionDef[]> {
  const defs = [...ALL_MISSIONS]
  if (import.meta.env.DEV) defs.push(...(await import('./dev-fixture')).DEV_FIXTURE_MISSIONS)
  return defs
}
