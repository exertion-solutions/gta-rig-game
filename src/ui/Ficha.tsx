import type { Ficha as FichaData } from '../game/data/ficha'
import { EvidenceBadge } from './EvidenceBadge'

export function Ficha({ ficha }: { ficha: FichaData }) {
  return (
    <article className="max-w-xl space-y-3 rounded bg-black/80 p-4 text-sm text-white" data-sector={ficha.sectorId}>
      <header>
        <h2 className="text-lg font-bold">{ficha.name}</h2>
        {ficha.position === null && <p className="text-xs italic text-neutral-300">sin posición documentada</p>}
        <p className="text-xs text-neutral-300">{ficha.legend}</p>
      </header>

      <section>
        {ficha.texts.map((t) => (
          <p key={t.label} className="mb-1">
            <strong>{t.label}: </strong>
            {t.text} <EvidenceBadge evidence={t.evidence} sourceId={t.sourceId} />
          </p>
        ))}
      </section>

      {ficha.zones.map((z) => (
        <section key={z.sectionId} data-zone={z.level ?? 'sin-clasificar'}>
          <h3 className="font-semibold">{z.sectionLabel}</h3>
          <p>
            {z.text} <EvidenceBadge evidence={z.evidence} sourceId={z.sourceId} />
          </p>
          {z.conflict && (
            <div className="mt-1 rounded border border-amber-500 p-2 text-amber-300" role="note" data-conflict>
              <p className="font-semibold">{z.conflict.title}</p>
              {z.conflict.lines.map((l) => (
                <p key={l.label}>
                  {l.label}: {l.level[0].toUpperCase() + l.level.slice(1)} <EvidenceBadge evidence={l.evidence} sourceId={l.sourceId} />
                </p>
              ))}
            </div>
          )}
        </section>
      ))}

      {ficha.points.length === 0 ? (
        <p className="italic text-neutral-300">Sin puntos de control DROPS asociados a este sector.</p>
      ) : (
        <ul className="space-y-2">
          {ficha.points.map((p) => (
            <li key={p.id} className="rounded border border-white/20 p-2">
              <p className="font-semibold">
                {p.id} · {p.name} <EvidenceBadge evidence={p.evidence} sourceId={p.sourceId} />
                {p.asRequirement ? ' · requisito del procedimiento' : p.flags.length > 0 ? ' · dato dudoso, no presentado como requisito' : ''}
              </p>
              {p.primary && <p>Sujeción primaria: {p.primary}</p>}
              {p.secondary && <p>Secundaria: {p.secondary}</p>}
              {p.quantity && <p>Cantidad: {p.quantity}</p>}
              {p.observation && <p>Observación: {p.observation}</p>}
              {p.flags.length > 0 && <p className="text-xs text-amber-300">Marcas del dato: {p.flags.join(', ')}</p>}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
