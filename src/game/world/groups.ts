// Grupos de colisión de Rapier: (pertenencia << 16) | filtro, 16 bits cada uno. Sin importar Rapier (lo usa walkable.ts).
// Las escaleras se recorren a pie como rampa por la línea de narices; la camioneta no debe treparlas (QA D-09: quedaba
// encaramada a 26° en la escalera de una pileta): no ve esa rampa y choca contra el volumen bajo de la escalera
// ('truckBlock'), que el jugador y la cámara no ven.
const ALL = 0xffff
export const G = { player: 1 << 0, truck: 1 << 1, stair: 1 << 2, truckBlock: 1 << 3 }
export const groups = (member: number, filter: number) => ((member << 16) | filter) >>> 0
export const PLAYER_GROUPS = groups(G.player, ALL) // también la cámara y el "¿hay lugar para bajar?"
export const TRUCK_GROUPS = groups(G.truck, ALL)
export const STAIR_GROUPS = groups(G.stair, ALL & ~G.truck)
export const TRUCK_BLOCK_GROUPS = groups(G.truckBlock, G.truck)
