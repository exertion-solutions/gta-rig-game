import dropsJson from '../../../../vendor/visor/drops.json' with { type: 'json' }
import viewpointsJson from '../../../../vendor/visor/viewpoints.json' with { type: 'json' }
import { uiSafe } from '../../data/evidence'
import type { MissionDef } from '../types'

// Las cifras de anclajes de vientos (25 ± 3 m vs 20 m) NO están en los datos vendorizados: drops.json declara que no trae
// distancias y viewpoints.json no las cita. Solo aparecen en prosa de legacy-ext/86-textos-sk575.js del visor, que además
// trae más de dos cifras en conflicto. No se inventan ni se transcriben a mano: la misión se omite hasta que un dato
// vendorizado (con su fuente) traiga la oración "Fuente en conflicto" con ambas cifras.
const strings = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []

/** Oración vendorizada que trae ambas cifras y el rótulo de conflicto; null si no existe. */
export function windConflictSentence(): string | null {
  const all = [...strings(dropsJson), ...strings(viewpointsJson)]
  for (const t of all)
    for (const sentence of t.split(/(?<=\.)\s+/))
      if (/Fuente en conflicto/i.test(sentence) && /vient|ancl/i.test(sentence) && /25\s*±\s*3\s*m/.test(sentence) && /\b20\s*m\b/.test(sentence))
        return uiSafe(sentence)
  return null
}

const sentence = windConflictSentence()

export const m8: MissionDef = {
  id: 'm8-fuente-en-conflicto',
  title: 'Fuente en conflicto',
  briefing: 'Dos fuentes dan cifras distintas para los anclajes de vientos. Vas a ver las dos, con su fuente; no se resuelve cuál vale.',
  objectives: [{ id: 'm8-mastil', kind: 'reach', text: `Visitá el mástil y leé: ${sentence ?? 'dato ausente'}`, sectorId: 'mastil' }],
  requires: () =>
    sentence ? [] : ['las cifras de anclajes de vientos (25 ± 3 m y 20 m) no están en los datos vendorizados; no se inventan'],
}
