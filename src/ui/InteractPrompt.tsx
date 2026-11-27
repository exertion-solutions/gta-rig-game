import { usePlayerStore } from '../game/player/store'
import { eBelongsToTruck } from '../game/vehicle/enterExit'
import { useValveStore } from '../game/world/interactables'
import { CONTROLS } from '../game/world/rigAccess'
import { INTERACTABLES } from '../game/world/walkable'
import { useHudStore } from './hudStore'

const card = 'rounded border border-white/10 bg-[#12161a]/90 backdrop-blur-sm'
const box = `${card} pointer-events-none fixed left-1/2 top-1/2 z-10 mt-16 -translate-x-1/2 px-3 py-2 text-center text-sm text-slate-100`
const STATE = { open: 'abierta', closed: 'cerrada' } as const
const Key = ({ k }: { k: string }) => <kbd className="rounded bg-white/15 px-1 font-mono text-xs">{k}</kbd>

// Aviso de interacción (sin distancias): camioneta al alcance, válvula al alcance o extremo de una escalera vertical.
export function InteractPrompt() {
  const { near, ladder, states } = useValveStore()
  const mode = usePlayerStore((s) => s.mode)
  const climbing = usePlayerStore((s) => s.climbing)
  const atEnd = usePlayerStore((s) => s.climbAtEnd)
  const truckE = usePlayerStore(eBelongsToTruck) // E es de la camioneta (subir o bajar): no se ofrece otra cosa con E
  const panelOpen = useHudStore((s) => s.panelOpen)
  const photoOpen = useHudStore((s) => s.photoOpen)
  if (panelOpen || photoOpen) return null
  if (mode === 'truck')
    return (
      <div className={box} data-testid="interact-prompt">
        <Key k="E" /> bajar de la camioneta
      </div>
    )
  if (climbing)
    return (
      <div className={box} data-testid="interact-prompt">
        <Key k="W" />/<Key k="S" /> subir o bajar{atEnd && <> · <Key k="E" /> soltar la escalera</>}
      </div>
    )
  if (truckE)
    return (
      <div className={box} data-testid="interact-prompt">
        <Key k="E" /> subir a la camioneta
      </div>
    )
  if (!near && !ladder) return null
  const v = near ? [...INTERACTABLES, ...CONTROLS].find((x) => x.id === near) : undefined
  return (
    <div className={box} data-testid="interact-prompt">
      {ladder ? (
        <p>
          <Key k="E" /> {ladder === 'bottom' ? 'subir por la escalera' : 'bajar por la escalera'}
        </p>
      ) : (
        v &&
        (v.kind !== 'valve' ? (
          <>
            <p>
              <Key k="E" />: {v.kind === 'tong' ? 'accionar' : states[v.id] === 'open' ? 'bajar el aparejo' : 'izar el aparejo'} · {v.label}
            </p>
            <p className="text-xs uppercase tracking-wider text-amber-300">ilustrativo: no es un procedimiento</p>
          </>
        ) : (
          <>
            <p>
              <Key k="E" />: operar · {v.label}
            </p>
            <p className="text-xs text-slate-200" data-testid="valve-state">
              Registro propio: {states[v.id] ? STATE[states[v.id]] : 'sin operar'}
            </p>
            <p className="text-xs uppercase tracking-wider text-amber-300">ilustrativo: no es un procedimiento</p>
          </>
        ))
      )}
    </div>
  )
}
