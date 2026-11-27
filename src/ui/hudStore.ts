import { create } from 'zustand'

type HudState = {
  panelOpen: boolean
  fichaOpen: boolean
  /** Menú de pausa (Esc): ajustes y controles. */
  pauseOpen: boolean
  /** Mapa completo (Tab). */
  mapOpen: boolean
  /** Sector en cuyo radio de llegada está el jugador (o la camioneta que conduce). */
  atSector: string | null
  /** Sectores a los que llegó en esta sesión, en orden. */
  visited: string[]
  setPanel: (open: boolean) => void
  setFicha: (open: boolean) => void
  setPause: (open: boolean) => void
  setMap: (open: boolean) => void
  setAt: (id: string | null) => void
}

export const useHudStore = create<HudState>((set) => ({
  panelOpen: false,
  fichaOpen: false,
  pauseOpen: false,
  mapOpen: false,
  atSector: null,
  visited: [],
  setPanel: (panelOpen) => set({ panelOpen }),
  setFicha: (fichaOpen) => set({ fichaOpen }),
  setPause: (pauseOpen) => set({ pauseOpen }),
  setMap: (mapOpen) => set({ mapOpen }),
  setAt: (atSector) => set((s) => ({ atSector, visited: atSector && !s.visited.includes(atSector) ? [...s.visited, atSector] : s.visited })),
}))

/** Hay un panel, menú o mapa abierto: el juego (teclado y mando) queda congelado. */
export const isBlocking = (s: Pick<HudState, 'panelOpen' | 'pauseOpen' | 'mapOpen'>) => s.panelOpen || s.pauseOpen || s.mapOpen
export const uiBlocking = () => isBlocking(useHudStore.getState())

/** Qué hace Esc: cierra lo que haya abierto (de adentro hacia afuera); sin nada abierto, abre la pausa. */
export const escapeAction = (s: Pick<HudState, 'panelOpen' | 'pauseOpen' | 'mapOpen' | 'fichaOpen'>) =>
  s.pauseOpen ? 'close-pause' : s.mapOpen ? 'close-map' : s.panelOpen ? 'close-panel' : s.fichaOpen ? 'close-ficha' : 'open-pause'
