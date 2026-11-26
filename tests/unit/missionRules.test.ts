import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEngine, sectorsAt } from '../../src/game/missions/engine'
import { STORAGE_KEY, loadLog, useMissionStore } from '../../src/game/missions/store'
import type { Sector } from '../../src/game/data/sectors'
import type { GameData, MissionDef, Objective } from '../../src/game/missions/types'

const sec = (id: string, x: number, z: number): Sector => ({ id, name: id, position: [x, 0, z] }) as Sector
const data: GameData = { sectors: [sec('a', 0, 0), sec('b', 1, 0), sec('c', 50, 0)] }
const mission = (id: string, ...objectives: Objective[]): MissionDef => ({ id, title: 't', briefing: 'b', objectives, requires: () => [] })
const opts = [{ id: 'x', text: 'X' }, { id: 'y', text: 'Y' }]
const items = [{ id: '1', text: 'uno' }, { id: '2', text: 'dos' }]

const omittedWhy = (...defs: MissionDef[]) => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const e = createEngine(defs, data)
  return { available: e.available.map((d) => d.id), omitted: e.omitted }
}

describe('reglas de validez del motor: datos malos se omiten, no quedan sin poder completarse', () => {
  beforeEach(() => vi.restoreAllMocks())

  it.each([
    ['visitAll vacío', { id: 'o', kind: 'visitAll', text: 't', sectorIds: [] }],
    ['visitAll con repetidos', { id: 'o', kind: 'visitAll', text: 't', sectorIds: ['a', 'a'] }],
    ['choose sin correct', { id: 'o', kind: 'choose', text: 't', options: opts, correct: [] }],
    ['choose con correct fuera de options', { id: 'o', kind: 'choose', text: 't', options: opts, correct: ['z'] }],
    ['choose con opciones repetidas', { id: 'o', kind: 'choose', text: 't', options: [...opts, opts[0]], correct: ['x'] }],
    ['order con correctOrder incompleto', { id: 'o', kind: 'order', text: 't', items, correctOrder: ['1'] }],
    ['order con correctOrder ajeno', { id: 'o', kind: 'order', text: 't', items, correctOrder: ['1', '9'] }],
    ['order con correctOrder repetido', { id: 'o', kind: 'order', text: 't', items, correctOrder: ['1', '1'] }],
    ['order sin items', { id: 'o', kind: 'order', text: 't', items: [], correctOrder: [] }],
  ] as [string, Objective][])('omite: %s', (_, o) => {
    const r = omittedWhy(mission('m', o), mission('ok', { id: 'k', kind: 'mark', text: 't' }))
    expect(r.available).toEqual(['ok'])
    expect(r.omitted.map((x) => x.id)).toEqual(['m'])
  })

  it('acepta objetivos válidos de cada tipo', () => {
    const r = omittedWhy(
      mission('m',
        { id: 'v', kind: 'visitAll', text: 't', sectorIds: ['a', 'c'] },
        { id: 'c', kind: 'choose', text: 't', options: opts, correct: ['x', 'y'] },
        { id: 'o', kind: 'order', text: 't', items, correctOrder: ['2', '1'] },
      ),
    )
    expect(r.omitted).toEqual([])
  })

  it('ids de misión duplicados: la segunda se omite y la primera sigue disponible', () => {
    const r = omittedWhy(mission('dup', { id: 'a', kind: 'mark', text: 't' }), mission('dup', { id: 'b', kind: 'mark', text: 't' }))
    expect(r.available).toEqual(['dup'])
    expect(r.omitted).toHaveLength(1)
    expect(r.omitted[0].reason).toContain('duplicado')
  })

  it.each(['Estás aprobado', 'Habilitación', 'CERTIFICACIÓN', 'APROBÓ', 'certificado', 'habilitada'])('raíz prohibida en el título: %s', (title) => {
    const r = omittedWhy({ ...mission('m', { id: 'o', kind: 'mark', text: 't' }), title })
    expect(r.available).toEqual([])
  })

  it('la raíz prohibida se revisa en textos de objetivos, opciones e items, no en ids ni kinds', () => {
    const bad = (o: Objective) => omittedWhy(mission('m', o)).available
    expect(bad({ id: 'o', kind: 'mark', text: 'quedó aprobada' })).toEqual([])
    expect(bad({ id: 'o', kind: 'choose', text: 't', options: [{ id: 'x', text: 'Habilitación' }, opts[1]], correct: ['x'] })).toEqual([])
    expect(bad({ id: 'o', kind: 'order', text: 't', items: [{ id: '1', text: 'certificación' }, items[1]], correctOrder: ['1', '2'] })).toEqual([])
    expect(bad({ id: 'aprobar-id', kind: 'mark', text: 'limpio' })).toEqual(['m']) // un id con la raíz no es texto
  })

  it('advanceOnWrong: una respuesta errónea avanza y queda registrada; sin la marca, reintenta', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const e = createEngine(
      [
        mission('m', { id: 'q1', kind: 'choose', text: 't', options: opts, correct: ['x'], advanceOnWrong: true }, { id: 'q2', kind: 'choose', text: 't', options: opts, correct: ['x'] }),
      ],
      data,
    )
    e.start('m')
    e.report({ type: 'choose', objectiveId: 'q1', picked: ['y'] })
    expect(e.state()).toMatchObject({ objectiveIndex: 1, feedback: null, results: { q1: { kind: 'choose', correct: false } } })
    e.report({ type: 'choose', objectiveId: 'q2', picked: ['y'] })
    expect(e.state()).toMatchObject({ objectiveIndex: 1, feedback: 'retry' })
    expect(e.state().results.q2).toBeUndefined()
  })
})

describe('llegada con varios sectores en la misma planta', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('sectorsAt devuelve todos los del radio, del más cercano al más lejano', () => {
    expect(sectorsAt([0.9, 0, 0], data.sectors)).toEqual(['b', 'a'])
    expect(sectorsAt([30, 0, 0], data.sectors)).toEqual([])
  })

  it('un mismo punto cuenta para todos los sectores que contienen al jugador (visitAll), tras salir una vez', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const e = createEngine([mission('m', { id: 'v', kind: 'visitAll', text: 't', sectorIds: ['a', 'b', 'c'] })], data)
    e.start('m')
    e.report({ type: 'at', sectorId: 'a', inside: ['a', 'b'] }) // spawn: no cuenta
    expect(e.state().visited).toEqual([])
    e.report({ type: 'at', sectorId: 'c', inside: ['c'] })
    expect(e.state().visited).toEqual(['c'])
    e.report({ type: 'at', sectorId: 'b', inside: ['b', 'a'] })
    expect(e.state().status).toBe('completed')
  })
})

describe('store: registro propio', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('JSON inválido o con forma inesperada en localStorage cae a un registro vacío sin lanzar', () => {
    for (const raw of ['{no es json', 'null', '[]', '{"completed":"x","marks":{}}', '{"completed":[],"marks":5}']) {
      vi.stubGlobal('localStorage', { getItem: () => raw, setItem: () => {} })
      expect(loadLog()).toEqual({ completed: [], marks: {} })
    }
    vi.stubGlobal('localStorage', { getItem: (k: string) => (k === STORAGE_KEY ? '{rota' : null), setItem: () => {} })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => useMissionStore.getState().init([], data)).not.toThrow()
    expect(useMissionStore.getState().log).toEqual({ completed: [], marks: {} })
    vi.unstubAllGlobals()
  })
})
