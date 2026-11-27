import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LINK_LINES, chunkTimes, lineHash, missionLines, readMs, splitSubtitles, voiceFile, type Line } from '../../src/audio/radio'
import { containsForbiddenUiWord } from '../../src/game/data/evidence'
import { ALL_MISSIONS } from '../../src/game/missions/defs'

// Voces de la radio: síntesis local (scripts/gen-voice.mjs). El manifest se versiona; los .mp3 no (licencia de la voz
// del sistema pendiente de confirmar, ver NOTICE.md) y se generan en predev/prebuild.
const DIR = 'public/audio/voice'
type Entry = { id: string; file: string; hash: string; text: string; duration: number; sha256: string }
const manifest = JSON.parse(readFileSync(`${DIR}/manifest.json`, 'utf8')) as { voice?: string; lines: Record<string, Entry> }
const entries = Object.entries(manifest.lines)

const all: Line[] = [...new Map([...Object.values(LINK_LINES), ...ALL_MISSIONS.flatMap(missionLines)].map((l) => [l.id, l])).values()]
const sha256 = (f: string) => createHash('sha256').update(readFileSync(f)).digest('hex')
const present = entries.filter(([, e]) => existsSync(`${DIR}/${e.file}`))

describe('manifest de voces', () => {
  it('cada línea de enlace, briefing y objetivo tiene su entrada con el texto vigente', () => {
    expect(all.length).toBeGreaterThan(10)
    for (const l of all) {
      const e = manifest.lines[l.id]
      expect(e, `falta ${l.id}: corré npm run gen-voice`).toBeDefined()
      expect(e.text, `texto viejo en ${l.id}: corré npm run gen-voice`).toBe(l.text)
      expect(e.hash).toBe(lineHash(l.text))
    }
  })
  it('sin ids huérfanos ni archivos repetidos; campos válidos', () => {
    const ids = new Set(all.map((l) => l.id))
    const files = entries.map(([, e]) => e.file)
    expect(new Set(files).size).toBe(files.length)
    for (const [id, e] of entries) {
      expect(ids.has(id), `huérfano ${id}`).toBe(true)
      expect(e.id).toBe(id)
      expect(e.file).toMatch(/^[a-z0-9._-]+\.mp3$/i)
      expect(e.duration).toBeGreaterThan(0.3)
      expect(e.duration).toBeLessThan(60)
      expect(e.sha256).toMatch(/^[0-9a-f]{64}$/)
    }
    expect(typeof manifest.voice).toBe('string')
  })
  it('archivos: están todos (con su sha256) o ninguno (solo subtítulos); nunca a medias', () => {
    expect([0, entries.length]).toContain(present.length)
    for (const [id, e] of present) expect(sha256(`${DIR}/${e.file}`), id).toBe(e.sha256)
  })
  it('ningún texto del manifest dice aprobado/habilitado/certificado/área segura/zona de exclusión', () => {
    const plain = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    for (const [, e] of entries) {
      expect(plain(e.text)).not.toMatch(/aprobad|habilitad|certificad|area segura|zona de exclusion/)
      expect(containsForbiddenUiWord(e.text)).toBe(false)
    }
  })
})

describe('fallback a subtítulos', () => {
  it('sin entrada, o con el texto cambiado, no hay archivo de voz y la línea igual se lee', () => {
    for (const l of all) {
      expect(voiceFile(l, {})).toBeNull()
      expect(voiceFile(l, { [l.id]: { file: 'x.mp3', hash: lineHash(`${l.text} viejo`) } })).toBeNull()
      expect(splitSubtitles(l.text).length).toBeGreaterThan(0)
      expect(readMs(l.text)).toBeGreaterThan(0)
    }
  })
  it('con voz, los subtítulos se reparten en la duración del audio, en orden y sin perder tiempo', () => {
    const l = all.find((x) => splitSubtitles(x.text).length > 1)!
    const parts = splitSubtitles(l.text)
    const t = chunkTimes(parts, 12_000)
    expect(t).toHaveLength(parts.length)
    expect(t.reduce((a, b) => a + b, 0)).toBeCloseTo(12_000, 3)
    const longest = parts.indexOf([...parts].sort((a, b) => b.length - a.length)[0])
    expect(t[longest]).toBe(Math.max(...t))
    expect(chunkTimes(['solo'], 3000)).toEqual([3000])
  })
})

describe('ambiente generado', () => {
  it('el bucle de viento y rig lejano existe y es liviano', () => {
    const f = 'public/audio/ambient/rig-lejano.mp3'
    expect(existsSync(f)).toBe(true)
    expect(statSync(f).size).toBeGreaterThan(5_000)
    expect(statSync(f).size).toBeLessThan(150_000)
  })
})
