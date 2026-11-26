import { getSectors } from '../../data/sectors'
import type { MissionDef } from '../types'

const IDS = getSectors().map((s) => s.id)

export const m1: MissionDef = {
  id: 'm1-reconocimiento',
  title: 'Reconocimiento',
  briefing: `Conducí hasta el Acceso y después recorré los ${IDS.length} sectores de la locación, en el orden que quieras. El punto de partida no cuenta como llegada: salí del Acceso y volvé.`,
  objectives: [
    { id: 'm1-acceso', kind: 'reach', text: 'Conducí hasta el Acceso a la locación', sectorId: 'acceso' },
    { id: 'm1-recorrido', kind: 'visitAll', text: `Visitá los ${IDS.length} sectores`, sectorIds: IDS },
  ],
  requires: (data) =>
    IDS.length === 14 && IDS.every((id) => data.sectors.some((s) => s.id === id))
      ? []
      : [`se esperaban 14 sectores en viewpoints.json y hay ${data.sectors.length}`],
}
