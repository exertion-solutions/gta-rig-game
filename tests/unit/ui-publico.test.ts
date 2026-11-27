import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Higiene de lo que se publica: public/ se copia tal cual al build y src/ se empaqueta en el JS.
// Los metadatos internos (*.meta.json) y los GLB sin uso viven en vendor/visor/models (fuera del build).
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const f = join(dir, n)
    return statSync(f).isDirectory() ? files(f) : [f]
  })
const norm = (f: string) => f.replace(/\\/g, '/')

// Datos internos: informe no publicado, número de serie y fabricante, marca comercial.
const INTERNAL = /informe técnico interno|S\/N|\bCPC\b|Koomey/

describe('public/ y src/ sin datos internos', () => {
  it('public/ no tiene ningún .meta.json', () => {
    expect(files('public').map(norm).filter((f) => f.endsWith('.meta.json'))).toEqual([])
  })
  // GLB y decoders incluidos: se leen como texto para buscar las cadenas en sus bloques JSON.
  it.each(['public', 'src'])('%s/ no contiene informe interno, S/N, fabricante ni marca', (dir) => {
    const hits = files(dir).filter((f) => INTERNAL.test(readFileSync(f, 'utf8'))).map(norm)
    expect(hits).toEqual([])
  })
})

// Regla del spec: el JUEGO nunca dice aprobado/habilitado/certificado. Decisión del dueño (QA D-05): el texto de las
// fichas que se cita de las fuentes pasa por uiSafe, que reformula "certificado" como "con certificación"; esa raíz
// citada se acepta y no se cambia el texto. Este test cubre el texto escrito por el juego (src/), salvo los dos
// archivos que definen el propio filtro.
const FILTERS = ['src/game/data/evidence.ts', 'src/game/missions/engine.ts']
describe('texto del juego sin aprobado/habilitado/certificado', () => {
  it('ningún archivo de src/ (fuera de los filtros) las usa', () => {
    const hits = files('src')
      .map(norm)
      .filter((f) => !FILTERS.includes(f) && /aprobad|habilitad|certificad/i.test(readFileSync(f, 'utf8')))
    expect(hits).toEqual([])
  })
})
