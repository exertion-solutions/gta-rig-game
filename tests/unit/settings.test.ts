// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, SETTINGS_KEY, loadSettings, saveSettings } from '../../src/game/settings/settings'

const mem = (init?: string) => {
  const m = new Map<string, string>(init === undefined ? [] : [[SETTINGS_KEY, init]])
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}
const boom = {
  getItem: (): string | null => {
    throw new Error('bloqueado')
  },
  setItem: (): void => {
    throw new Error('bloqueado')
  },
}

describe('settings', () => {
  it('sin nada guardado devuelve los valores por defecto', () => {
    expect(loadSettings(mem())).toEqual(DEFAULT_SETTINGS)
  })
  it('localStorage que lanza: defaults y guardar no revienta', () => {
    expect(loadSettings(boom)).toEqual(DEFAULT_SETTINGS)
    expect(() => saveSettings(DEFAULT_SETTINGS, boom)).not.toThrow()
  })
  it('JSON inválido o no objeto: defaults', () => {
    expect(loadSettings(mem('{no es json'))).toEqual(DEFAULT_SETTINGS)
    expect(loadSettings(mem('42'))).toEqual(DEFAULT_SETTINGS)
  })
  it('acota sensibilidad y volumen a su rango', () => {
    const s = loadSettings(mem(JSON.stringify({ mouseSensitivity: 99, masterVolume: -3 })))
    expect(s.mouseSensitivity).toBe(2)
    expect(s.masterVolume).toBe(0)
    expect(loadSettings(mem(JSON.stringify({ mouseSensitivity: -1 }))).mouseSensitivity).toBeGreaterThan(0)
  })
  it('descarta tipos inválidos campo por campo', () => {
    const s = loadSettings(mem(JSON.stringify({ mouseSensitivity: 'x', invertY: 'si', quality: 'ultra', masterVolume: 0.3 })))
    expect(s).toEqual({ ...DEFAULT_SETTINGS, masterVolume: 0.3 })
  })
  it('guarda y vuelve a leer lo mismo', () => {
    const st = mem()
    const s = { mouseSensitivity: 1.5, invertY: true, masterVolume: 0.5, quality: 'low' as const }
    saveSettings(s, st)
    expect(loadSettings(st)).toEqual(s)
  })
})
