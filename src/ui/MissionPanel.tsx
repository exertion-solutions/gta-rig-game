import { useState } from 'react'
import { useMissionStore } from '../game/missions/store'
import type { MarkValue, MissionState, Objective } from '../game/missions/types'
import { useHudStore } from './hudStore'
import { AudioSettings } from './AudioControls'
import { Legend } from './Legend'

const btn = 'rounded border border-white/20 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400'
const primary = 'rounded bg-amber-400 px-3 py-1.5 text-sm font-semibold text-black hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white'

/** Controles del objetivo en curso cuando no se resuelve caminando (choose / order / mark). */
function ObjectiveControls({ obj }: { obj: Objective }) {
  const report = useMissionStore((s) => s.report)
  const feedback = useMissionStore((s) => s.mission.feedback)
  const [picked, setPicked] = useState<string[]>([])
  const [order, setOrder] = useState<string[]>(obj.kind === 'order' ? obj.items.map((i) => i.id) : [])
  const retry = feedback === 'retry' && (
    <p className="text-sm text-amber-300" role="status">
      Probá de nuevo, sin penalización.
    </p>
  )

  if (obj.kind === 'mark')
    return (
      <div className="flex gap-2" data-testid="mark-controls">
        {(['OK', 'NOK', 'N/A'] as MarkValue[]).map((v) => (
          <button key={v} className={btn} onClick={() => report({ type: 'mark', objectiveId: obj.id, value: v })}>
            {v}
          </button>
        ))}
      </div>
    )
  if (obj.kind === 'choose') {
    // Una sola respuesta de referencia: radio (antes checkbox: se podían marcar varias y contaba mal sin avisar).
    const single = obj.correct.length === 1
    return (
      <fieldset className="space-y-2" data-testid="choose-controls">
        <legend className="sr-only">Opciones</legend>
        {!single && <p className="text-sm text-slate-300">Podés marcar más de una.</p>}
        {obj.options.map((o) => (
          <label key={o.id} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type={single ? 'radio' : 'checkbox'}
              name={obj.id}
              checked={picked.includes(o.id)}
              onChange={(e) => setPicked((p) => (single ? [o.id] : e.target.checked ? [...p, o.id] : p.filter((x) => x !== o.id)))}
            />
            {o.text}
          </label>
        ))}
        {retry}
        <button className={primary} disabled={picked.length === 0} onClick={() => report({ type: 'choose', objectiveId: obj.id, picked })}>
          Confirmar
        </button>
      </fieldset>
    )
  }
  if (obj.kind === 'order') {
    const move = (i: number, d: number) =>
      setOrder((o) => {
        const n = [...o]
        ;[n[i], n[i + d]] = [n[i + d], n[i]]
        return n
      })
    return (
      <div className="space-y-2" data-testid="order-controls">
        <ol className="space-y-1">
          {order.map((id, i) => (
            <li key={id} className="flex items-center gap-2 text-sm">
              <span className="flex-1">{obj.items.find((x) => x.id === id)?.text}</span>
              <button className={btn} disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir">
                ↑
              </button>
              <button className={btn} disabled={i === order.length - 1} onClick={() => move(i, 1)} aria-label="Bajar">
                ↓
              </button>
            </li>
          ))}
        </ol>
        {retry}
        <button className={primary} onClick={() => report({ type: 'order', objectiveId: obj.id, order })}>
          Confirmar orden
        </button>
      </div>
    )
  }
  return null
}

function resultLine(st: MissionState, o: Objective) {
  const r = st.results[o.id]
  if (r?.kind === 'mark') return `Autorregistro: ${r.value}`
  if (r?.kind === 'choose') return r.correct ? 'Coincide con la referencia' : 'Distinta de la referencia'
  if (r?.kind === 'interact') return `Registro propio: ${r.state === 'open' ? 'abierta' : 'cerrada'} (ilustrativo)`
  return 'Cumplido'
}

export function MissionPanel() {
  const { available, mission, start, restart, exit } = useMissionStore()
  const setPanel = useHudStore((s) => s.setPanel)
  const def = available.find((d) => d.id === mission.missionId)
  const obj = mission.status === 'active' ? def?.objectives[mission.objectiveIndex] : undefined

  const close = () => setPanel(false)
  const title = mission.status === 'completed' ? 'Misión completada' : def ? 'Misión en curso' : 'Misiones'

  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label="Misiones" data-testid="mission-panel">
      <div className="max-h-full w-full max-w-lg space-y-4 overflow-y-auto rounded-lg border border-white/15 bg-[#14181c] p-5 text-slate-100 shadow-2xl">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-400">{title}</p>
            {def && <h2 className="text-xl font-bold">{def.title}</h2>}
          </div>
          <button className={btn} onClick={close} aria-label="Cerrar (Esc)">
            Cerrar (Esc)
          </button>
        </header>

        {!def && (
          <section className="space-y-2" data-testid="mission-list">
            {available.length === 0 && <p className="text-sm text-slate-300">Sin misiones disponibles.</p>}
            {available.map((d) => (
              <article key={d.id} className="rounded border border-white/10 bg-white/5 p-3" data-mission={d.id}>
                <h3 className="font-semibold">{d.title}</h3>
                <p className="mb-2 text-sm text-slate-300">{d.briefing}</p>
                <button
                  className={primary}
                  onClick={() => {
                    start(d.id)
                    close()
                  }}
                >
                  Iniciar
                </button>
              </article>
            ))}
          </section>
        )}

        {def && mission.status === 'active' && (
          <section className="space-y-3">
            <p className="text-sm text-slate-300">{def.briefing}</p>
            <ol className="space-y-1 text-sm" data-testid="panel-objectives">
              {def.objectives.map((o, i) => (
                <li key={o.id} className={i < mission.objectiveIndex ? 'text-slate-400 line-through' : i === mission.objectiveIndex ? 'font-semibold text-amber-300' : 'text-slate-300'}>
                  {i + 1}. {o.text}
                </li>
              ))}
            </ol>
            {obj && <ObjectiveControls key={obj.id} obj={obj} />}
            <div className="flex flex-wrap gap-2 pt-1">
              <button className={btn} onClick={close}>
                Seguir jugando
              </button>
              <button
                className={btn}
                onClick={() => {
                  restart()
                  close()
                }}
              >
                Reintentar
              </button>
              <button className={btn} onClick={() => exit()}>
                Salir de la misión
              </button>
            </div>
          </section>
        )}

        {def && mission.status === 'completed' && (
          <section className="space-y-3" data-testid="mission-completed">
            <p className="text-sm text-slate-300">Terminaste la misión. Lo que marcaste queda en este navegador como registro propio.</p>
            {def.summary && (
              <ul className="space-y-1 rounded border border-white/10 bg-white/5 p-3 text-sm" data-testid="mission-summary">
                {def.summary(mission.results).map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}
            <ul className="space-y-1 text-sm">
              {def.objectives.map((o) => (
                <li key={o.id} className="flex justify-between gap-3 border-b border-white/10 pb-1">
                  <span>{o.text}</span>
                  <span className="text-slate-300">{resultLine(mission, o)}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <button
                className={primary}
                onClick={() => {
                  restart()
                  close()
                }}
              >
                Repetir
              </button>
              <button
                className={btn}
                onClick={() => {
                  exit()
                  close()
                }}
              >
                Cerrar misión
              </button>
            </div>
          </section>
        )}
        <AudioSettings />
        <div className="flex justify-end">
          <Legend />
        </div>
      </div>
    </div>
  )
}
