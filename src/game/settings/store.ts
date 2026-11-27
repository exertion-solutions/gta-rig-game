import { create } from 'zustand'
import { useAudioStore } from '../../audio/mix'
import { loadSettings, saveSettings, type Settings } from './settings'

type SettingsStore = { settings: Settings; set: (patch: Partial<Settings>) => void }

export const useSettings = create<SettingsStore>((set, get) => ({
  settings: loadSettings(),
  set(patch) {
    const settings = { ...get().settings, ...patch }
    saveSettings(settings)
    set({ settings })
    if (patch.masterVolume !== undefined) useAudioStore.getState().setMix({ master: settings.masterVolume })
  },
}))

// Al arrancar, el volumen general guardado manda sobre la mezcla de audio.
useAudioStore.getState().setMix({ master: useSettings.getState().settings.masterVolume })
