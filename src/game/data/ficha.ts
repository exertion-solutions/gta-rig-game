import dropsJson from '../../../vendor/visor/drops.json' with { type: 'json' }
import { LEYENDA, isEvidence, uiSafe, type Evidence } from './evidence'
import { getSector, type Vec3 } from './sectors'

type Level = 'alto' | 'medio' | 'bajo'
type DropsPoint = (typeof dropsJson.points)[number]
type DropsSection = (typeof dropsJson.sections)[number]

// Sector -> secciones del Libro DROPS. INFERIDO (igual que el componentId del dataset): el visor no
// liga viewpoints con secciones. Sectores ausentes = sin puntos DROPS asociados.
export const SECTOR_SECTIONS: Record<string, string[]> = {
  mastil: ['corona', 'debajo-corona', 'debajo-piso-enganche'],
  'piso-enganche': ['piso-enganche'],
  bop: ['boca-pozo'],
  carrier: ['subestructura-carrier', 'casilla-maquinista'],
  planchada: ['plano-inclinado'],
  piletas: ['piletas'],
  'piso-trabajo': ['piso-trabajo'],
  llave: ['poste-llave'],
}

export interface FichaText {
  label: 'Función' | 'Riesgos' | 'EPP' | 'Controles'
  text: string
  evidence: Evidence
  sourceId?: string
}

export interface FichaPoint {
  id: string
  name: string
  primary: string | null
  secondary: string | null
  secondaryRequired: boolean
  quantity: string | null
  observation: string | null
  flags: string[]
  evidence: Evidence
  sourceId: string
  page: number | null
  /** Solo true si el estatus es confirmed o procedure. */
  asRequirement: boolean
}

/** Zona A2 de una sección: solo texto cualitativo; nunca radios, alturas ni distancias. */
export interface FichaZone {
  sectionId: string
  sectionLabel: string
  level: Level | null
  text: string
  evidence: Evidence
  sourceId: string
  conflict: { a2: Level; rcco: 'alto'; text: string; sourceId: string } | null
}

export interface Ficha {
  sectorId: string
  name: string
  position: Vec3 | null
  legend: string
  texts: FichaText[]
  zones: FichaZone[]
  points: FichaPoint[]
}

const A2_SOURCE = 'proc-drops-a2'
const LEVEL_LABEL: Record<Level, string> = { alto: 'Alto', medio: 'Medio', bajo: 'Bajo' }

const sectionPoints = (s: DropsSection) => dropsJson.points.filter((p) => p.sectionId === s.id)

function buildZone(s: DropsSection): FichaZone {
  const level = (s.zone as Level | null) ?? null
  const pts = sectionPoints(s)
  const evidence = (pts[0]?.basis.status ?? 'pendingValidation') as Evidence
  // Conflicto declarado por el propio dataset en zoneBasis ("Conflicto: el RCCO ... Riesgo Alto"); no se resuelve.
  const conflict =
    level && level !== 'alto' && /Conflicto:.*RCCO.*Riesgo Alto/.test(s.zoneBasis)
      ? {
          a2: level,
          rcco: 'alto' as const,
          text: `Conflicto sin resolver: el layout A2 clasifica esta área como ${LEVEL_LABEL[level]} y el RCCO la marca como Alto.`,
          sourceId: s.sourceId,
        }
      : null
  return {
    sectionId: s.id,
    sectionLabel: s.label,
    level,
    text: level
      ? `Zona A2: ${LEVEL_LABEL[level]} (clasificación cualitativa del área, sin dimensión).`
      : 'No clasificada en layout A2.',
    evidence,
    sourceId: A2_SOURCE,
    conflict,
  }
}

const buildPoint = (p: DropsPoint): FichaPoint => ({
  id: p.id,
  name: uiSafe(p.name),
  primary: p.primary ? uiSafe(p.primary) : null,
  secondary: p.secondary ? uiSafe(p.secondary) : null,
  secondaryRequired: p.secondaryRequired,
  quantity: p.quantity ? uiSafe(p.quantity) : null,
  observation: p.observation ? uiSafe(p.observation) : null,
  flags: p.flags,
  evidence: p.basis.status as Evidence,
  sourceId: p.basis.sourceId,
  page: p.basis.page ?? null,
  asRequirement: p.basis.status === 'procedure' || p.basis.status === 'confirmed',
})

/** Falla si un punto o dato numérico no lleva sourceId, o si el estatus no es uno de los 4. */
export function validateFicha(f: Ficha): void {
  const check = (id: string, it: { evidence: string; sourceId?: string }, needsSource: boolean) => {
    if (!isEvidence(it.evidence)) throw new Error(`ficha ${f.sectorId}/${id}: evidencia inválida "${it.evidence}"`)
    if (needsSource && !it.sourceId) throw new Error(`ficha ${f.sectorId}/${id}: falta sourceId`)
  }
  f.points.forEach((p) => check(p.id, p, true))
  f.zones.forEach((z) => check(z.sectionId, z, true))
  f.texts.forEach((t) => check(t.label, t, /\d/.test(t.text) || t.evidence !== 'pendingValidation'))
}

export function buildFicha(sectorId: string): Ficha {
  const sector = getSector(sectorId)
  if (!sector) throw new Error(`sector desconocido: ${sectorId}`)
  const sections = (SECTOR_SECTIONS[sectorId] ?? []).map((id) => {
    const s = dropsJson.sections.find((x) => x.id === id)
    if (!s) throw new Error(`sección DROPS inexistente: ${id}`)
    return s
  })
  // Los textos de viewpoints.json no tienen sourceId y se rotulan "pendiente de validación": evidencia pendingValidation.
  const t = sector.ficha
  const texts: FichaText[] = [
    { label: 'Función', text: uiSafe(t.funcion), evidence: 'pendingValidation' },
    { label: 'Riesgos', text: uiSafe(t.riesgos), evidence: 'pendingValidation' },
    { label: 'EPP', text: uiSafe(t.EPP), evidence: 'pendingValidation' },
    { label: 'Controles', text: uiSafe(t.controles), evidence: 'pendingValidation' },
  ]
  const ficha: Ficha = {
    sectorId,
    name: sector.name,
    position: sector.position,
    legend: LEYENDA,
    texts,
    zones: sections.map(buildZone),
    points: sections.flatMap(sectionPoints).map(buildPoint),
  }
  validateFicha(ficha)
  return ficha
}
