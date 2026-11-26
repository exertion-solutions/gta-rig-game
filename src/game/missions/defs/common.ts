import { EVIDENCE_LABEL, type Evidence } from '../../data/evidence'
import { buildFicha, type Ficha, type FichaPoint, type FichaZone } from '../../data/ficha'

// Todo texto técnico de las misiones sale de los datos vendorizados vía buildFicha (ya saneado con uiSafe);
// las misiones solo ponen el esqueleto de la consigna. Los nombres de sector son siempre buildFicha(id).name.
const cache = new Map<string, Ficha>()
export const ficha = (sectorId: string): Ficha => {
  let f = cache.get(sectorId)
  if (!f) cache.set(sectorId, (f = buildFicha(sectorId)))
  return f
}
export const sectorName = (id: string) => ficha(id).name

// Sectores con puntos DROPS (ver SECTOR_SECTIONS en ficha.ts).
const POINT_SECTORS = ['mastil', 'piso-enganche', 'bop', 'carrier', 'planchada', 'piletas', 'piso-trabajo', 'llave']
export const findPoint = (id: string): FichaPoint | undefined => POINT_SECTORS.flatMap((s) => ficha(s).points).find((p) => p.id === id)
export const findZone = (sectorId: string, sectionId: string): FichaZone | undefined =>
  ficha(sectorId).zones.find((z) => z.sectionId === sectionId)

/** Quita el punto final del dato para poder encadenar oraciones. */
export const noDot = (t: string) => t.replace(/\.+$/, '')
export const levelLabel = (l: string) => l[0].toUpperCase() + l.slice(1)
export const cite = (x: { sourceId: string; evidence: Evidence; page?: number | null }) =>
  `fuente ${x.sourceId}${x.page ? `, pág. ${x.page}` : ''} · ${EVIDENCE_LABEL[x.evidence]}`
