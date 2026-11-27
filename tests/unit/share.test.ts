import { describe, expect, it } from 'vitest'
import { ALL_MISSIONS } from '../../src/game/missions'
import { cardLines, clipDone, clipFileName, clipSecondsLeft, missionLink, parseMissionParam, pickClipMime, resolveMissionId, WATERMARK } from '../../src/ui/share'

describe('clip grabable', () => {
  it('elige el primer mimeType soportado, o null', () => {
    expect(pickClipMime((t) => t !== 'video/webm')).toBe('video/webm;codecs=vp8')
    expect(pickClipMime((t) => t === 'video/webm')).toBe('video/webm')
    expect(pickClipMime(() => false)).toBeNull()
  })
  it('cuenta regresiva: de 10 s a 0 sin pasarse', () => {
    expect(clipSecondsLeft(0)).toBe(10)
    expect(clipSecondsLeft(2_500)).toBe(8)
    expect(clipSecondsLeft(10_000)).toBe(0)
    expect(clipSecondsLeft(99_000)).toBe(0)
    expect(clipDone(9_999)).toBe(false)
    expect(clipDone(10_000)).toBe(true)
  })
  it('nombre de archivo .webm', () => {
    expect(clipFileName()).toBe('clip-locacion.webm')
  })
})

describe('enlace a una misión (?mision=)', () => {
  it('lee el parámetro y descarta valores raros', () => {
    expect(parseMissionParam('?mision=m3')).toBe('m3')
    expect(parseMissionParam('?quality=low&mision=m7-x')).toBe('m7-x')
    expect(parseMissionParam('')).toBeNull()
    expect(parseMissionParam('?mision=')).toBeNull()
    expect(parseMissionParam('?mision=<script>')).toBeNull()
    expect(parseMissionParam('?mision=' + 'a'.repeat(41))).toBeNull()
  })
  it('resuelve el id corto contra el id completo, sin confundir m1 con m10', () => {
    const ids = ['m1-reconocimiento', 'm10-otra', 'm3-algo']
    expect(resolveMissionId(ids, 'm3')).toBe('m3-algo')
    expect(resolveMissionId(ids, 'm1')).toBe('m1-reconocimiento')
    expect(resolveMissionId(ids, 'm3-algo')).toBe('m3-algo')
    expect(resolveMissionId(ids, 'm9')).toBeNull()
  })
  it('arma el enlace con el id corto y sin restos de la URL', () => {
    expect(missionLink('http://localhost:5173/juego/?quality=low#x', 'm3-retencion')).toBe('http://localhost:5173/juego/?mision=m3')
  })
  it('cada misión disponible se resuelve desde su propio enlace', () => {
    const ids = ALL_MISSIONS.map((d) => d.id)
    for (const id of ids) expect(resolveMissionId(ids, parseMissionParam(new URL(missionLink('http://x/', id)).search)!)).toBe(id)
  })
})

describe('tarjeta de misión completada', () => {
  it('no usa aprobado/habilitado/certificado ni inventa datos', () => {
    for (const d of ALL_MISSIONS) {
      const { title, lines } = cardLines(d, {})
      expect([title, ...lines].join('\n')).not.toMatch(/aprob|habilit|certific|[áa]rea segura|exclusi/i)
      expect(lines[0]).toBe(`${d.objectives.length} de ${d.objectives.length} objetivos cumplidos`)
    }
  })
  it('la marca de agua dice referencia digital, ilustrativo', () => {
    expect(WATERMARK.toLowerCase()).toBe('referencia digital, ilustrativo')
  })
})
