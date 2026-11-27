import { create } from 'zustand'

export type Bus = 'sfx' | 'ambient' | 'voice'
export type Mix = { master: number; sfx: number; ambient: number; voice: number; muted: boolean }
type Storage = { getItem(k: string): string | null; setItem(k: string, v: string): void }

export const MIX_KEY = 'gta-rig-game:audio:v1'
export const DEFAULT_MIX: Mix = { master: 0.8, sfx: 0.8, ambient: 0.4, voice: 1, muted: false }

const vol = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d)

// localStorage puede no existir o lanzar (ventana privada, sitio bloqueado): entonces la mezcla vive en memoria.
export function loadMix(storage: Storage | undefined = globalThis.localStorage): Mix {
  try {
    const p = JSON.parse(storage?.getItem(MIX_KEY) ?? 'null')
    if (p && typeof p === 'object')
      return {
        master: vol(p.master, DEFAULT_MIX.master),
        sfx: vol(p.sfx, DEFAULT_MIX.sfx),
        ambient: vol(p.ambient, DEFAULT_MIX.ambient),
        voice: vol(p.voice, DEFAULT_MIX.voice),
        muted: typeof p.muted === 'boolean' ? p.muted : DEFAULT_MIX.muted,
      }
  } catch {
    /* mezcla por defecto */
  }
  return { ...DEFAULT_MIX }
}

export function saveMix(mix: Mix, storage: Storage | undefined = globalThis.localStorage) {
  try {
    storage?.setItem(MIX_KEY, JSON.stringify(mix))
  } catch {
    /* sigue en memoria */
  }
}

/** Ganancia efectiva de un bus (0..1): maestro x bus, 0 con mute. */
export const busGain = (m: Mix, bus: Bus) => (m.muted ? 0 : m.master * m[bus])

type AudioStore = { mix: Mix; setMix: (patch: Partial<Mix>) => void; toggleMute: () => void }

export const useAudioStore = create<AudioStore>((set, get) => ({
  mix: loadMix(),
  setMix(patch) {
    const mix = { ...get().mix, ...patch }
    saveMix(mix)
    set({ mix })
  },
  toggleMute: () => get().setMix({ muted: !get().mix.muted }),
}))
