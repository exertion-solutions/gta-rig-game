import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildFicha } from '../../src/game/data/ficha'
import { getSectors } from '../../src/game/data/sectors'
import { ALL_MISSIONS } from '../../src/game/missions/defs'
import { m2Count, m2Target } from '../../src/game/missions/defs/m2'
import { m8, windConflictSentence } from '../../src/game/missions/defs/m8'
import { createEngine } from '../../src/game/missions/engine'
import type { GameData, MissionDef, Objective } from '../../src/game/missions/types'

const data: GameData = { sectors: getSectors() }
const byId = (n: number) => ALL_MISSIONS[n - 1]
const texts = (d: MissionDef) => [
  d.title,
  d.briefing,
  ...d.objectives.flatMap((o) => [o.text, ...(o.kind === 'choose' ? o.options.map((x) => x.text) : o.kind === 'order' ? o.items.map((x) => x.text) : [])]),
]
const allText = (d: MissionDef) => texts(d).join('\n')
const plain = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

describe('las 8 misiones con los datos vendorizados', () => {
  it('están en el orden del spec y cada una tiene requires', () => {
    expect(ALL_MISSIONS.map((m) => m.id.slice(0, 2))).toEqual(['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8'])
    expect(ALL_MISSIONS.map((m) => m.title)).toEqual([
      'Reconocimiento', '¿Qué hace cada sector?', 'Mapa de zonas', 'Retención en altura',
      '¿Secundaria requerida?', 'Zona sin clasificar', 'Orden del montaje', 'Fuente en conflicto',
    ])
    for (const m of ALL_MISSIONS) expect(typeof m.requires).toBe('function')
  })

  it('1 a 7 devuelven requires [] con los datos vendorizados', () => {
    for (const m of ALL_MISSIONS.slice(0, 7)) expect(m.requires(data), m.id).toEqual([])
  })

  it('el motor deja disponibles 1 a 7 y omite solo la 8, con su motivo', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const e = createEngine(ALL_MISSIONS, data)
    expect(e.available.map((m) => m.id.slice(0, 2))).toEqual(['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'])
    expect(e.omitted.map((o) => o.id)).toEqual([m8.id])
    expect(e.omitted[0].reason).toMatch(/25 ± 3 m y 20 m.*no están en los datos vendorizados/)
    warn.mockRestore()
  })

  it('m8: los datos vendorizados no traen las dos cifras de vientos, por eso se omite (nunca se inventan)', () => {
    for (const f of ['drops.json', 'viewpoints.json', 'layout_locacion.json', 'secuencia.json'])
      expect(readFileSync(`vendor/visor/${f}`, 'utf8'), f).not.toMatch(/25\s*±\s*3/)
    expect(windConflictSentence()).toBeNull()
    expect(m8.requires(data)).toHaveLength(1)
    expect(allText(m8)).not.toMatch(/25|\b20 m\b/) // la misión omitida tampoco lleva cifras propias
  })

  it('ningún texto de misión contiene las raíces aprob/habilit/certific (sin acentos, mayúsculas indistintas)', () => {
    for (const m of ALL_MISSIONS) expect(plain(allText(m)), m.id).not.toMatch(/aprob|habilit|certific/)
  })

  it('sin distancias, radios, zonas de exclusión ni "área segura"; sin marcas comerciales', () => {
    for (const m of ALL_MISSIONS) {
      const t = allText(m)
      expect(t, m.id).not.toMatch(/\d\s?(m|mts?|metros|km|ft|pies)\b/i)
      expect(plain(t), m.id).not.toMatch(/radio|exclusion|area segura/)
      expect(t, m.id).not.toMatch(/koomey|ypf/i)
    }
  })

  it('ninguna misión usa el nombre crudo del sector (con marca comercial): los nombres salen de buildFicha', () => {
    for (const m of ALL_MISSIONS) expect(allText(m), m.id).not.toContain('(Koomey)')
    const acu = byId(2).objectives.flatMap((o) => (o.kind === 'choose' ? o.options : [])).filter((o) => o.id === 'acumulador')
    expect(acu.length).toBeGreaterThan(0)
    for (const o of acu) expect(o.text).toBe(buildFicha('acumulador').name)
  })

  it('los puntos DROPS dudosos nunca se presentan como requisito ni aparecen en las misiones', () => {
    const doubtful = ['COR-5', 'COR-10', 'COR-11', 'PLA-1', 'PRL-1', 'PRL-2', 'BP-2']
    for (const m of ALL_MISSIONS) {
      const t = allText(m)
      for (const id of doubtful) if (id !== 'PRL-1' && id !== 'PRL-2') expect(t, `${m.id} ${id}`).not.toContain(id)
    }
    // m6 menciona el rango del poste-llave (PRL-1 a PRL-3) solo como ubicación, sin leer su contenido ni llamarlo requisito.
    expect(plain(allText(byId(6)))).not.toMatch(/requisito|obligatori|debe/)
  })

  it('las misiones con sectores requieren posición documentada (sector sin posición -> se omite)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const sin = { sectors: data.sectors.map((s) => (s.id === 'mastil' ? { ...s, position: null } : s)) }
    const e = createEngine(ALL_MISSIONS, sin)
    const omitted = e.omitted.map((o) => o.id.slice(0, 2))
    // m1 (14 sectores), m3 (corona), m5 (mástil) y m8 usan el mástil
    expect(omitted).toEqual(expect.arrayContaining(['m1', 'm3', 'm5', 'm8']))
    expect(e.available.map((m) => m.id.slice(0, 2))).toEqual(expect.arrayContaining(['m2', 'm4', 'm6', 'm7']))
    vi.restoreAllMocks()
  })
})

describe('m1 Reconocimiento', () => {
  it('llegar al Acceso y luego visitar los 14 sectores; el spawn en el Acceso no cuenta', () => {
    const m = byId(1)
    expect(m.objectives.map((o) => o.kind)).toEqual(['reach', 'visitAll'])
    const v = m.objectives[1] as Extract<Objective, { kind: 'visitAll' }>
    expect(v.sectorIds).toHaveLength(14)
    expect(new Set(v.sectorIds).size).toBe(14)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const e = createEngine([m], data)
    e.start(m.id)
    e.report({ type: 'at', sectorId: 'acceso', inside: ['acceso'] })
    expect(e.state().objectiveIndex).toBe(0)
    e.report({ type: 'at', sectorId: null, inside: [] })
    e.report({ type: 'at', sectorId: 'acceso', inside: ['acceso'] })
    expect(e.state().objectiveIndex).toBe(1)
    vi.restoreAllMocks()
  })
})

describe('m2 ¿Qué hace cada sector?', () => {
  const m = byId(2)
  const qs = m.objectives as Extract<Objective, { kind: 'choose' }>[]

  it('8 preguntas de 4 opciones, la correcta incluida, todas con advanceOnWrong', () => {
    expect(qs).toHaveLength(8)
    for (const q of qs) {
      expect(q.kind).toBe('choose')
      expect(q.options).toHaveLength(4)
      expect(new Set(q.options.map((o) => o.id)).size).toBe(4)
      expect(q.correct).toHaveLength(1)
      expect(q.options.map((o) => o.id)).toContain(q.correct[0])
      expect(q.advanceOnWrong).toBe(true)
    }
    expect(new Set(qs.map((q) => q.correct[0])).size).toBe(8)
  })

  it('el texto de la pregunta es la función del viewpoint (saneada), no un texto propio', () => {
    for (const q of qs) expect(q.text).toContain(buildFicha(q.correct[0]).texts[0].text)
  })

  it('la meta 6/8 se cuenta desde results[id].correct', () => {
    expect(m2Target(8)).toBe(6)
    expect(m2Target(5)).toBe(4)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const e = createEngine([m], data)
    e.start(m.id)
    qs.forEach((q, i) => e.report({ type: 'choose', objectiveId: q.id, picked: [i < 6 ? q.correct[0] : q.options.find((o) => o.id !== q.correct[0])!.id] }))
    const s = e.state()
    expect(s.status).toBe('completed')
    expect(m2Count(s.results)).toBe(6)
    const lines = m.summary!(s.results).join(' ')
    expect(lines).toContain('6 de 8')
    expect(plain(lines)).not.toMatch(/aprob|habilit|certific|felicit|fallaste|perdiste/)
    vi.restoreAllMocks()
  })
})

describe('m3 Mapa de zonas', () => {
  it('en boca de pozo expone A2 = Medio y RCCO = Alto como "Fuente en conflicto"', () => {
    const z = buildFicha('bop').zones.find((x) => x.sectionId === 'boca-pozo')!
    expect(z.level).toBe('medio')
    expect(z.conflict?.title).toBe('Fuente en conflicto')
    const lv = Object.fromEntries(z.conflict!.lines.map((l) => [l.label, l.level]))
    expect(lv['Layout A2']).toBe('medio')
    expect(lv['RCCO']).toBe('alto')
    const t = byId(3).objectives.find((o) => o.id === 'm3-boca-pozo')!.text
    expect(t).toContain('Fuente en conflicto')
    expect(t).toContain('Layout A2 Medio')
    expect(t).toContain('RCCO Alto')
  })

  it('corona y piso de enganche = Alto, subestructura y casilla = Medio, piletas = Bajo, solo como texto con fuente', () => {
    const t = (id: string) => byId(3).objectives.find((o) => o.id === id)!.text
    expect(t('m3-corona')).toContain('Zona A2: Alto')
    expect(t('m3-enganche')).toContain('Zona A2: Alto')
    expect(t('m3-subestructura')).toMatch(/Subestructura y Carrier: Zona A2: Medio/)
    expect(t('m3-subestructura')).toMatch(/Casilla de Maquinista: Zona A2: Medio/)
    expect(t('m3-piletas')).toContain('Zona A2: Bajo')
    for (const o of byId(3).objectives) expect(o.text).toContain('fuente proc-drops-a2')
  })
})

describe('m4 Retención en altura', () => {
  const m = byId(4)
  it('lee PE-3 y PE-4 de DROPS con su fuente y los autorregistra sin evaluar', () => {
    const marks = m.objectives.filter((o) => o.kind === 'mark')
    expect(marks.map((o) => o.id)).toEqual(['m4-PE-3', 'm4-PE-4'])
    const pe3 = buildFicha('piso-enganche').points.find((p) => p.id === 'PE-3')!
    expect(marks[0].text).toContain(pe3.name)
    expect(marks[0].text).toContain('fuente libro-drops-2024')
    expect(marks[0].text).toContain('Primaria')
    expect(marks[0].text).toContain('Secundaria')
  })
  it('el resumen refleja lo marcado, sin calificar', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const e = createEngine([m], data)
    e.start(m.id)
    e.report({ type: 'at', sectorId: null, inside: [] })
    e.report({ type: 'at', sectorId: 'piso-enganche', inside: ['piso-enganche'] })
    e.report({ type: 'mark', objectiveId: 'm4-PE-3', value: 'OK' })
    e.report({ type: 'mark', objectiveId: 'm4-PE-4', value: 'NOK' })
    expect(e.state().status).toBe('completed')
    const lines = m.summary!(e.state().results)
    expect(lines).toContain('PE-3: OK')
    expect(lines).toContain('PE-4: NOK')
    expect(plain(lines.join(' '))).not.toMatch(/aprob|habilit|certific|correct|incorrect/)
    vi.restoreAllMocks()
  })
})

describe('m5 ¿Secundaria requerida?', () => {
  it('BP-4 y DCO-3 (secundaria requerida) frente a PE-3 y PE-4 (no requerida), leído del dato', () => {
    const q = byId(5).objectives[1] as Extract<Objective, { kind: 'choose' }>
    expect([...q.correct].sort()).toEqual(['BP-4', 'DCO-3'])
    expect(q.options.map((o) => o.id).sort()).toEqual(['BP-4', 'DCO-3', 'PE-3', 'PE-4'])
    for (const id of ['BP-4', 'DCO-3', 'PE-3', 'PE-4']) expect(q.text).toContain(id)
    expect(q.text).toContain('fuente libro-drops-2024')
  })
})

describe('m6 Zona sin clasificar', () => {
  const m = byId(6)
  it("muestra 'No clasificada en layout A2' y nunca 'Baja'", () => {
    const t = allText(m)
    expect(t).toContain('No clasificada en layout A2')
    expect(t).not.toMatch(/\bbaj[oa]s?\b/i)
    expect(m.objectives.map((o) => (o.kind === 'reach' ? o.sectorId : ''))).toEqual(['piso-trabajo', 'llave'])
    expect(m.objectives.every((o) => o.text.includes('No clasificada en layout A2'))).toBe(true)
  })
  it('PT y PRL salen de los datos (hoy PT-1 a PT-6 y PRL-1 a PRL-3)', () => {
    expect(m.objectives[0].text).toContain('PT-1 a PT-6')
    expect(m.objectives[1].text).toContain('PRL-1 a PRL-3')
  })
})

describe('m7 Orden del montaje', () => {
  const m = byId(7)
  const o = m.objectives[0] as Extract<Objective, { kind: 'order' }>
  const sec = JSON.parse(readFileSync('vendor/visor/secuencia.json', 'utf8')) as { pasos: { orden: number; texto: string }[] }

  it('los 8 pasos de secuencia.json, rotulados pendiente de validación y sin tiempos', () => {
    expect(o.kind).toBe('order')
    expect(o.items).toHaveLength(8)
    expect(o.correctOrder).toEqual(sec.pasos.map((p) => `paso-${p.orden}`))
    expect(plain(m.briefing)).toContain('pendiente de validacion')
    expect(plain(o.text)).toContain('pendiente de validacion')
    expect(allText(m)).not.toMatch(/\b\d+\s*(min|minutos|h|horas|seg)\b/i)
  })
  it('el orden inicial no es la solución ni deja pasos en su lugar', () => {
    const ids = o.items.map((i) => i.id)
    expect(ids).not.toEqual(o.correctOrder)
    ids.forEach((id, i) => expect(id).not.toBe(o.correctOrder[i]))
  })
  it('se completa con el orden correcto y reintenta con uno incorrecto', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const e = createEngine([m], data)
    e.start(m.id)
    e.report({ type: 'order', objectiveId: o.id, order: o.items.map((i) => i.id) })
    expect(e.state()).toMatchObject({ status: 'active', feedback: 'retry' })
    e.report({ type: 'order', objectiveId: o.id, order: o.correctOrder })
    expect(e.state().status).toBe('completed')
    vi.restoreAllMocks()
  })
})

describe('data de misiones: sin posiciones null en los sectores que usan', () => {
  beforeEach(() => vi.restoreAllMocks())
  it('todos los sectores del juego tienen posición documentada', () => {
    expect(getSectors().filter((s) => !s.position)).toEqual([])
  })
})
