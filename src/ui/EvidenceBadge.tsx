import { EVIDENCE_LABEL, canBePresentedAsRequirement, type Evidence } from '../game/data/evidence'

const TONE: Record<Evidence, string> = {
  confirmed: 'bg-emerald-700 text-white',
  procedure: 'bg-sky-700 text-white',
  goodPractice: 'bg-amber-600 text-black',
  pendingValidation: 'bg-neutral-500 text-white',
}

export function EvidenceBadge({ evidence, sourceId }: { evidence: Evidence; sourceId?: string }) {
  return (
    <span
      data-evidence={evidence}
      title={`${canBePresentedAsRequirement(evidence) ? 'Puede presentarse como requisito' : 'No es requisito'}${sourceId ? ` · fuente: ${sourceId}` : ''}`}
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${TONE[evidence]}`}
    >
      {EVIDENCE_LABEL[evidence]}
      {sourceId ? ` · ${sourceId}` : ''}
    </span>
  )
}
