// Estado de movimiento que leen el clip del personaje y el sonido. Módulo aparte (sin Rapier): el audio vive en el
// chunk principal y no debe arrastrar el chunk diferido de la física.
// rapidez horizontal real (m/s) del último paso de física; la usa CharacterModel para elegir clip
export const playerSpeed = { current: 0 }
// hacia dónde mira el cuerpo (rad, misma convención que yaw). Independiente de la cámara: girando el mouse con el
// personaje quieto se le ve la cara. Lo fija Player (rumbo al moverse, escalera, válvula); null = aún no se movió.
export const playerFacing: { current: number | null } = { current: null }
// acción en curso, para el clip: trepando (si se mueve y hacia dónde: +1 sube, −1 baja), en el aire tras saltar, operando hasta `operatingUntil` (ms)
export const playerAction = { climbing: false, climbMoving: false, climbDir: 0, airborne: false, crouching: false, operatingUntil: 0 }
// rapidez de la camioneta (m/s) a lo largo de su frente; negativa marcha atrás
export const truckSpeed = { current: 0 }
