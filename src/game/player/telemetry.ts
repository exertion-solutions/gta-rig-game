// Estado de movimiento que leen el clip del personaje y el sonido. Módulo aparte (sin Rapier): el audio vive en el
// chunk principal y no debe arrastrar el chunk diferido de la física.
// rapidez horizontal real (m/s) del último paso de física; la usa CharacterModel para elegir clip
export const playerSpeed = { current: 0 }
// acción en curso, para el clip: trepando (y si se mueve), en el aire tras saltar, operando hasta `operatingUntil` (ms)
export const playerAction = { climbing: false, climbMoving: false, airborne: false, operatingUntil: 0 }
// rapidez de la camioneta (m/s) a lo largo de su frente; negativa marcha atrás
export const truckSpeed = { current: 0 }
