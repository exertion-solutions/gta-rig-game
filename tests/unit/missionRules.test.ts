import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEngine, sectorsAt } from '../../src/game/missions/engine'
import { objectiveTargets } from '../../src/game/missions/targets'
import { FLOOR_BANDS } from '../../src/game/world/walkable'
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

describe('sectorsAt con altura: un piso elevado cuenta solo en su banda vertical', () => {
  const at = (id: string, x: number, y: number, floor: Sector['floor']): Sector => ({ id, name: id, position: [x, y, 0], floor }) as Sector
  const s = [at('suelo', 0.5, 0, 'terreno'), at('pt', 0, 3.606, 'pisoTrabajo'), at('pe', 0, 20.651, 'pisoEnganche')]
  it('bandas derivadas de las alturas medidas (traversal.json)', () => {
    expect(FLOOR_BANDS.pisoTrabajo[0]).toBeGreaterThan(2.639) // cubierta más alta del nivel del suelo (trip tank)
    expect(FLOOR_BANDS.pisoTrabajo[0]).toBeLessThan(3.606)
    expect(FLOOR_BANDS.pisoEnganche[0]).toBeLessThan(20.651)
    expect(FLOOR_BANDS.pisoEnganche[1]).toBeGreaterThan(20.651)
  })
  it('de pie en el suelo debajo de los pisos solo cuenta el sector del suelo', () => expect(sectorsAt([0, 0, 0], s)).toEqual(['suelo']))
  it('sobre una cubierta de pileta (2,64) sigue siendo nivel del suelo', () => expect(sectorsAt([0, 2.639, 0], s)).toEqual(['suelo']))
  it('en el piso de trabajo cuenta el piso de trabajo, no el suelo', () => expect(sectorsAt([0, 3.606, 0], s)).toEqual(['pt']))
  it('en el piso de enganche cuenta solo el piso de enganche', () => expect(sectorsAt([0, 20.651, 0], s)).toEqual(['pe']))
  it('a mitad de la escalera vertical no cuenta ninguno', () => expect(sectorsAt([0, 12, 0], s)).toEqual([]))
})

describe('sin cascada: con solo el sector más cercano, un objetivo nuevo pide llegar a su propio sector', () => {
  beforeEach(() => vi.restoreAllMocks())
  it('al avanzar, re-informar el mismo sector no completa el objetivo siguiente aunque compartan radio', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const e = createEngine([mission('m', { id: '1', kind: 'reach', text: 't', sectorId: 'a' }, { id: '2', kind: 'reach', text: 't', sectorId: 'b' })], data)
    e.start('m')
    e.report({ type: 'at', sectorId: 'c' })
    e.report({ type: 'at', sectorId: 'a' })
    expect(e.state().objectiveIndex).toBe(1)
    e.report({ type: 'at', sectorId: 'a' }) // el reporter re-informa tras avanzar
    expect(e.state().objectiveIndex).toBe(1)
    e.report({ type: 'at', sectorId: 'b' })
    expect(e.state().status).toBe('completed')
  })
})

describe('objetivo interact', () => {
  beforeEach(() => vi.restoreAllMocks())
  const vdata: GameData = { ...data, interactables: [{ id: 'v1', position: [0, 1, 0] }, { id: 'v2', position: [1, 1, 0] }] }
  const one = (o: Objective) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const e = createEngine([mission('m', o)], vdata)
    e.start('m')
    return e
  }
  it('avanza al operar la válvula pedida y guarda el estado como registro propio', () => {
    const e = one({ id: 'i', kind: 'interact', text: 'Operá', targetId: 'v1' })
    e.report({ type: 'interact', targetId: 'v1', state: 'closed' })
    expect(e.state().status).toBe('completed')
    expect(e.state().results.i).toEqual({ kind: 'interact', targetId: 'v1', state: 'closed' })
  })
  it('ignora otras válvulas', () => {
    const e = one({ id: 'i', kind: 'interact', text: 'Operá', targetId: 'v1' })
    e.report({ type: 'interact', targetId: 'v2', state: 'open' })
    expect(e.state().status).toBe('active')
    expect(e.state().objectiveIndex).toBe(0)
  })
  it('respeta desiredState cuando existe', () => {
    const e = one({ id: 'i', kind: 'interact', text: 'Operá', targetId: 'v1', desiredState: 'open' })
    e.report({ type: 'interact', targetId: 'v1', state: 'closed' })
    expect(e.state().status).toBe('active')
    e.report({ type: 'interact', targetId: 'v1', state: 'open' })
    expect(e.state().status).toBe('completed')
  })
  it('targetId desconocido (o sin interactuables en los datos) => misión omitida', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const e = createEngine([mission('x', { id: 'i', kind: 'interact', text: 't', targetId: 'nope' })], vdata)
    expect(e.available).toEqual([])
    expect(e.omitted[0].reason).toMatch(/nope/)
    expect(createEngine([mission('y', { id: 'i', kind: 'interact', text: 't', targetId: 'v1' })], data).available).toEqual([])
  })
  it('objectiveTargets apunta a la posición de la válvula', () => {
    const def = mission('m', { id: 'i', kind: 'interact', text: 't', targetId: 'v2' })
    const st = { ...createEngine([], vdata).state(), status: 'active' as const, missionId: 'm' }
    expect(objectiveTargets(def, st, vdata.sectors, vdata.interactables)).toEqual([[1, 1, 0]])
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
