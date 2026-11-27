import { create } from 'zustand'

type HudState = {
  panelOpen: boolean
  fichaOpen: boolean
  /** Sector en cuyo radio de llegada está el jugador (o la camioneta que conduce). */
  atSector: string | null
  /** Sectores a los que llegó en esta sesión, en orden. */
  visited: string[]
  setPanel: (open: boolean) => void
  setFicha: (open: boolean) => void
  setAt: (id: string | null) => void
}

export const useHudStore = create<HudState>((set) => ({
  panelOpen: false,
  fichaOpen: false,
  atSector: null,
  visited: [],
  setPanel: (panelOpen) => set({ panelOpen }),
  setFicha: (fichaOpen) => set({ fichaOpen }),
  setAt: (atSector) => set((s) => ({ atSector, visited: atSector && !s.visited.includes(atSector) ? [...s.visited, atSector] : s.visited })),
}))

/** Hay un panel o menú abierto: el juego (teclado y mando) queda congelado. */
export const uiBlocking = () => {
  const s = useHudStore.getState()
  return s.panelOpen
}
