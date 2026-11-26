import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkAssets } from '../../scripts/check-assets.mjs'

const lock = resolve('assets.lock.json')
const rig = resolve('public/models/rig10')
const tmps: string[] = []
const copy = () => {
  const d = mkdtempSync(join(tmpdir(), 'rig-'))
  tmps.push(d)
  cpSync(rig, d, { recursive: true })
  return d
}
afterEach(() => tmps.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))

describe('checkAssets', () => {
  it('reporta ok con los 36 archivos de rig10', () => {
    const r = checkAssets(lock, rig)
    expect(JSON.parse(readFileSync(lock, 'utf8')).files).toBeDefined()
    expect(r).toEqual({ ok: true, missing: [], mismatched: [] })
  })
  it('reporta mismatched si se altera un byte', () => {
    const d = copy()
    const f = join(d, 'sk575_bop.glb')
    const b = readFileSync(f)
    b[b.length - 1] ^= 0xff
    writeFileSync(f, b)
    const r = checkAssets(lock, d)
    expect(r.ok).toBe(false)
    expect(r.mismatched).toEqual(['sk575_bop.glb'])
  })
  it('reporta missing si falta un archivo', () => {
    const d = copy()
    rmSync(join(d, 'mastil.glb'))
    const r = checkAssets(lock, d)
    expect(r.ok).toBe(false)
    expect(r.missing).toEqual(['mastil.glb'])
  })
})
