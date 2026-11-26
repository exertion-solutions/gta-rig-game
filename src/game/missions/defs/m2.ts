import { getSectors } from '../../data/sectors'
import type { MissionDef, Objective, ObjectiveResult } from '../types'
import { ficha, sectorName } from './common'

// Misma regla que 93-induccion.js del visor: "¿A qué sector corresponde esta función?" con las fichas de los
// viewpoints (sin los marcados "ilustrativo"), 4 opciones, meta 75 %. Acá la selección es fija (no aleatoria).
const MAX_Q = 8
const MIN_Q = 4
const base = getSectors().filter((s) => s.ficha.funcion && !/ilustrativo/i.test(s.name))
// El Acceso no tiene equipo: las preguntas salen de los sectores con objeto 3D.
const asked = base.filter((s) => s.id !== 'acceso').slice(0, MAX_Q)

const objectives: Objective[] = asked.map((s, i) => {
  const at = base.findIndex((b) => b.id === s.id)
  const others = [3, 5, 8].map((k) => base[(at + k) % base.length].id)
  const ids = [s.id, ...others]
  const r = i % ids.length // rota la posición de la correcta
  const opts = [...ids.slice(r), ...ids.slice(0, r)]
  return {
    id: `m2-q${i + 1}`,
    kind: 'choose',
    text: `¿A qué sector corresponde esta función? ${ficha(s.id).texts[0].text}`,
    options: opts.map((id) => ({ id, text: sectorName(id) })),
    correct: [s.id],
    advanceOnWrong: true,
  }
})

/** Meta de repaso proporcional (75 %, como el visor): 6 de 8. El motor no la conoce; se cuenta acá. */
export const m2Target = (n: number) => Math.ceil(n * 0.75)
export const m2Count = (results: Record<string, ObjectiveResult>) =>
  Object.entries(results).filter(([id, r]) => id.startsWith('m2-q') && r.kind === 'choose' && r.correct).length

export const m2: MissionDef = {
  id: 'm2-que-hace-cada-sector',
  title: '¿Qué hace cada sector?',
  briefing: `Emparejá la función con el sector: ${objectives.length} preguntas. Una respuesta distinta de la referencia no frena la misión; al final ves cuántas coinciden (referencia de repaso: ${m2Target(objectives.length)} de ${objectives.length}). Es un registro propio, no una evaluación.`,
  objectives,
  requires: () => (objectives.length >= MIN_Q ? [] : [`solo ${objectives.length} preguntas utilizables (mínimo ${MIN_Q})`]),
  summary: (results) => [
    `Respuestas que coinciden con la referencia: ${m2Count(results)} de ${objectives.length}.`,
    `Referencia de repaso: ${m2Target(objectives.length)} de ${objectives.length}. Registro propio, sin calificación.`,
  ],
}
