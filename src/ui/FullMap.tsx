import { useMemo } from 'react'
import { getSectors } from '../game/data/sectors'
import { usePlayerStore } from '../game/player/store'
import { LOCACION_BOUNDS, LOCACION_M } from '../game/world/frame'
import { useHudStore } from './hudStore'
import { mapPoint, mappableSectors } from './fullMapProjection'
import { sectorLabel } from './sectorLabel'

const btn = 'rounded border border-white/20 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400'
const pos = (p: { x: number; y: number }) => ({ left: `${p.x * 100}%`, top: `${p.y * 100}%` })

/** Mapa completo (Tab): vista en planta con los sectores de posición documentada, el jugador y la camioneta. Sin zonas ni distancias. */
export function FullMap() {
  const setMap = useHudStore((s) => s.setMap)
  const visited = useHudStore((s) => s.visited)
  const { position, yaw, truck, mode } = usePlayerStore()
  const sectors = useMemo(() => mappableSectors(getSectors()), [])
  const me = mapPoint(mode === 'truck' ? truck.position : position, LOCACION_BOUNDS)
  const tr = mapPoint(truck.position, LOCACION_BOUNDS)

  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label="Mapa" data-testid="full-map">
      <div className="flex max-h-full w-full max-w-4xl flex-col gap-3 overflow-y-auto rounded-lg border border-white/15 bg-[#14181c] p-5 text-slate-100 shadow-2xl">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-400">Mapa</p>
            <h2 className="text-xl font-bold">Vista en planta</h2>
          </div>
          <button className={btn} onClick={() => setMap(false)}>
            Cerrar (Tab)
          </button>
        </header>

        <div className="mx-auto w-full" style={{ maxWidth: `calc(55vh * ${LOCACION_M.x / LOCACION_M.z})` }}>
          <div className="relative w-full rounded border border-white/15 bg-[#0e1216]" style={{ aspectRatio: `${LOCACION_M.x} / ${LOCACION_M.z}` }} data-testid="full-map-canvas">
            {sectors.map((s, i) => (
              <span
                key={s.id}
                className={`absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-sm text-xs font-bold text-black ${visited.includes(s.id) ? 'bg-teal-300' : 'bg-slate-300'}`}
                style={pos(mapPoint(s.position, LOCACION_BOUNDS))}
                data-testid={`map-sector-${s.id}`}
              >
                {i + 1}
              </span>
            ))}
            {mode === 'foot' && (
              <span className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-slate-400" style={pos(tr)} data-testid="map-truck" aria-label="Camioneta" />
            )}
            <span
              className="absolute h-0 w-0 -translate-x-1/2 -translate-y-1/2 border-x-[8px] border-b-[18px] border-x-transparent border-b-amber-400"
              style={{ ...pos(me), transform: `translate(-50%, -50%) rotate(${-yaw}rad)` }}
              data-testid="map-player"
              aria-label="Vos"
            />
          </div>
        </div>

        <ul className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2" data-testid="full-map-legend">
          {sectors.map((s, i) => (
            <li key={s.id}>
              <span className="mr-2 inline-block w-5 text-right font-bold text-amber-300">{i + 1}</span>
              {sectorLabel(s.id)}
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-300">Flecha ámbar: vos · cuadro gris: camioneta · referencia digital, ilustrativa, no as-built. Solo se dibujan sectores con posición documentada.</p>
      </div>
    </div>
  )
}
