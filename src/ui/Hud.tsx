import { useEffect, useId, useMemo, useState } from 'react'
import { getSectors } from '../game/data/sectors'
import { useMissionStore } from '../game/missions/store'
import { clearKeys } from '../game/player/keys'
import { useAudioStore } from '../audio/mix'
import { MuteButton, RadioSubtitle } from './AudioControls'
import { Ficha } from './Ficha'
import { useHudStore } from './hudStore'
import { Legend } from './Legend'
import { MissionPanel } from './MissionPanel'
import { Radar } from './Radar'
import { sectorLabel } from './sectorLabel'
import { buildFicha } from '../game/data/ficha'
import { visitedView } from './visitedView'
import { usePlayerStore } from '../game/player/store'

// Teclas que mueven al jugador o suben/bajan de la camioneta: con un panel abierto no deben llegar al juego.
const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'Space', 'ShiftLeft', 'ShiftRight'])

function useHotkeys() {
  useEffect(() => {
    // En captura y en window: corre antes que los listeners del juego y puede cortarles la tecla.
    const down = (e: KeyboardEvent) => {
      const hud = useHudStore.getState()
      if (e.code === 'KeyM' && !e.repeat) {
        hud.setPanel(!hud.panelOpen)
      } else if (e.code === 'KeyN' && !e.repeat) useAudioStore.getState().toggleMute()
      else if (e.code === 'KeyF' && !e.repeat && !hud.panelOpen) hud.setFicha(!hud.fichaOpen)
      else if (e.code === 'Escape' && hud.panelOpen) hud.setPanel(false)
      else if (e.code === 'Escape' && hud.fichaOpen) hud.setFicha(false)
      else if (hud.panelOpen && GAME_KEYS.has(e.code)) e.stopPropagation()
    }
    window.addEventListener('keydown', down, true)
    // Al abrir un panel: suelta el puntero (para poder clicar) y detiene al jugador.
    const unsub = useHudStore.subscribe((s, prev) => {
      if (s.panelOpen && !prev.panelOpen) {
        clearKeys()
        document.exitPointerLock?.()
      }
    })
    return () => {
      window.removeEventListener('keydown', down, true)
      unsub()
    }
  }, [])
}

// Fondos opacos al 90 %: con el cielo claro detrás el texto gris claro seguía por debajo de 4,5:1 (hud-layout.e2e.ts mide).
const card = 'rounded border border-white/10 bg-[#12161a]/90 backdrop-blur-sm'
const label = 'font-mono text-xs uppercase tracking-[0.14em] text-slate-300'
const LONG = 110 // caracteres: más que esto se recorta a 3 líneas con "ver más"

/** Objetivo en curso: el texto completo de m3/m5/m6 llega a ~400 caracteres; recortado con "ver más" (accesible). */
function ObjectiveText({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const long = text.length > LONG
  return (
    <>
      <p
        id={id}
        className={`mt-1 text-base font-semibold leading-snug text-amber-300 ${long && !open ? 'line-clamp-3' : ''} ${open ? 'pointer-events-auto max-h-[40vh] overflow-y-auto pr-1' : ''}`}
        data-testid="hud-objective"
      >
        {text}
      </p>
      {long && (
        <button
          className="pointer-events-auto mt-1 rounded text-sm text-sky-300 underline underline-offset-2 hover:text-sky-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
          data-testid="hud-objective-more"
        >
          {open ? 'ver menos' : 'ver más'}
        </button>
      )}
    </>
  )
}

export function Hud() {
  useHotkeys()
  const { mission, available } = useMissionStore()
  const { panelOpen, fichaOpen, atSector, visited, setPanel } = useHudStore()
  const placed = useMemo(() => getSectors().filter((s) => s.position).length, [])
  const def = available.find((d) => d.id === mission.missionId)
  const idx = mission.objectiveIndex
  const obj = mission.status === 'active' ? def?.objectives[idx] : undefined
  // Los objetivos que se responden con clics, y la pantalla final, abren el panel solos.
  const needsPanel = !!obj && (obj.kind === 'choose' || obj.kind === 'order' || obj.kind === 'mark')
  useEffect(() => {
    if (needsPanel || mission.status === 'completed') setPanel(true)
  }, [needsPanel, mission.status, idx, setPanel])
  const ficha = useMemo(() => (atSector ? buildFicha(atSector) : null), [atSector])
  const view = visitedView(def, mission, visited, placed)
  const showFicha = !!ficha && fichaOpen && !panelOpen
  const atLimit = usePlayerStore((s) => s.atLimit)
  // Lector de pantalla: cada objetivo nuevo y la misión completada (polite: no interrumpe).
  const announce = def && obj ? `Objetivo ${idx + 1} de ${def.objectives.length}: ${obj.text}` : mission.status === 'completed' && def ? `Misión completada: ${def.title}` : ''

  // Dos columnas en flujo (no posiciones absolutas sueltas): izquierda misión → visitados → sector → radar; derecha
  // botón → ficha → leyenda. Dentro de una columna nada se superpone; las columnas tienen anchos que no se cruzan.
  // En angosto (< sm) la ficha ocupa todo el ancho y la columna izquierda se oculta mientras está abierta.
  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none overflow-hidden font-sans text-slate-100" data-testid="hud">
      <p className="sr-only" role="status" aria-live="polite" data-testid="hud-announce">
        {announce}
      </p>

      <div className={`absolute bottom-3 left-3 top-3 hud-left flex flex-col gap-2 ${showFicha ? 'max-sm:hidden' : ''}`}>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <div className={`${card} p-3`} data-testid="hud-mission">
            {def && obj ? (
              <>
                <p className={label}>
                  {def.title} · {idx + 1}/{def.objectives.length}
                </p>
                <ObjectiveText key={obj.id} text={obj.text} />
                {view.mission && (
                  <p className="mt-0.5 text-sm text-slate-200" data-testid="hud-progress">
                    {view.ids.length}/{view.total} sectores
                  </p>
                )}
              </>
            ) : mission.status === 'completed' && def ? (
              <p className="text-sm font-semibold text-emerald-300">Misión completada · {def.title}</p>
            ) : (
              <p className="text-sm text-slate-200">Sin misión activa. Abrí las misiones con M.</p>
            )}
          </div>
          <RadioSubtitle />
          <div className={`${card} hidden min-h-0 overflow-hidden px-3 py-2 sm:block`} data-testid="hud-visited">
            <p className={label} data-testid="hud-visited-count">
              {view.label} · {view.ids.length}/{view.total}
            </p>
            <p className="mt-1 line-clamp-2 text-sm text-slate-200">{view.ids.length ? view.ids.map(sectorLabel).join(' · ') : 'ninguno todavía'}</p>
          </div>
        </div>
        {atLimit && (
          <p className={`${card} self-start px-3 py-1.5 text-sm text-amber-300`} role="status" data-testid="hud-limit">
            Límite de la locación
          </p>
        )}
        {ficha && !fichaOpen && (
          <div className={`${card} self-start px-3 py-1.5 text-sm`} data-testid="hud-sector">
            {ficha.name} · <kbd className="rounded bg-white/15 px-1 font-mono text-xs">F</kbd> ficha
          </div>
        )}
        <div className="shrink-0 self-start">
          <Radar />
        </div>
      </div>

      <div
        className={`absolute bottom-3 right-3 top-3 flex flex-col items-end gap-2 ${showFicha ? 'hud-ficha' : ''}`}
      >
        <button
          className={`${card} pointer-events-auto shrink-0 px-3 py-1.5 text-sm hover:bg-white/15`}
          onClick={() => setPanel(!panelOpen)}
          data-testid="open-missions"
        >
          Misiones <kbd className="ml-1 rounded bg-white/15 px-1 font-mono text-xs">M</kbd>
        </button>
        <MuteButton />
        <div className="min-h-0 w-full flex-1">
          {showFicha && (
            <div className="pointer-events-auto h-full overflow-y-auto" data-testid="hud-ficha">
              <Ficha ficha={ficha} />
            </div>
          )}
        </div>
        <div className="max-w-[13rem] shrink-0 sm:max-w-xs">
          <Legend />
        </div>
      </div>

      {panelOpen && <MissionPanel />}
    </div>
  )
}
