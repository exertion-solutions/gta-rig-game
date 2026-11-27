import { getSectors } from '../../data/sectors'
import type { MissionDef } from '../types'

const IDS = getSectors().map((s) => s.id)
// El Acceso es el primer objetivo: el recorrido pide los otros 13 (antes los 14, y el Acceso, recién cumplido, exigía
// salir y volver una segunda vez: el HUD mostraba 14/14 y 13/14 a la vez).
const REST = IDS.filter((id) => id !== 'acceso')

export const m1: MissionDef = {
  id: 'm1-reconocimiento',
  title: 'Reconocimiento',
  briefing: `Llegá al Acceso de la locación desde afuera, a pie o en la camioneta (E), y después recorré los otros ${REST.length} sectores en el orden que quieras: ${IDS.length} en total. El punto de partida no cuenta como llegada: si empezás en el Acceso, salí y volvé a entrar.`,
  objectives: [
    { id: 'm1-acceso', kind: 'reach', text: 'Entrá al Acceso desde afuera, a pie o en la camioneta (si ya estás en él, salí y volvé)', sectorId: 'acceso' },
    { id: 'm1-recorrido', kind: 'visitAll', text: `Visitá los otros ${REST.length} sectores`, sectorIds: REST },
  ],
  requires: (data) =>
    IDS.length === 14 && IDS.every((id) => data.sectors.some((s) => s.id === id))
      ? []
      : [`se esperaban 14 sectores en viewpoints.json y hay ${data.sectors.length}`],
}
