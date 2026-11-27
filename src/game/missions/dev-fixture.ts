import type { MissionDef } from './types'

// SOLO dev/test (ver loadMissionDefs): recorrido corto para probar HUD, radar y panel de punta a punta.
export const DEV_FIXTURE_ID = 'dev-fixture'
export const DEV_OMITTED_ID = 'dev-omitida'
export const DEV_INTERACT_ID = 'dev-valvula'
export const DEV_OMITTED_REASON = 'dato A2 ausente'

export const DEV_FIXTURE_MISSIONS: MissionDef[] = [
  {
    id: DEV_FIXTURE_ID,
    title: 'Recorrido de prueba',
    briefing: 'Misión de prueba del HUD: llegá hasta el acumulador, respondé y autorregistrá.',
    objectives: [
      { id: 'f1', kind: 'reach', text: 'Andá hasta el acumulador', sectorId: 'acumulador' },
      {
        id: 'f2', kind: 'choose', text: 'Elegí la opción A',
        options: [{ id: 'a', text: 'Opción A' }, { id: 'b', text: 'Opción B' }], correct: ['a'],
      },
      { id: 'f3', kind: 'mark', text: 'Autorregistrá el resultado' },
    ],
    requires: () => [],
  },
  {
    // Flujo del objetivo `interact` para el e2e: una válvula del manifold, sin estado pedido (registro propio).
    id: DEV_INTERACT_ID,
    title: 'Válvula de prueba',
    briefing: 'Misión de prueba del objetivo interact: operá la válvula M1 del manifold con E. Ilustrativo: no es un procedimiento.',
    objectives: [{ id: 'v1', kind: 'interact', text: 'Operá la válvula M1 del manifold', targetId: 'manifold_M1' }],
    requires: () => [],
  },
  { id: DEV_OMITTED_ID, title: 'Omitida de prueba', briefing: 'x', objectives: [{ id: 'o', kind: 'mark', text: 'x' }], requires: () => [DEV_OMITTED_REASON] },
]
