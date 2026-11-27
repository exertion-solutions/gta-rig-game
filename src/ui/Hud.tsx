import { useEffect, useMemo } from 'react'
import { getSectors } from '../game/data/sectors'
import { useMissionStore } from '../game/missions/store'
import { keys } from '../game/player/keys'
import { Ficha } from './Ficha'
import { useHudStore } from './hudStore'
import { Legend } from './Legend'
import { MissionPanel } from './MissionPanel'
import { Radar } from './Radar'
import { sectorLabel } from './sectorLabel'
import { buildFicha } from '../game/data/ficha'

// Teclas que mueven al jugador o suben/bajan de la camioneta: con un panel abierto no deben llegar al juego.
const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'Space', 'ShiftLeft', 'ShiftRight'])

function useHotkeys() {
  useEffect(() => {
    // En captura y en window: corre antes que los listeners del juego y puede cortarles la tecla.
    const down = (e: KeyboardEvent) => {
      const hud = useHudStore.getState()
      if (e.code === 'KeyM' && !e.repeat) {
        hud.setPanel(!hud.panelOpen)
      } else if (e.code === 'KeyF' && !e.repeat && !hud.panelOpen) hud.setFicha(!hud.fichaOpen)
      else if (e.code === 'Escape' && hud.panelOpen) hud.setPanel(false)
      else if (hud.panelOpen && GAME_KEYS.has(e.code)) e.stopPropagation()
    }
    window.addEventListener('keydown', down, true)
    // Al abrir un panel: suelta el puntero (para poder clicar) y detiene al jugador.
    const unsub = useHudStore.subscribe((s, prev) => {
      if (s.panelOpen && !prev.panelOpen) {
        keys.clear()
        document.exitPointerLock?.()
      }
    })
    return () => {
      window.removeEventListener('keydown', down, true)
      unsub()
    }
  }, [])
}

const card = 'rounded border border-white/10 bg-[#12161a]/75 backdrop-blur-sm'
const label = 'font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400'

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

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none overflow-hidden font-sans text-slate-100" data-testid="hud">
      {/* misión: arriba a la izquierda */}
      <div className={`absolute left-3 top-3 w-[min(22rem,calc(100vw-9.5rem))] space-y-2`}>
        <div className={`${card} p-3`} data-testid="hud-mission">
          {def && obj ? (
            <>
              <p className={label}>
                {def.title} · {idx + 1}/{def.objectives.length}
              </p>
              <p className="mt-1 text-base font-semibold leading-snug text-amber-300" data-testid="hud-objective">
                {obj.text}
              </p>
              {obj.kind === 'visitAll' && (
                <p className="mt-0.5 text-xs text-slate-300">
                  {mission.visited.length}/{obj.sectorIds.length} sectores
                </p>
              )}
              <ol className="mt-2 hidden space-y-0.5 text-xs sm:block" data-testid="hud-objectives">
                {def.objectives.map((o, i) => (
                  <li key={o.id} className={i < idx ? 'text-slate-500 line-through' : i === idx ? 'text-slate-100' : 'text-slate-400'}>
                    {i + 1}. {o.text}
                  </li>
                ))}
              </ol>
            </>
          ) : mission.status === 'completed' && def ? (
            <p className="text-sm font-semibold text-emerald-300">Misión completada · {def.title}</p>
          ) : (
            <p className="text-sm text-slate-300">Sin misión activa. Abrí las misiones con M.</p>
          )}
        </div>
        <div className={`${card} hidden px-3 py-2 sm:block`} data-testid="hud-visited">
          <p className={label}>
            Sectores visitados · {visited.length}/{placed}
          </p>
          <p className="mt-1 text-xs text-slate-300">{visited.length ? visited.map(sectorLabel).join(' · ') : 'ninguno todavía'}</p>
        </div>
      </div>

      {/* misiones: arriba a la derecha */}
      <button
        className={`${card} pointer-events-auto absolute right-3 top-3 px-3 py-1.5 text-sm hover:bg-white/15`}
        onClick={() => setPanel(!panelOpen)}
        data-testid="open-missions"
      >
        Misiones <kbd className="ml-1 rounded bg-white/15 px-1 font-mono text-xs">M</kbd>
      </button>

      {/* radar: abajo a la izquierda */}
      <div className="absolute bottom-3 left-3">
        <Radar />
      </div>

      {/* sector actual */}
      {ficha && !fichaOpen && (
        <div className={`${card} absolute bottom-24 left-1/2 -translate-x-1/2 px-3 py-1.5 text-center text-sm sm:bottom-6`} data-testid="hud-sector">
          {ficha.name} · <kbd className="rounded bg-white/15 px-1 font-mono text-xs">F</kbd> ficha
        </div>
      )}

      {/* ficha del sector (F) */}
      {ficha && fichaOpen && !panelOpen && (
        <div className="pointer-events-auto absolute bottom-24 right-3 top-14 w-[min(34rem,calc(100vw-1.5rem))] overflow-y-auto" data-testid="hud-ficha">
          <Ficha ficha={ficha} />
        </div>
      )}

      {/* leyenda fija: abajo a la derecha */}
      <div className="absolute bottom-3 right-3 max-w-[13rem] sm:max-w-xs">
        <Legend />
      </div>

      {panelOpen && <MissionPanel />}
    </div>
  )
}
