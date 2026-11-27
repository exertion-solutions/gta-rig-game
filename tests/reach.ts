// Ayuda compartida por tests unitarios y e2e (no es código del juego): lugares de pie desde donde E opera una válvula.
import { PLAYER_RADIUS } from '../src/game/player/movement'
import { nearestInteractable } from '../src/game/world/interactables'
import { INTERACTABLES, TRAVERSAL, groundLevelAt, type Interactable, type Vec3 } from '../src/game/world/walkable'

const HAND_Y = 1.0 // = Player.tsx (manos sobre los pies)
const HEIGHT = 1.8 // alto de la cápsula del jugador

/** Puntos de apoyo libres (la cápsula no toca ninguna caja medida) cuya mano tiene a `it` como válvula más cercana. */
export function standSpots(it: Interactable, margin = 0.03): Vec3[] {
  const out: Vec3[] = []
  for (let r = 0.45; r <= 1.3; r += 0.05)
    for (let k = 0; k < 32; k++) {
      const a = (k / 32) * Math.PI * 2
      const x = it.position[0] + r * Math.cos(a)
      const z = it.position[2] + r * Math.sin(a)
      const y = groundLevelAt(x, z)
      const free = TRAVERSAL.solids.every((s) => {
        const [cx, cy, cz] = s.center
        const [hx, hy, hz] = s.half
        if (cy + hy <= y + 0.05 || cy - hy >= y + HEIGHT) return true // fuera de la altura del cuerpo (o es el piso)
        const dx = Math.max(Math.abs(x - cx) - hx, 0)
        const dz = Math.max(Math.abs(z - cz) - hz, 0)
        return Math.hypot(dx, dz) > PLAYER_RADIUS + margin
      })
      if (free && nearestInteractable([x, y + HAND_Y, z], INTERACTABLES)?.id === it.id) out.push([x, y, z])
    }
  return out
}
