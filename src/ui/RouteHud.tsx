import { useEffect, useState } from 'react'
import { usePlayerStore } from '../game/player/store'
import { truckSpeed } from '../game/player/telemetry'
import { ROUTE_END_S, inLocacion, nearest, zoneAt, type Zone } from '../game/world/route'
import { useHudStore } from './hudStore'

const ZONE: Record<Zone, string> = { base: 'Base operativa', ciudad: 'Ciudad', chacras: 'Chacras', estepa: 'Estepa', bardas: 'Bardas', sierra: 'Sierra', llegada: 'Llegada a la locación' }

// Indicador de ruta (fuera de la locación): cuánto camino falta hasta el equipo, tramo y, al volante, velocidad.
// Es navegación del juego sobre una ruta inventada; no marca zonas ni distancias de seguridad.
export function RouteHud() {
  const [v, setV] = useState<{ km: string; zone: string; kmh: number | null } | null>(null)
  const hidden = useHudStore((s) => s.titleOpen || s.photoOpen)
  useEffect(() => {
    const tick = () => {
      const { position: p, mode } = usePlayerStore.getState()
      if (inLocacion(p[0], p[2], 25)) return setV(null)
      const s = nearest(p[0], p[2]).s
      setV({ km: ((ROUTE_END_S - s) / 1000).toFixed(1).replace('.', ','), zone: ZONE[zoneAt(s)], kmh: mode === 'truck' ? Math.round(Math.abs(truckSpeed.current) * 3.6) : null })
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [])
  if (!v || hidden) return null
  return (
    <div className="pointer-events-none fixed left-1/2 top-3 z-10 -translate-x-1/2 rounded border border-white/10 bg-[#12161a]/90 px-4 py-2 text-center text-sm text-slate-100 backdrop-blur-sm" data-testid="route-hud">
      <p>
        Al equipo: <span className="font-semibold">{v.km} km</span>
        {v.kmh !== null && <> · {v.kmh} km/h</>}
      </p>
      <p className="text-xs uppercase tracking-wider text-slate-300">{v.zone}</p>
    </div>
  )
}
