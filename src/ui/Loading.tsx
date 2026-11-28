import { useLoadStore } from '../app/loadStore'
import { useHudStore } from './hudStore'

/**
 * Pantalla de título y carga: progreso real de los GLB (LoadingManager de three) y, al terminar, "Jugar" con un clic
 * (el clic también captura el mouse para mirar). Con navegador automatizado (e2e) no hay pantalla: solo el indicador chico.
 */
export function Loading() {
  const progress = useLoadStore((s) => s.progress)
  const settled = useLoadStore((s) => s.settled)
  const titleOpen = useHudStore((s) => s.titleOpen)
  const setTitle = useHudStore((s) => s.setTitle)
  const ready = settled
  if (ready && !titleOpen) return null
  const pct = Math.round(progress)
  if (!titleOpen)
    return (
      <div data-testid="loading" role="status" className="pointer-events-none fixed inset-x-0 top-1/2 text-center text-lg font-semibold text-white drop-shadow">
        Cargando… {pct} %
      </div>
    )
  const play = () => {
    setTitle(false)
    void document.querySelector('canvas')?.requestPointerLock?.()
  }
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#0e1216]/95 p-4 text-slate-100" data-testid="title-screen">
      <div className="w-full max-w-md space-y-4 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-amber-400">Recorrido de locación</p>
        <h1 className="text-3xl font-bold leading-tight">Equipo de torre</h1>
        <p className="text-sm text-slate-300">Referencia digital, no as-built / ilustrativo.</p>
        <div data-testid="loading" role="progressbar" aria-label="Carga" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-2 w-full overflow-hidden rounded bg-white/15">
          <div className="h-full bg-amber-400 transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        {ready ? (
          <button
            className="w-full rounded bg-amber-400 px-4 py-3 text-lg font-bold text-black hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            onClick={play}
            data-testid="title-play"
            autoFocus
          >
            Jugar
          </button>
        ) : (
          <p className="text-sm text-slate-300" role="status">
            Cargando… {pct} %
          </p>
        )}
        <p className="text-xs text-slate-300">W A S D mover · Shift correr · Espacio saltar · E usar · Esc pausa · Tab mapa</p>
      </div>
    </div>
  )
}
