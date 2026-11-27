import { describe, expect, it } from 'vitest'
import { m1 } from '../../src/game/missions/defs/m1'
import { idleState } from '../../src/game/missions/engine'
import { visitedView } from '../../src/ui/visitedView'

describe('visitedView: un solo contador de sectores en todo el HUD', () => {
  it('con el recorrido de m1 activo cuenta lo del motor, no los sectores de la sesión', () => {
    const mission = { ...idleState(), status: 'active' as const, missionId: m1.id, objectiveIndex: 1, visited: ['bop', 'mastil'] }
    const v = visitedView(m1, mission, ['acceso', 'bop', 'mastil'], 14)
    expect(v).toMatchObject({ mission: true, ids: ['bop', 'mastil'], total: 13 })
  })
  it('sin recorrido activo cuenta los sectores de la sesión', () => {
    const v = visitedView(undefined, idleState(), ['acceso'], 14)
    expect(v).toMatchObject({ mission: false, ids: ['acceso'], total: 14 })
  })
})
