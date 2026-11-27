export type Quality = 'auto' | 'high' | 'medium' | 'low'
export type Settings = { mouseSensitivity: number; invertY: boolean; masterVolume: number; quality: Quality }
type Storage = { getItem(k: string): string | null; setItem(k: string, v: string): void }

export const SETTINGS_KEY = 'gta-rig-game:settings:v1'
export const DEFAULT_SETTINGS: Settings = { mouseSensitivity: 1, invertY: false, masterVolume: 0.8, quality: 'auto' }
export const SENSITIVITY_RANGE = { min: 0.2, max: 2 } as const
export const QUALITIES: readonly Quality[] = ['auto', 'high', 'medium', 'low']

const num = (v: unknown, d: number, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d)

// localStorage puede no existir o lanzar (ventana privada: hasta el getter lanza): todo dentro del try, defaults si falla.
export function loadSettings(storage?: Storage): Settings {
  try {
    const p = JSON.parse((storage ?? globalThis.localStorage)?.getItem(SETTINGS_KEY) ?? 'null')
    if (p && typeof p === 'object')
      return {
        mouseSensitivity: num(p.mouseSensitivity, DEFAULT_SETTINGS.mouseSensitivity, SENSITIVITY_RANGE.min, SENSITIVITY_RANGE.max),
        invertY: typeof p.invertY === 'boolean' ? p.invertY : DEFAULT_SETTINGS.invertY,
        masterVolume: num(p.masterVolume, DEFAULT_SETTINGS.masterVolume, 0, 1),
        quality: QUALITIES.includes(p.quality) ? p.quality : DEFAULT_SETTINGS.quality,
      }
  } catch {
    /* valores por defecto */
  }
  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(s: Settings, storage?: Storage) {
  try {
    ;(storage ?? globalThis.localStorage)?.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    /* sigue en memoria (el store) */
  }
}
