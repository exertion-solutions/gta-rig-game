import { LOCACION_BOUNDS as B } from './frame'

// Disposición de los props del escenario ilustrativo (docs/scenario-additions.md, A5–A8). Solo zonas libres del
// perímetro: fuera de la huella del equipo (x −23…17, z −30…8), lejos del Acceso y de la camioneta. Nada de filas,
// círculos ni cercos de conos: son objetos sueltos o apilados, para que no sugieran ningún recinto ni delimitación.
export type Spot = { x: number; z: number; rot: number }
const s = (x: number, z: number, rot = 0): Spot => ({ x, z, rot })

// grupos de tambores apoyados contra el vallado norte (+Z) y el lado este (+X); posiciones ESTIMADAS
export const BARRELS: readonly Spot[] = [
  s(-34, 27, 0.4),
  s(-32.9, 27.2, 1.7),
  s(-33.6, 26, 2.9),
  s(24.5, 27, 1.1),
  s(25.7, 26.9, 0.2),
  s(25.1, 25.8, 2.2),
  s(26.4, 25.9, 1.4),
  s(30.6, -12, 0.9),
  s(30.4, -13.2, 2.5),
]

// conos sueltos (no más de 2 cerca entre sí), ESTIMADOS
export const CONES: readonly Spot[] = [
  s(-38.5, 14.5),
  s(-36.9, 13.8),
  s(-12, 24.5),
  s(2.5, 21.5),
  s(15.2, 22.8),
  s(29, 12),
  s(31.2, -3.4),
  s(-40.5, -6),
  s(-31, 9.5),
]
