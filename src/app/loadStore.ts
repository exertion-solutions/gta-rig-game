import { create } from 'zustand'

// Progreso de carga que publica la escena (chunk perezoso) y lee la pantalla de título (chunk inicial, sin three).
// `settled` se enciende una sola vez, al terminar la primera carga: desde ahí se cargan en segundo plano las piezas
// solo visuales (sin colisión) sin volver a bloquear el "Jugar".
interface LoadState {
  physicsReady: boolean
  active: boolean
  progress: number
  settled: boolean
  set: (p: Partial<Pick<LoadState, 'physicsReady' | 'active' | 'progress'>>) => void
}

export const useLoadStore = create<LoadState>((set) => ({
  physicsReady: false,
  active: false,
  progress: 0,
  settled: false,
  set: (p) =>
    set((s) => {
      const n = { ...s, ...p }
      return { ...p, settled: s.settled || (n.physicsReady && !n.active && n.progress === 100) }
    }),
}))
