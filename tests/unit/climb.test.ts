import { describe, expect, it } from 'vitest'
import { CLIMB_SPEED, WALK_ON_REACH, climbStep, ladderEndNear, ladderFeet, ladderLength, ladderRelease } from '../../src/game/player/climb'
import { LADDERS } from '../../src/game/world/walkable'

describe('climbStep', () => {
  const L = 10
  it('input +1 avanza CLIMB_SPEED·dt/largo', () => expect(climbStep(0.5, 1, 1, L)).toBeCloseTo(0.5 + CLIMB_SPEED / L))
  it('input −1 retrocede', () => expect(climbStep(0.5, -1, 1, L)).toBeCloseTo(0.5 - CLIMB_SPEED / L))
  it('se acota a [0, 1]', () => {
    expect(climbStep(0.99, 1, 10, L)).toBe(1)
    expect(climbStep(0.01, -1, 10, L)).toBe(0)
  })
  it('input 0 no se mueve', () => expect(climbStep(0.37, 0, 1, L)).toBe(0.37))
})

describe('escalera A3 (mastil_escalera)', () => {
  const l = LADDERS.find((x) => x.id === 'mastil_escalera')!
  it('existe y su largo es la distancia medida entre extremos', () => {
    expect(ladderLength(l)).toBeCloseTo(Math.hypot(l.top[0] - l.bottom[0], l.top[1] - l.bottom[1], l.top[2] - l.bottom[2]))
  })
  it('los pies siguen la línea de la escalera (y = bottom..top)', () => {
    expect(ladderFeet(l, 0)[1]).toBeCloseTo(l.bottom[1])
    expect(ladderFeet(l, 1)[1]).toBeCloseTo(l.top[1])
  })
  it('se suelta arriba sobre el piso de enganche (fuera de la banda 9 del mástil) y abajo sobre el piso de trabajo', () => {
    const top = ladderRelease(l, 'top')
    expect(top[1]).toBeCloseTo(l.top[1])
    expect(top[0]).toBeGreaterThan(0.061 + 0.35) // cara +X de sk575_mastil_banda9 + radio de la cápsula
    expect(top[0]).toBeLessThan(1.82 - 0.35) // borde +X de la plancha
    expect(ladderRelease(l, 'bottom')[1]).toBeCloseTo(l.bottom[1])
  })
  it('engancha solo cerca de un extremo y a su altura', () => {
    expect(ladderEndNear(ladderRelease(l, 'bottom'), [l])?.end).toBe('bottom')
    expect(ladderEndNear(ladderRelease(l, 'top'), [l])?.end).toBe('top')
    const b = ladderRelease(l, 'bottom')
    expect(ladderEndNear([b[0], 0, b[2]], [l])).toBeNull() // en el suelo, debajo del piso
    expect(ladderEndNear([b[0] + 3, b[1], b[2]], [l])).toBeNull()
    expect(ladderEndNear([b[0] + 0.65, b[1], b[2]], [l])?.end).toBe('bottom') // al alcance de E
    expect(ladderEndNear([b[0] + 0.65, b[1], b[2]], [l], WALK_ON_REACH)).toBeNull() // pero W no la toma
  })
})
