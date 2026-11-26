import { describe, expect, it } from 'vitest'
import { projectToRadar } from '../../src/ui/radarProjection'

const C: [number, number, number] = [10, 0, 20]
const SIZE = 200

describe('projectToRadar', () => {
  it('centra al jugador en (size/2, size/2)', () => {
    const p = projectToRadar(C, C, 0, 40, SIZE)
    expect(p.x).toBeCloseTo(100)
    expect(p.y).toBeCloseTo(100)
    expect(p.inside).toBe(true)
  })

  it('con yaw 0 el frente (-Z) queda arriba y +X a la derecha', () => {
    const fwd = projectToRadar([10, 0, 10], C, 0, 40, SIZE)
    expect(fwd.x).toBeCloseTo(100)
    expect(fwd.y).toBeLessThan(100)
    const right = projectToRadar([20, 0, 20], C, 0, 40, SIZE)
    expect(right.x).toBeGreaterThan(100)
    expect(right.y).toBeCloseTo(100)
  })

  it('un punto fuera de rangeM tiene inside=false y queda en el borde', () => {
    const p = projectToRadar([10 + 400, 0, 20], C, 0, 40, SIZE)
    expect(p.inside).toBe(false)
    expect(Math.hypot(p.x - 100, p.y - 100)).toBeCloseTo(100, 5) // radio del radar = size/2
    expect(p.x).toBeGreaterThan(100)
  })

  it('el yaw rota el radar: con yaw=90° lo que está al -X queda arriba', () => {
    const p = projectToRadar([0, 0, 20], C, Math.PI / 2, 40, SIZE)
    expect(p.x).toBeCloseTo(100)
    expect(p.y).toBeLessThan(100)
  })
})
