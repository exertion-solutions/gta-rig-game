import secuencia from '../../../../vendor/visor/secuencia.json' with { type: 'json' }
import { uiSafe } from '../../data/evidence'
import type { MissionDef } from '../types'

type Paso = { orden: number; texto: string }
const pasos = secuencia.pasos as Paso[]
const itemId = (p: Paso) => `paso-${p.orden}`

// Orden de presentación fijo, sin ningún paso en su lugar (el orden inicial nunca es la solución).
const SHUFFLE = [4, 1, 7, 2, 8, 5, 3, 6]
const shuffled = SHUFFLE.map((n) => pasos.find((p) => p.orden === n)).filter((p): p is Paso => !!p)

export const m7: MissionDef = {
  id: 'm7-orden-del-montaje',
  title: 'Orden del montaje',
  briefing:
    'Ordená los 8 pasos de la secuencia típica de montaje de un equipo. Pendiente de validación: es una secuencia aportada por el usuario, no el procedimiento de la empresa ni un requisito. Sin tiempos.',
  objectives: [
    {
      id: 'm7-orden',
      kind: 'order',
      text: 'Ordená los pasos con las flechas y confirmá (pendiente de validación)',
      items: shuffled.map((p) => ({ id: itemId(p), text: uiSafe(p.texto) })),
      correctOrder: [...pasos].sort((a, b) => a.orden - b.orden).map(itemId),
    },
  ],
  requires: () => {
    const out: string[] = []
    if (secuencia.status !== 'pendingValidation') out.push('secuencia.json no está rotulada pendingValidation')
    if (pasos.length !== 8 || pasos.some((p, i) => p.orden !== i + 1)) out.push('secuencia.json no trae 8 pasos consecutivos')
    if (shuffled.length !== pasos.length) out.push('orden de presentación no cubre los pasos')
    if (/\b\d+\s*(min|minutos|h|horas|seg)\b/i.test(JSON.stringify(pasos))) out.push('secuencia.json trae tiempos')
    return out
  },
}
