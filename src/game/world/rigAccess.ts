// Acceso al carrier y a la casilla del maquinista, y los dos comandos que se operan (izaje del aparejo y llave de
// potencia). Escenario ilustrativo añadido por el juego, no as-built (docs/scenario-additions.md, A9–A11): las cajas se
// midieron sobre los GLB (mapa de alturas de carrier + cuadro + izaje en grilla de 0,25 m), pero el recorrido, las
// posiciones de los comandos y los movimientos son del juego. No es un procedimiento ni simula cargas.
import type { BoxCollider, Interactable, LadderVolume, Vec3 } from './walkable'

const box = (id: string, min: Vec3, max: Vec3): BoxCollider => ({
  id,
  center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
  half: [(max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2],
})

export const DECK_Y = 1.35 // cubierta del carrier (medida)
export const CABIN_Y = 3.55 // piso de la casilla y su descanso (medido)
const WALL = 0.06

// Reemplazan la caja única del carrier (llegaba a y 6,03 y tapaba la cubierta y la casilla).
export const CARRIER_COLLIDERS: BoxCollider[] = [
  box('carrier_chasis', [-15.6, 0, -1.5], [-1.55, DECK_Y, 1.5]),
  // La cornisa libre entre el cuadro y el borde mide 0,31 m y la cápsula 0,70: apoyo invisible para caminar por el borde.
  box('carrier_cornisa', [-11.0, DECK_Y - 0.2, 1.5], [-5.25, DECK_Y, 1.95]),
  box('carrier_motor', [-15.6, DECK_Y, -1.5], [-11.0, 4.0, 1.5]),
  box('carrier_cuadro', [-10.0, DECK_Y, -1.5], [-5.5, 3.0, 1.0]),
  box('carrier_cuadro_tambor', [-8.5, DECK_Y, 1.0], [-6.0, 2.8, 1.2]),
  box('carrier_izaje', [-5.25, DECK_Y, -1.5], [-1.55, 5.5, 0.55]),
  box('casilla_escalera_bloque', [-5.25, DECK_Y, 0.55], [-3.75, CABIN_Y - 0.25, 1.35]),
  box('casilla_pedestal', [-3.75, 0, 0.6], [-1.5, CABIN_Y, 2.67]),
  // El descanso mide 0,50 m de ancho y la cápsula 0,70: apoyo invisible de 0,30 m hacia −X, con la baranda corrida igual.
  box('casilla_descanso', [-4.05, CABIN_Y - 0.2, 0.6], [-3.75, CABIN_Y, 2.67]),
  // Casilla: paredes y baranda del descanso. La pared −X deja el vano de la puerta en z 1,5…2,3: más cerca de la escalera
  // se entraría contra la banda baja del mástil (sk575_mastil_banda1, z ≤ 1,0), que invade ese lado de la casilla.
  box('casilla_pared_mz', [-3.75, CABIN_Y, 0.6 - WALL], [-1.5, 6.0, 0.6]),
  box('casilla_pared_pz', [-3.75, CABIN_Y, 2.67], [-1.5, 6.0, 2.67 + WALL]),
  box('casilla_pared_px', [-1.5, CABIN_Y, 0.6], [-1.5 + WALL, 6.0, 2.67]),
  box('casilla_pared_mx_a', [-3.2 - WALL, CABIN_Y, 0.6], [-3.2, 6.0, 1.5]),
  box('casilla_pared_mx_b', [-3.2 - WALL, CABIN_Y, 2.3], [-3.2, 6.0, 2.67]),
  box('casilla_baranda', [-4.05 - WALL, CABIN_Y, 0.6], [-4.05, CABIN_Y + 1.0, 2.67]),
]

const TO_PX = -Math.PI / 2 // yaw del que sube mirando a +X
// Las dos escaleras del carrier se recorren en modo escalera (cinemático): la de la casilla tiene 54°, más que la
// pendiente máxima del controlador (50°), y la amarilla llega a una cubierta donde no entra una rampa de colisión.
export const ACCESS_LADDERS: LadderVolume[] = [
  // amarilla, 5 huellas, del suelo a la cubierta (x −11,45…−10,29; z 1,50…2,00)
  { id: 'carrier_escalera', partId: 'sk575_carrier', bottom: [-11.5, 0, 1.9], top: [-10.35, DECK_Y, 1.9], facing: TO_PX, topRelease: [-10.5, DECK_Y, 0.9] },
  // de la cubierta al descanso de la casilla, 10 huellas (x −5,11…−3,55; z 0,60…1,30)
  { id: 'casilla_escalera', partId: 'sk575_carrier', bottom: [-5.15, DECK_Y, 0.95], top: [-3.7, CABIN_Y, 0.95], facing: TO_PX, bottomRelease: [-5.6, DECK_Y, 1.5], topRelease: [-3.65, CABIN_Y, 0.98] },
]

export type Control = Interactable & { kind: 'hoist' | 'tong' }
// `position` = altura de las manos (como las válvulas). El comando de izaje va dentro de la casilla, contra la pared que
// mira al pozo; la llave se acciona desde el piso de trabajo, junto a su cuerpo.
export const CONTROLS: Control[] = [
  { id: 'comando_izaje', kind: 'hoist', partId: 'sk575_carrier', position: [-1.85, CABIN_Y + 1.0, 1.9], label: 'Comando de izaje del aparejo', sourceId: 'juego' },
  { id: 'llave_potencia', kind: 'tong', partId: 'sk575_llave', position: [0.75, 3.606 + 1.0, 0.75], label: 'Llave de potencia', sourceId: 'juego' },
]

// --- Movimientos (valores de juego) ---
export const HOIST = { up: 6, down: -3, speed: 1.2 } // m respecto de la posición del GLB; m/s
/** Altura objetivo del aparejo según el registro del comando: izado, bajo o, sin operar, donde lo dejó el GLB. */
export const hoistTarget = (state: 'open' | 'closed' | undefined) => (state === 'open' ? HOIST.up : state === 'closed' ? HOIST.down : 0)

export const TONG = { angle: 0.45, seconds: 1.6 } // rad de giro sobre el eje del pozo; ida y vuelta
/** Giro de la llave a `t` segundos de accionada: va y vuelve suave; fuera del intervalo, 0. */
export const tongAngle = (t: number) => (t <= 0 || t >= TONG.seconds ? 0 : TONG.angle * Math.sin((Math.PI * t) / TONG.seconds) ** 2)

/** Triángulos de la llave que cuelgan (cuerpo, mordazas, resorte y su cable): el resto queda fijo al piso. */
export const isTongPart = (c: readonly number[]) => c[1] > 4.72 && Math.abs(c[2]) < 0.45 && c[0] > -0.4

/** Parte un índice de triángulos en dos según el centroide de cada uno. */
export function splitIndex(position: ArrayLike<number>, index: ArrayLike<number>, pick: (centroid: number[]) => boolean) {
  const picked: number[] = []
  const rest: number[] = []
  for (let i = 0; i < index.length; i += 3) {
    const c = [0, 0, 0]
    for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) c[k] += position[index[i + j] * 3 + k] / 3
    ;(pick(c) ? picked : rest).push(index[i], index[i + 1], index[i + 2])
  }
  return { picked, rest }
}
