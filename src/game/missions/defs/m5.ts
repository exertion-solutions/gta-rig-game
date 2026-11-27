import type { MissionDef } from '../types'
import { cite, findPoint, noDot, sectorName } from './common'

// Comparación de lectura: BP-4 y DCO-3 (secundaria requerida en el dato) frente a PE-3 y PE-4 (no requerida).
const IDS = ['BP-4', 'DCO-3', 'PE-3', 'PE-4']
const line = (id: string) => {
  const p = findPoint(id)
  return p ? `${p.id} · ${p.name}: secundaria «${noDot(p.secondary ?? 'sin dato')}» (${cite(p)})` : `${id}: dato ausente`
}
const required = IDS.filter((id) => findPoint(id)?.secondaryRequired)

export const m5: MissionDef = {
  id: 'm5-secundaria-requerida',
  title: '¿Secundaria requerida?',
  briefing: 'Compará cuatro puntos del Libro DROPS y fijate en cuáles el dato indica secundaria requerida. Es lectura de la tabla, no un juicio.',
  objectives: [
    // Mismo verbo que m3/m4: el piso de enganche exige trepar la escalera vertical (antes "Visitá…", ambiguo con "Mástil y vientos").
    {
      id: 'm5-recorrido',
      kind: 'visitAll',
      text: `Recorré, en cualquier orden: ${sectorName('bop')}; el pie de ${sectorName('mastil')}; y, subiendo por la escalera vertical, ${sectorName('piso-enganche')}`,
      sectorIds: ['bop', 'mastil', 'piso-enganche'],
    },
    {
      id: 'm5-comparar',
      kind: 'choose',
      text: `Leé: ${IDS.map(line).join(' | ')}. ¿En cuáles el dato marca secundaria requerida? Marcá todas las que correspondan.`,
      options: IDS.map((id) => ({ id, text: id })),
      correct: required,
    },
  ],
  requires: () => {
    const out = IDS.filter((id) => !findPoint(id)).map((id) => `punto DROPS ${id} ausente`)
    if (out.length) return out
    const want: Record<string, boolean> = { 'BP-4': true, 'DCO-3': true, 'PE-3': false, 'PE-4': false }
    return IDS.filter((id) => findPoint(id)!.secondaryRequired !== want[id]).map((id) => `${id}: secondaryRequired no coincide con el spec`)
  },
}
