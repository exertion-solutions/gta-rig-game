import { ALL_MISSIONS } from './defs'
import type { MissionDef } from './types'

export { ALL_MISSIONS }

/** En dev/test suma la misión de prueba; import.meta.env.DEV es false en el build y el chunk no se incluye. */
export async function loadMissionDefs(): Promise<MissionDef[]> {
  const defs = [...ALL_MISSIONS]
  if (import.meta.env.DEV) defs.push(...(await import('./dev-fixture')).DEV_FIXTURE_MISSIONS)
  return defs
}
