import type { MissionDef } from '../types'
import { cite, findZone, levelLabel, sectorName } from './common'

// Zonas de A2 solo como texto con su evidencia (sin radios ni distancias). Sector -> secciones y nivel esperado por el spec.
const STOPS: { id: string; sector: string; sections: [string, string][] }[] = [
  { id: 'm3-corona', sector: 'mastil', sections: [['corona', 'alto']] },
  { id: 'm3-enganche', sector: 'piso-enganche', sections: [['piso-enganche', 'alto']] },
  { id: 'm3-boca-pozo', sector: 'bop', sections: [['boca-pozo', 'medio']] },
  { id: 'm3-subestructura', sector: 'carrier', sections: [['subestructura-carrier', 'medio'], ['casilla-maquinista', 'medio']] },
  { id: 'm3-piletas', sector: 'piletas', sections: [['piletas', 'bajo']] },
]

// Cómo se llega (recorrido del juego): la corona no tiene acceso; el piso de enganche se alcanza por la escalera vertical.
const GO: Record<string, () => string> = {
  mastil: () => `Llegá al pie de ${sectorName('mastil')} (la corona no tiene acceso en el juego).`,
  'piso-enganche': () => `Subí por la escalera vertical a ${sectorName('piso-enganche')}.`,
}

const lineOf = (sector: string, section: string) => {
  const z = findZone(sector, section)
  if (!z) return ''
  const conflict = z.conflict
    ? ` ${z.conflict.title}: ${z.conflict.lines.map((l) => `${l.label} ${levelLabel(l.level)} (${cite(l)})`).join(' vs ')}.`
    : ''
  return `${z.sectionLabel}: ${z.text} (${cite(z)}).${conflict}`
}

export const m3: MissionDef = {
  id: 'm3-mapa-de-zonas',
  title: 'Mapa de zonas',
  briefing: 'Recorré los sectores y leé cómo el layout A2 clasifica cada área. Es lectura del dato, con su fuente; no es una medida de distancia.',
  objectives: STOPS.map((s) => ({
    id: s.id,
    kind: 'reach' as const,
    text: `${GO[s.sector]?.() ?? `Visitá ${sectorName(s.sector)}.`} ${s.sections.map(([sec]) => lineOf(s.sector, sec)).join(' ')}`,
    sectorId: s.sector,
  })),
  requires: () => {
    const out: string[] = []
    for (const s of STOPS)
      for (const [sec, want] of s.sections) {
        const z = findZone(s.sector, sec)
        if (!z) out.push(`sin sección DROPS ${sec}`)
        else if (z.level !== want) out.push(`zona A2 de ${sec}: el dato dice ${z.level ?? 'sin clasificar'} y la misión espera ${want}`)
      }
    const c = findZone('bop', 'boca-pozo')?.conflict
    const a2 = c?.lines.find((l) => l.label === 'Layout A2')
    const rcco = c?.lines.find((l) => l.label === 'RCCO')
    if (a2?.level !== 'medio' || rcco?.level !== 'alto') out.push('boca de pozo sin el conflicto A2 (Medio) vs RCCO (Alto) en los datos')
    return out
  },
}
