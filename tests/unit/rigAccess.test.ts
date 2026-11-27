// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { ladderEndNear, ladderRelease } from '../../src/game/player/climb'
import { PLAYER_RADIUS } from '../../src/game/player/movement'
import { ACCESS_LADDERS, CABIN_Y, CARRIER_COLLIDERS, CONTROLS, DECK_Y, HOIST, TONG, hoistTarget, isTongPart, splitIndex, tongAngle } from '../../src/game/world/rigAccess'
import { LADDERS, REPLACED_PARTS, walkableColliders } from '../../src/game/world/walkable'

// ¿la cápsula de pie en `p` (pies) queda libre de las cajas del carrier?
const free = (p: readonly number[]) =>
  CARRIER_COLLIDERS.every((c) => {
    const dx = Math.max(Math.abs(p[0] - c.center[0]) - c.half[0], 0)
    const dz = Math.max(Math.abs(p[2] - c.center[2]) - c.half[2], 0)
    const over = p[1] + 0.02 >= c.center[1] + c.half[1] || p[1] + 1.8 <= c.center[1] - c.half[1]
    return over || Math.hypot(dx, dz) >= PLAYER_RADIUS - 0.01
  })
// ¿hay una caja con la cara superior a la altura de los pies bajo `p`?
const supported = (p: readonly number[]) =>
  p[1] === 0 || CARRIER_COLLIDERS.some((c) => Math.abs(c.center[1] + c.half[1] - p[1]) < 0.01 && Math.abs(p[0] - c.center[0]) <= c.half[0] && Math.abs(p[2] - c.center[2]) <= c.half[2])

describe('acceso al carrier y a la casilla', () => {
  it('el carrier deja de usar su caja única y sus cajas entran en la colisión', () => {
    expect(REPLACED_PARTS.has('sk575_carrier')).toBe(true)
    const ids = walkableColliders().map((c) => c.id)
    for (const c of CARRIER_COLLIDERS) expect(ids).toContain(c.id)
    for (const c of CARRIER_COLLIDERS) c.half.forEach((h) => expect(h).toBeGreaterThan(0))
  })
  it('las dos escaleras están en LADDERS y suben de suelo a cubierta y de cubierta a casilla', () => {
    const [a, b] = ACCESS_LADDERS
    expect(LADDERS).toContain(a)
    expect([a.bottom[1], a.top[1]]).toEqual([0, DECK_Y])
    expect([b.bottom[1], b.top[1]]).toEqual([DECK_Y, CABIN_Y])
  })
  it('al soltarse en cada extremo queda de pie sobre algo y sin chocar', () => {
    for (const l of ACCESS_LADDERS)
      for (const end of ['bottom', 'top'] as const) {
        const p = ladderRelease(l, end)
        expect(free(p), `${l.id} ${end} choca`).toBe(true)
        expect(supported(p), `${l.id} ${end} en el aire`).toBe(true)
        expect(ladderEndNear(p, LADDERS)?.ladder.id).toBe(l.id) // desde ahí se vuelve a tomar la misma
      }
  })
  it('hay paso por la cornisa entre las dos escaleras', () => {
    const z = 1.2 + PLAYER_RADIUS + 0.02 // pegado al tambor del cuadro
    for (let x = -10.4; x <= -5.6; x += 0.2) {
      expect(free([x, DECK_Y, z]), `x ${x.toFixed(1)}`).toBe(true)
      expect(supported([x, DECK_Y, z]), `x ${x.toFixed(1)}`).toBe(true)
    }
  })
  it('del descanso se entra a la casilla por el vano y el comando queda al alcance adentro', () => {
    for (let z = 0.98; z <= 1.9; z += 0.2) expect(free([-3.65, CABIN_Y, z]), `descanso z ${z}`).toBe(true)
    for (let x = -3.65; x <= -2.0; x += 0.25) expect(free([x, CABIN_Y, 1.9]), `vano x ${x}`).toBe(true)
    const hoist = CONTROLS.find((c) => c.kind === 'hoist')!
    expect(free([hoist.position[0] - 0.1, CABIN_Y, hoist.position[2]])).toBe(true)
    expect(hoist.position[1]).toBeCloseTo(CABIN_Y + 1, 6)
  })
})

describe('comandos (valores de juego)', () => {
  it('izaje: sin operar queda donde está; izar y bajar alternan', () => {
    expect(hoistTarget(undefined)).toBe(0)
    expect(hoistTarget('open')).toBe(HOIST.up)
    expect(hoistTarget('closed')).toBe(HOIST.down)
    expect(10.61 + HOIST.down).toBeGreaterThan(7.01) // el aparejo bajo no toca la llave (tope medido 7,01)
  })
  it('llave: gira y vuelve a cero', () => {
    expect(tongAngle(0)).toBe(0)
    expect(tongAngle(TONG.seconds / 2)).toBeCloseTo(TONG.angle, 6)
    expect(tongAngle(TONG.seconds)).toBe(0)
    expect(tongAngle(99)).toBe(0)
  })
  it('llave: se mueve lo que cuelga y queda fijo lo del piso', () => {
    expect(isTongPart([0.8, 5.0, 0])).toBe(true) // cuerpo
    expect(isTongPart([0.7, 6.9, 0.05])).toBe(true) // resorte
    expect(isTongPart([0.3, 4.6, 0.2])).toBe(false) // cuñas sobre el piso
    expect(isTongPart([1.1, 4.55, -0.9])).toBe(false) // poste de retención
    expect(isTongPart([-0.1, 9, -0.75])).toBe(false) // cable del poste
  })
  it('splitIndex reparte los triángulos por centroide sin perder ninguno', () => {
    const pos = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 5, 0, 1, 5, 0, 0, 6, 0]
    const { picked, rest } = splitIndex(pos, [0, 1, 2, 3, 4, 5], (c) => c[1] > 3)
    expect(picked).toEqual([3, 4, 5])
    expect(rest).toEqual([0, 1, 2])
  })
})
