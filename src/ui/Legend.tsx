import { LEYENDA } from '../game/data/evidence'

export function Legend() {
  return (
    <div className="rounded border border-white/10 bg-[#12161a]/70 px-2.5 py-1.5 text-right text-[10px] leading-snug text-slate-300" data-testid="legend">
      <p className="uppercase tracking-wide">{LEYENDA}</p>
      <p className="text-amber-300/90">Signo lateral (+Y = este): sin verificar</p>
    </div>
  )
}
