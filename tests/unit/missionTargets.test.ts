import { describe, expect, it } from 'vitest'
import type { Sector } from '../../src/game/data/sectors'
import { objectiveTargets } from '../../src/game/missions/targets'
import { idleState } from '../../src/game/missions/engine'
import type { MissionDef } from '../../src/game/missions/types'

const sec = (id: string, x: number, z: number | null): Sector => ({ id, name: id, position: z === null ? null : [x, 0, z] }) as Sector
const sectors = [sec('a', 1, 2), sec('b', 3, 4), sec('c', 5, null)]
const def: MissionDef = {
  id: 'm', title: 't', briefing: 'b', requires: () => [],
  objectives: [
    { id: 'o1', kind: 'reach', text: 'x', sectorId: 'a' },
    { id: 'o2', kind: 'visitAll', text: 'x', sectorIds: ['a', 'b'] },
    { id: 'o3', kind: 'mark', text: 'x' },
  ],
}
const at = (objectiveIndex: number, visited: string[] = []) => ({ ...idleState(), status: 'active' as const, missionId: 'm', objectiveIndex, visited })

describe('objectiveTargets', () => {
  it('reach -> posición del sector', () => expect(objectiveTargets(def, at(0), sectors)).toEqual([[1, 0, 2]]))
  it('visitAll -> solo los pendientes', () => expect(objectiveTargets(def, at(1, ['a']), sectors)).toEqual([[3, 0, 4]]))
  it('objetivos no espaciales, misión ausente o inactiva -> nada', () => {
    expect(objectiveTargets(def, at(2), sectors)).toEqual([])
    expect(objectiveTargets(undefined, at(0), sectors)).toEqual([])
    expect(objectiveTargets(def, idleState(), sectors)).toEqual([])
  })
})
