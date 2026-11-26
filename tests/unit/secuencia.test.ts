import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { convertSecuencia } from '../../scripts/secuencia.mjs'
import { containsForbiddenUiWord } from '../../src/game/data/evidence'

type Paso = { orden: number; documental: boolean }
const md = [
  '# T',
  '## Pasos',
  ...Array.from({ length: 8 }, (_, i) => `${i + 1}. Paso ${i + 1}.`),
  '## Otro',
  '9. no es paso',
].join('\n')

describe('convertSecuencia', () => {
  it('8 pasos, pendingValidation, sin tiempos; 1, 2 y 8 documentales', () => {
    const s = convertSecuencia(md)
    expect(s.status).toBe('pendingValidation')
    expect(s.pasos.map((p: Paso) => p.orden)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(s.pasos.filter((p: Paso) => p.documental).map((p: Paso) => p.orden)).toEqual([1, 2, 8])
    expect(JSON.stringify(s)).not.toMatch(/"(tiempo|duracion|min|seg)\w*"/i)
  })
  it('falla si no hay exactamente 8 pasos consecutivos', () => {
    expect(() => convertSecuencia('## Pasos\n1. a\n2. b\n')).toThrow(/8 pasos/)
    expect(() => convertSecuencia('nada')).toThrow(/Pasos/)
  })
  it('el secuencia.json vendorizado respeta la fuente', () => {
    const s = JSON.parse(readFileSync('vendor/visor/secuencia.json', 'utf8'))
    expect(s.pasos).toHaveLength(8)
    expect(s.status).toBe('pendingValidation')
    expect(s.pasos[0].texto).toBe('Reunión pre-tarea, ATS y asignación de responsabilidades.')
    expect(containsForbiddenUiWord(JSON.stringify(s))).toBe(false)
  })
})
