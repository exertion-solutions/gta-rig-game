import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import drops from '../../vendor/visor/drops.json'
import layout from '../../vendor/visor/layout_locacion.json'
import viewpoints from '../../vendor/visor/viewpoints.json'
import { LEYENDA, containsForbiddenUiWord } from '../../src/game/data/evidence'
import { buildFicha, validateFicha, type Ficha } from '../../src/game/data/ficha'
import { ACCESO_POSITION, buildSectors, getSector, getSectors } from '../../src/game/data/sectors'
import { LOCACION_BOUNDS } from '../../src/game/world/frame'
import { RESPAWN } from '../../src/game/player/movement'
import { Ficha as FichaView } from '../../src/ui/Ficha'

describe('getSectors', () => {
  it('devuelve 14 sectores con id único', () => {
    const s = getSectors()
    expect(s).toHaveLength(14)
    expect(new Set(s.map((x) => x.id)).size).toBe(14)
  })

  it('un sector sin posición documentada tiene position null', () => {
    const vp = {
      ...viewpoints,
      viewpoints: [
        { ...viewpoints.viewpoints[1], target: undefined, camPos: undefined }, // con objeto pero sin target
        { ...viewpoints.viewpoints[0], camPos: undefined }, // sin objeto y sin camPos
      ],
    }
    const s = buildSectors(vp as never, layout)
    expect(s.map((x) => x.position)).toEqual([null, null])
    expect(s.every((x) => x.positionSource === null)).toBe(true)
  })

  it('con datos reales toda posición documentada cae dentro de la locación, a la cota de su piso', () => {
    for (const s of getSectors()) {
      expect(s.position, s.id).not.toBeNull()
      const [x, y, z] = s.position!
      expect(x).toBeGreaterThanOrEqual(LOCACION_BOUNDS.minX)
      expect(x).toBeLessThanOrEqual(LOCACION_BOUNDS.maxX)
      expect(z).toBeGreaterThanOrEqual(LOCACION_BOUNDS.minZ)
      expect(z).toBeLessThanOrEqual(LOCACION_BOUNDS.maxZ)
      expect(y).toBe((viewpoints.pisos as Record<string, { cota: number }>)[s.floor].cota)
    }
  })

  it('Acceso: posición = punto del recorrido del visor; el respawn del jugador la usa', () => {
    expect(getSector('acceso')?.position).toEqual(ACCESO_POSITION)
    expect(ACCESO_POSITION).toEqual([-26, 0, -24])
    expect(RESPAWN).toEqual(ACCESO_POSITION)
  })

  it('el layout (z invertido respecto del marco GLB) contiene el target de acumulador, bomba y planchada', () => {
    for (const id of ['acumulador', 'bomba', 'planchada']) {
      const s = getSector(id)!
      expect(s.footprint, id).not.toBeNull()
      const f = s.footprint!
      const [x, , z] = s.position!
      expect(x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ, id).toBe(true)
    }
  })
})

const all = () => getSectors().map((s) => buildFicha(s.id))
const walk = (o: unknown, f: (k: string, v: unknown) => void) => {
  if (Array.isArray(o)) o.forEach((x) => walk(x, f))
  else if (o && typeof o === 'object')
    for (const [k, v] of Object.entries(o)) {
      f(k, v)
      walk(v, f)
    }
}

describe('buildFicha', () => {
  it('incluye sourceId en cada dato numérico y en cada punto DROPS', () => {
    for (const f of all()) {
      expect(() => validateFicha(f)).not.toThrow()
      f.points.forEach((p) => expect(p.sourceId, p.id).toBeTruthy())
      f.texts.filter((t) => /\d/.test(t.text)).forEach((t) => expect(t.sourceId).toBeTruthy())
    }
    expect(all().flatMap((f) => f.points).length).toBeGreaterThan(30)
  })

  it('validateFicha rechaza un dato numérico sin sourceId y un estatus fuera del enum', () => {
    const f = buildFicha('mastil')
    const bad = (m: (x: Ficha) => void) => {
      const c = structuredClone(f)
      m(c)
      return () => validateFicha(c)
    }
    expect(bad((c) => (c.texts[0] = { ...c.texts[0], text: 'carga 5 t', sourceId: undefined }))).toThrow(/sourceId/)
    expect(bad((c) => ((c.points[0] as { evidence: string }).evidence = 'approved'))).toThrow(/evidencia/)
    expect(bad((c) => (c.points[0].sourceId = ''))).toThrow(/sourceId/)
  })

  it('nunca incluye radios ni distancias de zona: la zona es solo texto', () => {
    const unit = /\d\s*(m|mt|mts|metros|cm|mm|km|ft|pies)\b/i
    for (const f of all()) {
      walk(f.zones, (k, v) => {
        expect(k).not.toMatch(/radi|dist|altura|cota|metros|size|shape/i)
        if (typeof v === 'string') expect(v).not.toMatch(unit)
      })
      f.zones.forEach((z) => expect(z.text).not.toMatch(/radio|distancia/i))
    }
    const jsonZones = JSON.stringify(all().flatMap((f) => f.zones))
    expect(jsonZones).not.toMatch(/"(radius|radiusM|radio|distance|distancia)"/i)
  })

  it('boca de pozo: bloque "Fuente en conflicto" con Layout A2: Medio y RCCO: Alto, cada uno con su sourceId', () => {
    const z = buildFicha('bop').zones.find((x) => x.sectionId === 'boca-pozo')!
    expect(z.level).toBe('medio')
    expect(z.conflict?.title).toBe('Fuente en conflicto')
    expect(z.conflict?.lines).toEqual([
      { label: 'Layout A2', level: 'medio', sourceId: 'proc-drops-a2', evidence: 'pendingValidation' },
      { label: 'RCCO', level: 'alto', sourceId: 'proc-drops-a3', evidence: 'procedure' },
    ])
    const html = renderToStaticMarkup(createElement(FichaView, { ficha: buildFicha('bop') }))
    expect(html).toContain('Fuente en conflicto')
    expect(html).toContain('Layout A2: Medio')
    expect(html).toContain('RCCO: Alto')
    expect(html).toContain('proc-drops-a2')
    expect(html).toContain('proc-drops-a3')
  })

  it('conflictos: exactamente los sectores cuyo zoneBasis declara conflicto (bop y carrier)', () => {
    const conSector = all().filter((f) => f.zones.some((z) => z.conflict))
    expect(conSector.map((f) => f.sectorId).sort()).toEqual(['bop', 'carrier'])
    const declarantes = drops.sections.filter((s) => /Conflicto:|no coincide/i.test(s.zoneBasis)).map((s) => s.id)
    expect(declarantes.sort()).toEqual(['boca-pozo', 'subestructura-carrier'])
    const z = buildFicha('carrier').zones.find((x) => x.sectionId === 'subestructura-carrier')!
    expect(z.conflict?.lines).toEqual([
      { label: 'Layout A2', level: 'medio', sourceId: 'proc-drops-a2', evidence: 'pendingValidation' },
      { label: 'Procedimiento 6.3.5', level: 'bajo', sourceId: 'proc-drops', evidence: 'procedure' },
    ])
    expect(renderToStaticMarkup(createElement(FichaView, { ficha: buildFicha('carrier') }))).toContain('Fuente en conflicto')
  })

  it('puntos con marcas del dataset nunca son requisito; los procedure sin marcas sí', () => {
    const pts = all().flatMap((f) => f.points)
    const flagged = ['COR-5', 'COR-10', 'COR-11', 'PLA-1', 'PRL-1', 'PRL-2', 'BP-2']
    for (const id of flagged) {
      const p = pts.find((x) => x.id === id)!
      expect(p.flags.length, id).toBeGreaterThan(0)
      expect(p.asRequirement, id).toBe(false)
      expect(p.sourceId, id).toBeTruthy()
    }
    const limpios = pts.filter((p) => !flagged.includes(p.id))
    expect(limpios.length).toBeGreaterThan(30)
    limpios.forEach((p) => expect(p.asRequirement, p.id).toBe(true))
    const html = renderToStaticMarkup(createElement(FichaView, { ficha: buildFicha('bop') }))
    expect(html).toContain('dato dudoso, no presentado como requisito') // BP-2
    expect(html).toContain('requisito del procedimiento') // BP-1
  })

  it('marca comercial: la ficha del acumulador no contiene "Koomey" (el JSON vendorizado sigue literal)', () => {
    const f = buildFicha('acumulador')
    expect(f.name).toBe('Acumulador del BOP')
    expect(JSON.stringify(f)).not.toMatch(/Koomey/i)
    expect(f.texts[0].text).toMatch(/^Unidad de cierre del BOP: almacena/)
    expect(JSON.stringify(viewpoints)).toMatch(/Koomey/)
  })

  it('piso de trabajo y poste-llave: "No clasificada en layout A2", nunca Baja', () => {
    for (const id of ['piso-trabajo', 'llave']) {
      const zs = buildFicha(id).zones
      expect(zs.length).toBeGreaterThan(0)
      zs.forEach((z) => {
        expect(z.level).toBeNull()
        expect(z.text).toMatch(/No clasificada en layout A2/)
        expect(z.text).not.toMatch(/baj/i)
      })
    }
  })

  it('leyenda fija; solo procedure/confirmed son requisito; sector sin puntos DROPS lo dice', () => {
    const f = buildFicha('mastil')
    expect(f.legend).toBe(LEYENDA)
    f.points.forEach((p) => expect(p.asRequirement).toBe((p.evidence === 'procedure' || p.evidence === 'confirmed') && p.flags.length === 0))
    f.texts.forEach((t) => expect(t.evidence).toBe('pendingValidation'))
    expect(buildFicha('acumulador').points).toEqual([])
    expect(() => buildFicha('no-existe')).toThrow(/sector/)
  })

  it('ningún texto de ficha ni de UI usa palabras prohibidas ni marcas/códigos internos', () => {
    const json = JSON.stringify(all())
    expect(containsForbiddenUiWord(json)).toBe(false)
    expect(json).not.toMatch(/YPF|INC\d{4,}|SIGEO|Koomey/i)
    const html = all()
      .map((f) => renderToStaticMarkup(createElement(FichaView, { ficha: f })))
      .join('\n')
    expect(containsForbiddenUiWord(html)).toBe(false)
    expect(html).toContain(LEYENDA)
    expect(html).not.toMatch(/YPF|INC\d{4,}|SIGEO|Koomey/i)
  })

  it('la ficha rendereada muestra conflicto y "sin posición documentada"', () => {
    const html = renderToStaticMarkup(createElement(FichaView, { ficha: buildFicha('bop') }))
    expect(html).toMatch(/Fuente en conflicto/)
    const sinPos = { ...buildFicha('acumulador'), position: null }
    expect(renderToStaticMarkup(createElement(FichaView, { ficha: sinPos }))).toContain('sin posición documentada')
  })
})
