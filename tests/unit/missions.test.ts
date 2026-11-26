import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ARRIVAL_RADIUS, createEngine, sectorAt } from '../../src/game/missions/engine'
import type { GameData, MissionDef } from '../../src/game/missions/types'
import { STORAGE_KEY, useMissionStore } from '../../src/game/missions/store'
import type { Sector } from '../../src/game/data/sectors'

const sec = (id: string, x: number, z: number | null): Sector =>
  ({ id, name: id, position: z === null ? null : [x, 0, z] }) as Sector
const data: GameData = { sectors: [sec('acceso', 0, 0), sec('bomba', 20, 0), sec('pileta', 40, 0), sec('fantasma', 0, null)] }
const none = () => []

const defs: MissionDef[] = [
  {
    id: 'm1', title: 'Recorrido', briefing: 'Visitá los sectores',
    objectives: [
      { id: 'o1', kind: 'reach', text: 'Andá a la bomba', sectorId: 'bomba' },
      { id: 'o2', kind: 'visitAll', text: 'Visitá todos', sectorIds: ['acceso', 'pileta'] },
    ],
    requires: none,
  },
  { id: 'faltan', title: 'X', briefing: 'x', objectives: [{ id: 'a', kind: 'mark', text: 't' }], requires: () => ['dato A2'] },
  { id: 'sinpos', title: 'X', briefing: 'x', objectives: [{ id: 'a', kind: 'reach', text: 't', sectorId: 'fantasma' }], requires: none },
  { id: 'palabra', title: 'Estás aprobado', briefing: 'x', objectives: [{ id: 'a', kind: 'mark', text: 't' }], requires: none },
  {
    id: 'q', title: 'Preguntas', briefing: 'x', requires: none,
    objectives: [
      { id: 'c', kind: 'choose', text: 'p', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correct: ['b'] },
      { id: 'r', kind: 'order', text: 'o', items: [{ id: '1', text: '1' }, { id: '2', text: '2' }], correctOrder: ['1', '2'] },
      { id: 'k', kind: 'mark', text: 'm' },
    ],
  },
]

const mk = () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  return createEngine(defs, data)
}

describe('motor de misiones', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('una misión con requires no vacío queda en omitted y no en available', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const e = createEngine(defs, data)
    expect(e.available.map((d) => d.id)).toEqual(['m1', 'q'])
    expect(e.omitted.find((o) => o.id === 'faltan')?.reason).toContain('dato A2')
    expect(e.omitted.find((o) => o.id === 'sinpos')?.reason).toContain('sin posición')
    expect(e.omitted.find((o) => o.id === 'palabra')).toBeTruthy()
    expect(warn).toHaveBeenCalledTimes(3)
    e.start('faltan')
    expect(e.state().status).toBe('idle')
  })

  it('report(reach) avanza al siguiente objetivo; el spawn no cuenta como visita', () => {
    const e = mk()
    e.start('m1')
    e.report({ type: 'at', sectorId: 'bomba' }) // ya estaba dentro al empezar
    expect(e.state().objectiveIndex).toBe(0)
    e.report({ type: 'at', sectorId: null })
    e.report({ type: 'at', sectorId: 'bomba' })
    expect(e.state().objectiveIndex).toBe(1)
  })

  it('visitAll acepta cualquier orden y solo cuenta tras haber salido del radio', () => {
    const e = mk()
    e.start('m1')
    e.report({ type: 'at', sectorId: 'acceso' }) // spawn
    e.report({ type: 'at', sectorId: 'bomba' })
    expect(e.state().objectiveIndex).toBe(1)
    e.report({ type: 'at', sectorId: 'pileta' })
    expect(e.state()).toMatchObject({ visited: ['pileta'], status: 'active' })
    e.report({ type: 'at', sectorId: 'acceso' })
    expect(e.state().status).toBe('completed')
  })

  it('choose / order reintentan sin penalizar; mark registra sin evaluar', () => {
    const e = mk()
    e.start('q')
    e.report({ type: 'choose', objectiveId: 'c', picked: ['a'] })
    expect(e.state()).toMatchObject({ objectiveIndex: 0, feedback: 'retry' })
    e.report({ type: 'choose', objectiveId: 'c', picked: ['b'] })
    e.report({ type: 'order', objectiveId: 'r', order: ['2', '1'] })
    expect(e.state().objectiveIndex).toBe(1)
    e.report({ type: 'order', objectiveId: 'r', order: ['1', '2'] })
    e.report({ type: 'mark', objectiveId: 'k', value: 'NOK' })
    const s = e.state()
    expect(s.status).toBe('completed')
    expect(s.results.k).toEqual({ kind: 'mark', value: 'NOK' })
  })

  it('fallar o salir no pena: restart devuelve estado inicial', () => {
    const e = mk()
    e.start('q')
    e.report({ type: 'choose', objectiveId: 'c', picked: ['a'] })
    e.report({ type: 'choose', objectiveId: 'c', picked: ['b'] })
    e.restart()
    expect(e.state()).toMatchObject({ status: 'active', missionId: 'q', objectiveIndex: 0, feedback: null, results: {} })
    e.exit()
    expect(e.state().status).toBe('idle')
  })

  it("completar la misión marca completada sin texto 'aprobado'", () => {
    const e = mk()
    e.start('q')
    e.report({ type: 'choose', objectiveId: 'c', picked: ['b'] })
    e.report({ type: 'order', objectiveId: 'r', order: ['1', '2'] })
    e.report({ type: 'mark', objectiveId: 'k', value: 'OK' })
    expect(e.state().status).toBe('completed')
    expect(JSON.stringify(e.state())).not.toMatch(/aprobad|habilitad|certificad/i)
  })

  it('sectorAt devuelve el sector más cercano dentro del radio', () => {
    expect(sectorAt([1, 0, 1], data.sectors)).toBe('acceso')
    expect(sectorAt([20, 0, ARRIVAL_RADIUS + 1], data.sectors)).toBeNull()
  })
})

describe('store de misiones', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('el store funciona si localStorage lanza', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const boom = () => {
      throw new Error('SecurityError')
    }
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom })
    const st = useMissionStore.getState()
    expect(() => st.init(defs, data)).not.toThrow()
    useMissionStore.getState().start('q')
    useMissionStore.getState().report({ type: 'choose', objectiveId: 'c', picked: ['b'] })
    useMissionStore.getState().report({ type: 'order', objectiveId: 'r', order: ['1', '2'] })
    useMissionStore.getState().report({ type: 'mark', objectiveId: 'k', value: 'N/A' })
    const s = useMissionStore.getState()
    expect(s.mission.status).toBe('completed')
    expect(s.log.completed).toEqual(['q'])
    expect(s.log.marks['q/k']).toBe('N/A')
    vi.unstubAllGlobals()
  })

  it('persiste en localStorage cuando está disponible', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const mem: Record<string, string> = {}
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => void (mem[k] = v) })
    useMissionStore.getState().init(defs, data)
    useMissionStore.getState().start('q')
    useMissionStore.getState().report({ type: 'choose', objectiveId: 'c', picked: ['b'] })
    useMissionStore.getState().report({ type: 'order', objectiveId: 'r', order: ['1', '2'] })
    useMissionStore.getState().report({ type: 'mark', objectiveId: 'k', value: 'OK' })
    expect(JSON.parse(mem[STORAGE_KEY]).completed).toEqual(['q'])
    useMissionStore.getState().init(defs, data) // recarga
    expect(useMissionStore.getState().log.completed).toEqual(['q'])
    vi.unstubAllGlobals()
  })
})
