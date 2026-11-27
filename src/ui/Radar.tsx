import { useEffect, useRef } from 'react'
import { getSectors } from '../game/data/sectors'
import { useMissionStore } from '../game/missions/store'
import { objectiveTargets } from '../game/missions/targets'
import { INTERACTABLES } from '../game/world/walkable'
import { usePlayerStore } from '../game/player/store'
import { useHudStore } from './hudStore'
import { projectToRadar } from './radarProjection'

const SIZE = 336 // px internos (2x del tamaño CSS más grande)
const RANGE_M = 45 // alcance del radar (no se muestra en pantalla)
const AMBER = '#f2a900'

/** Radar 2D: jugador al centro, frente arriba. Solo posiciones: sin capas de zonas, anillos ni rótulos de distancia. */
export function Radar() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const g = ref.current!.getContext('2d')!
    const sectors = getSectors()
    const placed = sectors.filter((s) => s.position)
    let raf = 0
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw)
      const p = usePlayerStore.getState()
      const ms = useMissionStore.getState()
      const visited = useHudStore.getState().visited
      const driving = p.mode === 'truck'
      const center = driving ? p.truck.position : p.position
      const R = SIZE / 2
      const proj = (w: [number, number, number]) => projectToRadar(w, center, p.yaw, RANGE_M, SIZE)

      g.clearRect(0, 0, SIZE, SIZE)
      g.save()
      g.beginPath()
      g.arc(R, R, R - 3, 0, Math.PI * 2)
      g.clip()
      g.fillStyle = 'rgba(14,18,22,0.82)'
      g.fillRect(0, 0, SIZE, SIZE)

      for (const s of placed) {
        const q = proj(s.position!)
        if (!q.inside) continue
        const seen = visited.includes(s.id)
        g.fillStyle = seen ? '#7dd3c0' : 'rgba(203,213,225,0.55)'
        g.fillRect(q.x - 5, q.y - 5, 10, 10)
        if (!seen) {
          g.fillStyle = 'rgba(14,18,22,0.9)'
          g.fillRect(q.x - 2.5, q.y - 2.5, 5, 5)
        }
      }

      if (!driving) {
        const q = proj([p.truck.position[0], 0, p.truck.position[2]])
        if (q.inside) {
          g.save()
          g.translate(q.x, q.y)
          g.rotate(p.yaw - p.truck.heading)
          g.fillStyle = '#94a3b8'
          g.fillRect(-4, -8, 8, 16)
          g.fillStyle = '#e2e8f0'
          g.fillRect(-4, -8, 8, 4)
          g.restore()
        }
      }

      const pulse = 0.5 + 0.5 * Math.sin(t / 260)
      for (const w of objectiveTargets(ms.available.find((d) => d.id === ms.mission.missionId), ms.mission, sectors, INTERACTABLES)) {
        const q = proj(w)
        g.save()
        g.translate(q.x, q.y)
        if (!q.inside) g.rotate(Math.atan2(q.x - R, -(q.y - R))) // flecha hacia el objetivo, pegada al borde
        g.fillStyle = AMBER
        g.globalAlpha = 0.7 + 0.3 * pulse
        g.beginPath()
        if (q.inside) {
          const r = 9 + 2 * pulse
          g.moveTo(0, -r)
          g.lineTo(r, 0)
          g.lineTo(0, r)
          g.lineTo(-r, 0)
        } else {
          g.moveTo(0, -9)
          g.lineTo(8, 7)
          g.lineTo(-8, 7)
        }
        g.closePath()
        g.fill()
        g.restore()
      }

      // jugador (o camioneta que conduce): punta hacia donde mira la cámara
      g.save()
      g.translate(R, R)
      if (driving) {
        g.rotate(p.yaw - p.truck.heading)
        g.fillStyle = '#e2e8f0'
        g.fillRect(-6, -11, 12, 22)
        g.fillStyle = AMBER
        g.fillRect(-6, -11, 12, 5)
      } else {
        g.fillStyle = '#f8fafc'
        g.beginPath()
        g.moveTo(0, -11)
        g.lineTo(8, 9)
        g.lineTo(0, 4)
        g.lineTo(-8, 9)
        g.closePath()
        g.fill()
      }
      g.restore()
      g.restore()

      g.strokeStyle = 'rgba(255,255,255,0.28)'
      g.lineWidth = 3
      g.beginPath()
      g.arc(R, R, R - 3, 0, Math.PI * 2)
      g.stroke()
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} width={SIZE} height={SIZE} role="img" aria-label="Radar" data-testid="radar" className="h-[112px] w-[112px] sm:h-[168px] sm:w-[168px]" />
}
