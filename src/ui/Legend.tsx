import { LEYENDA } from '../game/data/evidence'

export function Legend() {
  return (
    <div className="rounded border border-white/10 bg-[#12161a]/90 px-2.5 py-1.5 text-right text-xs leading-snug text-slate-200" data-testid="legend">
      <p className="uppercase tracking-wide">{LEYENDA}</p>
      <p className="text-amber-300">Signo lateral (+Y = este): sin verificar</p>
    </div>
  )
}
