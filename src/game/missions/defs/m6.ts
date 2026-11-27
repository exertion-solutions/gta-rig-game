import type { MissionDef } from '../types'
import { cite, ficha, findZone, sectorName } from './common'

const STOPS = [
  { id: 'm6-piso-trabajo', sector: 'piso-trabajo', section: 'piso-trabajo' },
  { id: 'm6-poste-llave', sector: 'llave', section: 'poste-llave' },
]
const range = (sector: string) => {
  const ids = ficha(sector).points.map((p) => p.id)
  return ids.length ? `${ids[0]} a ${ids[ids.length - 1]}` : 'sin puntos'
}
// Cómo se llega en el juego: escalera de la pasarela y rampa de la planchada hasta el piso; la llave está sobre el piso.
const GO: Record<string, () => string> = {
  'piso-trabajo': () => `Subí a ${sectorName('piso-trabajo')} por la escalera de la pasarela y la rampa de la planchada`,
  llave: () => `Sobre el piso, andá hasta ${sectorName('llave')}`,
}
const text = (s: (typeof STOPS)[number]) => {
  const z = findZone(s.sector, s.section)
  return `${GO[s.sector]()} (${range(s.sector)}). ${z?.sectionLabel ?? ''}: ${z?.text ?? 'dato ausente'} (${z ? cite(z) : ''})`
}

export const m6: MissionDef = {
  id: 'm6-zona-sin-clasificar',
  title: 'Zona sin clasificar',
  briefing: 'Dos áreas del Libro DROPS no figuran clasificadas en el layout A2. Encontralas: sin clasificar no equivale a ninguna de las tres zonas del layout.',
  objectives: STOPS.map((s) => ({ id: s.id, kind: 'reach' as const, text: text(s), sectorId: s.sector })),
  requires: () =>
    STOPS.flatMap((s) => {
      const z = findZone(s.sector, s.section)
      if (!z) return [`sin sección DROPS ${s.section}`]
      if (z.level !== null) return [`${s.section} figura clasificada (${z.level}) en los datos`]
      return ficha(s.sector).points.length ? [] : [`${s.section} sin puntos`]
    }),
}
