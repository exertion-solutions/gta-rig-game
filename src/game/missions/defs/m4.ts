import type { MissionDef, ObjectiveResult } from '../types'
import { cite, findPoint, noDot, sectorName } from './common'

const IDS = ['PE-3', 'PE-4']
const text = (id: string) => {
  const p = findPoint(id)
  if (!p) return `${id}: dato ausente`
  return `Leé ${p.id} · ${p.name}. Primaria: ${noDot(p.primary ?? 'sin dato')}. Secundaria: ${noDot(p.secondary ?? 'sin dato')}. (${cite(p)}). Marcá OK, NOK o N/A: es tu registro propio.`
}

export const m4: MissionDef = {
  id: 'm4-retencion-en-altura',
  title: 'Retención en altura',
  briefing: 'En el piso de enganche, leé la retención primaria y la secundaria de dos puntos del Libro DROPS y marcá OK, NOK o N/A. Queda como registro propio en este navegador; nadie lo evalúa.',
  objectives: [
    { id: 'm4-llegada', kind: 'reach', text: `Subí por la escalera vertical a ${sectorName('piso-enganche')}`, sectorId: 'piso-enganche' },
    ...IDS.map((id) => ({ id: `m4-${id}`, kind: 'mark' as const, text: text(id) })),
  ],
  requires: () => IDS.flatMap((id) => (findPoint(id)?.primary ? [] : [`punto DROPS ${id} ausente o sin retención primaria`])),
  summary: (results: Record<string, ObjectiveResult>) => [
    ...IDS.map((id) => {
      const r = results[`m4-${id}`]
      return `${id}: ${r?.kind === 'mark' ? r.value : 'sin registro'}`
    }),
    'Autorregistro tal como lo marcaste; no se evalúa.',
  ],
}
