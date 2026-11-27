import { describe, expect, it } from 'vitest'
import { isEvidence } from '../../src/game/data/evidence'
import { buildFicha } from '../../src/game/data/ficha'
import { getSectors } from '../../src/game/data/sectors'
import { m5 } from '../../src/game/missions/defs/m5'

// QA D-16: "3 mm / 4 mm / 6 mm" en fichas y m5. Spec: todo dato numérico en pantalla lleva sourceId y estatus de evidencia.
const MM = /\d+([.,]\d+)?\s?mm\b/
describe('cifras en mm de las fichas: siempre con fuente e insignia', () => {
  const fichas = getSectors().map((s) => buildFicha(s.id))
  const withMm = fichas.flatMap((f) =>
    [...f.texts, ...f.zones, ...f.points.map((p) => ({ ...p, text: [p.primary, p.secondary, p.quantity, p.observation].join(' ') }))].filter((x) => MM.test(x.text)),
  )
  it('hay cifras en mm (si no, el test no prueba nada)', () => expect(withMm.length).toBeGreaterThan(0))
  it('cada bloque con mm trae sourceId y estatus de evidencia válido', () => {
    for (const x of withMm) {
      expect(x.sourceId, x.text).toBeTruthy()
      expect(isEvidence(x.evidence), x.text).toBe(true)
    }
  })
  it('m5 cita la fuente en la misma línea de cada dato con mm', () => {
    const q = m5.objectives.find((o) => o.kind === 'choose')!.text
    for (const line of q.split(' | ').filter((l) => MM.test(l))) expect(line).toMatch(/fuente \S+.* · (Confirmado|Procedimiento|Buena práctica|Pendiente de validación)/)
  })
})
