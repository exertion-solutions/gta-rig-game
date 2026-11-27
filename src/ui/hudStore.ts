import { create } from 'zustand'

type HudState = {
  panelOpen: boolean
  fichaOpen: boolean
  /** Menú de pausa (Esc): ajustes y controles. */
  pauseOpen: boolean
  /** Mapa completo (Tab). */
  mapOpen: boolean
  /** Pantalla de título (inicio en un clic). Con navegador automatizado (e2e) arranca cerrada: no tapa ni bloquea. */
  titleOpen: boolean
  /** Modo foto (P): oculta el HUD y ofrece descargar el PNG del juego. */
  photoOpen: boolean
  /** Sector en cuyo radio de llegada está el jugador (o la camioneta que conduce). */
  atSector: string | null
  /** Sectores a los que llegó en esta sesión, en orden. */
  visited: string[]
  setPanel: (open: boolean) => void
  setFicha: (open: boolean) => void
  setPause: (open: boolean) => void
  setMap: (open: boolean) => void
  setTitle: (open: boolean) => void
  setPhoto: (open: boolean) => void
  setAt: (id: string | null) => void
}

export const useHudStore = create<HudState>((set) => ({
  panelOpen: false,
  fichaOpen: false,
  pauseOpen: false,
  mapOpen: false,
  titleOpen: typeof navigator !== 'undefined' && !navigator.webdriver,
  photoOpen: false,
  atSector: null,
  visited: [],
  setPanel: (panelOpen) => set({ panelOpen }),
  setFicha: (fichaOpen) => set({ fichaOpen }),
  setPause: (pauseOpen) => set({ pauseOpen }),
  setMap: (mapOpen) => set({ mapOpen }),
  setTitle: (titleOpen) => set({ titleOpen }),
  setPhoto: (photoOpen) => set({ photoOpen }),
  setAt: (atSector) => set((s) => ({ atSector, visited: atSector && !s.visited.includes(atSector) ? [...s.visited, atSector] : s.visited })),
}))

/** Hay un panel, menú o mapa abierto: el juego (teclado y mando) queda congelado. */
export const isBlocking = (s: Pick<HudState, 'panelOpen' | 'pauseOpen' | 'mapOpen'> & { titleOpen?: boolean }) => s.panelOpen || s.pauseOpen || s.mapOpen || !!s.titleOpen
export const uiBlocking = () => isBlocking(useHudStore.getState())

/** Qué hace Esc: cierra lo que haya abierto (de adentro hacia afuera); sin nada abierto, abre la pausa. */
export const escapeAction = (s: Pick<HudState, 'panelOpen' | 'pauseOpen' | 'mapOpen' | 'fichaOpen'>) =>
  s.pauseOpen ? 'close-pause' : s.mapOpen ? 'close-map' : s.panelOpen ? 'close-panel' : s.fichaOpen ? 'close-ficha' : 'open-pause'
