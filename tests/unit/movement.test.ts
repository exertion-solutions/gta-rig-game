// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { LOCACION_BOUNDS } from '../../src/game/world/frame'
import { RESPAWN, RUN_SPEED, WALK_SPEED, clampToBounds, needsRespawn, stepMovement } from '../../src/game/player/movement'

describe('movement', () => {
  it('stepMovement sin input devuelve 0', () => {
    expect(stepMovement({ x: 0, z: 0, run: true }, 1.2, 0.016)).toEqual({ vx: 0, vz: 0 })
  })

  it('stepMovement diagonal no supera RUN_SPEED (ni WALK_SPEED caminando)', () => {
    for (const yaw of [0, 0.7, Math.PI]) {
      const r = stepMovement({ x: 1, z: 1, run: true }, yaw, 0.016)
      expect(Math.hypot(r.vx, r.vz)).toBeLessThanOrEqual(RUN_SPEED + 1e-9)
      const w = stepMovement({ x: 1, z: 1, run: false }, yaw, 0.016)
      expect(Math.hypot(w.vx, w.vz)).toBeCloseTo(WALK_SPEED, 9)
    }
  })

  it('stepMovement: yaw 0 avanza hacia -Z', () => {
    const r = stepMovement({ x: 0, z: 1, run: false }, 0, 0.016)
    expect(r.vx).toBeCloseTo(0, 9)
    expect(r.vz).toBeCloseTo(-WALK_SPEED, 9)
  })

  it('signos: strafe derecha con yaw 0 => vx>0; avance con yaw pi/2 => vx<0', () => {
    expect(stepMovement({ x: 1, z: 0, run: false }, 0, 0.016).vx).toBeGreaterThan(0)
    expect(stepMovement({ x: 0, z: 1, run: false }, Math.PI / 2, 0.016).vx).toBeLessThan(0)
  })

  it('distancia por segundo de reloj no depende de los fps (paso fijo 1/60 con acumulador, como Rapier)', () => {
    const FIXED = 1 / 60
    const dist = (fps: number) => {
      let acc = 0
      let x = 0
      for (let f = 0; f < fps * 2; f++) {
        acc += 1 / fps
        while (acc >= FIXED - 1e-9) {
          x += -stepMovement({ x: 0, z: 1, run: true }, Math.PI / 2, FIXED).vx * FIXED
          acc -= FIXED
        }
      }
      return x
    }
    for (const fps of [30, 60, 144]) expect(dist(fps)).toBeCloseTo(RUN_SPEED * 2, 1)
  })

  it('clampToBounds reubica un punto fuera del vallado al borde', () => {
    expect(clampToBounds([-100, 1, 50], LOCACION_BOUNDS)).toEqual([-45, 1, 30.5])
    expect(clampToBounds([100, 1, -50], LOCACION_BOUNDS)).toEqual([33.5, 1, -30.5])
    expect(clampToBounds([0, 1, 0], LOCACION_BOUNDS)).toEqual([0, 1, 0])
  })

  it('needsRespawn: |y| > 5 o fuera del vallado; RESPAWN queda dentro', () => {
    expect(needsRespawn([0, 6, 0], LOCACION_BOUNDS)).toBe(true)
    expect(needsRespawn([0, -6, 0], LOCACION_BOUNDS)).toBe(true)
    expect(needsRespawn([40, 0, 0], LOCACION_BOUNDS)).toBe(true)
    expect(needsRespawn([0, 1, 0], LOCACION_BOUNDS)).toBe(false)
    expect(needsRespawn(RESPAWN, LOCACION_BOUNDS)).toBe(false)
  })
})
