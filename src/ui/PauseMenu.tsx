import { QUALITIES, SENSITIVITY_RANGE, type Quality } from '../game/settings/settings'
import { useSettings } from '../game/settings/store'
import { useMissionStore } from '../game/missions/store'
import { useHudStore } from './hudStore'

const btn = 'rounded border border-white/20 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400'
const primary = 'rounded bg-amber-400 px-3 py-1.5 text-sm font-semibold text-black hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white'
const QUALITY_NAME: Record<Quality, string> = { auto: 'Automática', high: 'Alta', medium: 'Media', low: 'Baja' }
const row = 'grid grid-cols-[8rem_1fr_3.5rem] items-center gap-2 text-sm'

/** Menú de pausa (Esc): ajustes que se guardan en este navegador y ayuda de controles. El juego queda congelado mientras está abierto. */
export function PauseMenu() {
  const setPause = useHudStore((s) => s.setPause)
  const { settings, set } = useSettings()
  const active = useMissionStore((s) => s.mission.status === 'active')
  const exitMission = useMissionStore((s) => s.exit)
  const close = () => setPause(false)

  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label="Pausa" data-testid="pause-menu">
      <div className="max-h-full w-full max-w-lg space-y-4 overflow-y-auto rounded-lg border border-white/15 bg-[#14181c] p-5 text-slate-100 shadow-2xl">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-400">Pausa</p>
            <h2 className="text-xl font-bold">Ajustes</h2>
          </div>
          <button className={primary} onClick={close} data-testid="pause-resume" autoFocus>
            Continuar (Esc)
          </button>
        </header>

        <fieldset className="space-y-2 rounded border border-white/10 bg-white/5 p-3">
          <legend className="px-1 font-mono text-xs uppercase tracking-[0.14em] text-slate-300">Cámara y sonido</legend>
          <label className={row}>
            Sensibilidad
            <input
              type="range"
              min={SENSITIVITY_RANGE.min}
              max={SENSITIVITY_RANGE.max}
              step={0.1}
              value={settings.mouseSensitivity}
              onChange={(e) => set({ mouseSensitivity: Number(e.target.value) })}
              data-testid="set-sensitivity"
            />
            <span className="text-right tabular-nums text-slate-300">{settings.mouseSensitivity.toFixed(1)}x</span>
          </label>
          <label className={row}>
            Volumen general
            <input type="range" min={0} max={100} step={5} value={Math.round(settings.masterVolume * 100)} onChange={(e) => set({ masterVolume: Number(e.target.value) / 100 })} data-testid="set-volume" />
            <span className="text-right tabular-nums text-slate-300">{Math.round(settings.masterVolume * 100)} %</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.invertY} onChange={(e) => set({ invertY: e.target.checked })} data-testid="set-invert" />
            Invertir eje Y de la cámara
          </label>
          <label className="flex items-center gap-2 text-sm">
            Calidad gráfica
            <select className="rounded border border-white/20 bg-[#0e1216] px-2 py-1" value={settings.quality} onChange={(e) => set({ quality: e.target.value as Quality })} data-testid="set-quality">
              {QUALITIES.map((q) => (
                <option key={q} value={q}>
                  {QUALITY_NAME[q]}
                </option>
              ))}
            </select>
          </label>
        </fieldset>

        <section className="space-y-1 rounded border border-white/10 bg-white/5 p-3 text-sm" data-testid="pause-controls">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-slate-300">Controles</p>
          <p>W A S D mover · Shift correr (V fija) · C agacharse · Espacio saltar · E usar</p>
          <p>M misiones · Tab mapa · F ficha · N sonido · P foto · Esc pausa</p>
          <p>Mando: stick izquierdo mover, derecho mirar, gatillo derecho correr, A saltar, X usar</p>
        </section>

        <div className="flex flex-wrap gap-2">
          {active && (
            <button
              className={btn}
              onClick={() => {
                exitMission()
                close()
              }}
              data-testid="pause-exit-mission"
            >
              Salir de la misión
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
