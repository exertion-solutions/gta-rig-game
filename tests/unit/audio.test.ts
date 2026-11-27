import { describe, expect, it } from 'vitest'
import { DEFAULT_MIX, MIX_KEY, busGain, loadMix, saveMix } from '../../src/audio/mix'
import { engineParams, stepInterval } from '../../src/audio/params'
import { LINK_LINES, createRadioQueue, lineHash, lineIds, missionLines, readMs, splitSubtitles } from '../../src/audio/radio'
import { containsForbiddenUiWord } from '../../src/game/data/evidence'
import { ALL_MISSIONS } from '../../src/game/missions/defs'
import { RUN_SPEED, WALK_SPEED } from '../../src/game/player/movement'
import { TRUCK } from '../../src/game/vehicle/truckModel'

const memory = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init))
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
}

describe('mezcla de volúmenes', () => {
  it('sin nada guardado usa la mezcla por defecto', () => {
    expect(loadMix(memory())).toEqual(DEFAULT_MIX)
  })
  it('guarda y vuelve a cargar volúmenes y mute', () => {
    const s = memory()
    saveMix({ ...DEFAULT_MIX, sfx: 0.3, muted: true }, s)
    expect(JSON.parse(s.m.get(MIX_KEY)!).sfx).toBe(0.3)
    expect(loadMix(s)).toEqual({ ...DEFAULT_MIX, sfx: 0.3, muted: true })
  })
  it('JSON roto, valores fuera de rango o storage que lanza: no rompe', () => {
    expect(loadMix(memory({ [MIX_KEY]: '{no json' }))).toEqual(DEFAULT_MIX)
    expect(loadMix(memory({ [MIX_KEY]: JSON.stringify({ master: 7, voice: -1, ambient: 'x', muted: 'si' }) }))).toEqual({
      ...DEFAULT_MIX, master: 1, voice: 0,
    })
    const boom = { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('bloqueado') } }
    expect(loadMix(boom)).toEqual(DEFAULT_MIX)
    expect(() => saveMix(DEFAULT_MIX, boom)).not.toThrow()
  })
  it('ganancia de bus = maestro x bus; mute la lleva a 0', () => {
    const m = { ...DEFAULT_MIX, master: 0.5, sfx: 0.5 }
    expect(busGain(m, 'sfx')).toBeCloseTo(0.25)
    expect(busGain({ ...m, muted: true }, 'sfx')).toBe(0)
  })
})

describe('motor y pasos', () => {
  it('el motor sube de tono y volumen con la velocidad, igual marcha atrás, y satura en la máxima', () => {
    const idle = engineParams(0)
    const mid = engineParams(TRUCK.maxSpeed / 2)
    const top = engineParams(TRUCK.maxSpeed)
    expect(mid.freq).toBeGreaterThan(idle.freq)
    expect(top.freq).toBeGreaterThan(mid.freq)
    expect(top.gain).toBeGreaterThan(idle.gain)
    expect(engineParams(-TRUCK.maxSpeed / 2)).toEqual(mid)
    expect(engineParams(TRUCK.maxSpeed * 3)).toEqual(top)
    expect(idle.gain).toBeGreaterThan(0) // ralentí audible
  })
  it('pasos: ninguno quieto, más seguidos corriendo que caminando', () => {
    expect(stepInterval(0)).toBeNull()
    const walk = stepInterval(WALK_SPEED)!
    const run = stepInterval(RUN_SPEED)!
    expect(walk).toBeGreaterThan(run)
    expect(run).toBeGreaterThan(0.2)
    expect(walk).toBeLessThan(0.8)
    expect(stepInterval(RUN_SPEED * 2)).toBe(run)
  })
})

describe('radio del instructor', () => {
  it('la cola reproduce en orden, avanza con next y se vacía con clear', () => {
    const q = createRadioQueue()
    expect(q.current()).toBeNull()
    q.push([{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }])
    expect(q.current()?.id).toBe('a')
    q.push([{ id: 'c', text: 'C' }, { id: 'b', text: 'B' }]) // b ya en cola: no se repite
    expect(q.next()?.id).toBe('b')
    expect(q.next()?.id).toBe('c')
    expect(q.next()).toBeNull()
    q.push([{ id: 'd', text: 'D' }])
    q.clear()
    expect(q.current()).toBeNull()
  })
  it('misión: enlace, briefing literal, objetivos desde el 2.º literales y cierre', () => {
    const def = ALL_MISSIONS[0]
    const lines = missionLines(def)
    expect(lines[0]).toEqual(LINK_LINES.inicio)
    expect(lines[1]).toEqual({ id: `${def.id}/briefing`, text: def.briefing })
    expect(lines.slice(2, -1).map((l) => l.text)).toEqual(def.objectives.slice(1).map((o) => o.text))
    expect(lines.at(-1)).toEqual(LINK_LINES.completada)
  })
  it('lineIds sin repetidos y con todas las misiones', () => {
    const ids = lineIds(ALL_MISSIONS)
    expect(new Set(ids).size).toBe(ids.length)
    for (const m of ALL_MISSIONS) expect(ids).toContain(`${m.id}/briefing`)
  })
  it('ninguna línea dice aprobado/habilitado/certificado ni zona/área no documentada', () => {
    const plain = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    const texts = [...Object.values(LINK_LINES), ...ALL_MISSIONS.flatMap(missionLines)].map((l) => l.text)
    for (const t of texts) {
      expect(plain(t)).not.toMatch(/aprob|habilit|certific/)
      expect(containsForbiddenUiWord(t)).toBe(false)
    }
  })
  it('las frases de enlace no traen cifras (sin contenido técnico nuevo)', () => {
    for (const l of Object.values(LINK_LINES)) expect(l.text).not.toMatch(/\d/)
  })
  it('subtítulos: cortes por oración, ninguno largo, el texto completo se conserva', () => {
    for (const m of ALL_MISSIONS)
      for (const l of missionLines(m)) {
        const parts = splitSubtitles(l.text)
        expect(parts.join(' ').replace(/\s+/g, ' ')).toBe(l.text.replace(/\s+/g, ' ').trim())
        for (const p of parts) expect(p.length).toBeLessThanOrEqual(160)
      }
    expect(splitSubtitles('Uno. Dos.')).toEqual(['Uno. Dos.'])
    expect(splitSubtitles(`${'a'.repeat(100)}. ${'b'.repeat(100)}.`)).toHaveLength(2)
  })
  it('tiempo de lectura crece con el texto y tiene mínimo', () => {
    expect(readMs('Hola.')).toBeGreaterThanOrEqual(2000)
    expect(readMs('x'.repeat(150))).toBeGreaterThan(readMs('x'.repeat(30)))
  })
  it('el hash del texto cambia si cambia el texto (invalida la voz grabada)', () => {
    expect(lineHash('Llegá al Acceso.')).toBe(lineHash('Llegá al Acceso.'))
    expect(lineHash('Llegá al Acceso.')).not.toBe(lineHash('Llegá al Acceso'))
    expect(lineHash('a')).toMatch(/^[0-9a-f]{8}$/)
  })
})
