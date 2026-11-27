import { usePlayerStore } from '../game/player/store'
import { useValveStore } from '../game/world/interactables'
import { INTERACTABLES } from '../game/world/walkable'
import { useHudStore } from './hudStore'

const card = 'rounded border border-white/10 bg-[#12161a]/80 backdrop-blur-sm'
const STATE = { open: 'abierta', closed: 'cerrada' } as const

// Aviso de interacción (sin distancias): válvula al alcance o extremo de una escalera vertical.
export function InteractPrompt() {
  const { near, ladder, states } = useValveStore()
  const foot = usePlayerStore((s) => s.mode === 'foot')
  const panelOpen = useHudStore((s) => s.panelOpen)
  if (!foot || panelOpen || (!near && !ladder)) return null
  const v = near ? INTERACTABLES.find((x) => x.id === near) : undefined
  return (
    <div className={`${card} pointer-events-none fixed left-1/2 top-1/2 z-10 mt-16 -translate-x-1/2 px-3 py-2 text-center text-sm text-slate-100`} data-testid="interact-prompt">
      {ladder ? (
        <p>
          <kbd className="rounded bg-white/15 px-1 font-mono text-xs">E</kbd> {ladder === 'bottom' ? 'subir por la escalera' : 'bajar por la escalera'}
        </p>
      ) : (
        v && (
          <>
            <p>
              <kbd className="rounded bg-white/15 px-1 font-mono text-xs">E</kbd>: operar · {v.label}
            </p>
            <p className="text-xs text-slate-300" data-testid="valve-state">
              Registro propio: {states[v.id] ? STATE[states[v.id]] : 'sin operar'}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-amber-300">ilustrativo: no es un procedimiento</p>
          </>
        )
      )}
    </div>
  )
}
