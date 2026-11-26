import { describe, expect, it } from 'vitest'
import {
  EVIDENCE,
  LEYENDA,
  canBePresentedAsRequirement,
  containsForbiddenUiWord,
  isEvidence,
  uiSafe,
  type Evidence,
} from '../../src/game/data/evidence'

describe('canBePresentedAsRequirement', () => {
  it.each<[Evidence, boolean]>([
    ['confirmed', true],
    ['procedure', true],
    ['goodPractice', false],
    ['pendingValidation', false],
  ])('%s -> %s', (e, ok) => expect(canBePresentedAsRequirement(e)).toBe(ok))

  it('solo existen los 4 estatus y todo lo demás no es evidencia', () => {
    expect([...EVIDENCE]).toEqual(['confirmed', 'procedure', 'goodPractice', 'pendingValidation'])
    expect(isEvidence('procedure')).toBe(true)
    expect(isEvidence('approved')).toBe(false)
    expect(isEvidence(undefined)).toBe(false)
  })
})

describe('texto de UI', () => {
  it('leyenda fija', () => expect(LEYENDA).toBe('referencia digital, no as-built / ilustrativo'))

  it.each(['aprobado', 'Habilitado', 'CERTIFICADO', 'área segura', 'zona de exclusión'])('detecta "%s"', (w) =>
    expect(containsForbiddenUiWord(`x ${w} y`)).toBe(true),
  )

  it('uiSafe reformula "certificado(s)" sin cambiar el sentido y deja texto limpio', () => {
    expect(uiSafe('grillete certificado')).toBe('grillete con certificación')
    expect(uiSafe('Inspección y certificado vigente.')).toBe('Inspección y certificación vigente.')
    expect(uiSafe('2 Cáncamos certificados con perno')).toBe('2 Cáncamos con certificación con perno')
    expect(containsForbiddenUiWord(uiSafe('elementos certificados'))).toBe(false)
  })
})
