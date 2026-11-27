// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { LOCACION_BOUNDS } from '../../src/game/world/frame'
import { RESPAWN, RUN_SPEED, STEP_MAX, WALK_SPEED, atLimit, clampToBounds, needsRespawn, respawnPoint, stepMovement, trackSafe } from '../../src/game/player/movement'

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

  it('needsRespawn: solo por debajo del suelo (y < -5) o fuera del vallado; el piso de enganche (20,65) no reubica', () => {
    expect(needsRespawn([0, 20.651, 0], LOCACION_BOUNDS)).toBe(false)
    expect(needsRespawn([0, 6, 0], LOCACION_BOUNDS)).toBe(false)
    expect(needsRespawn([0, -6, 0], LOCACION_BOUNDS)).toBe(true)
    expect(needsRespawn([40, 0, 0], LOCACION_BOUNDS)).toBe(true)
    expect(needsRespawn([0, 1, 0], LOCACION_BOUNDS)).toBe(false)
    expect(needsRespawn(RESPAWN, LOCACION_BOUNDS)).toBe(false)
  })

  it('ultimo punto firme: se actualiza solo de pie y dentro del vallado; la reubicacion vuelve ahi', () => {
    let safe = RESPAWN
    safe = trackSafe(safe, [1, 3.606, 0], true, LOCACION_BOUNDS)
    expect(safe).toEqual([1, 3.606, 0])
    safe = trackSafe(safe, [1, 2, 0], false, LOCACION_BOUNDS) // en el aire: no cambia
    expect(safe).toEqual([1, 3.606, 0])
    safe = trackSafe(safe, [40, 0, 0], true, LOCACION_BOUNDS) // fuera del vallado: no cambia
    expect(safe).toEqual([1, 3.606, 0])
    expect(respawnPoint([0, -6, 0], safe, LOCACION_BOUNDS)).toEqual([1, 3.606, 0])
    expect(respawnPoint([0, 20.651, 0], safe, LOCACION_BOUNDS)).toBeNull()
  })

  it('STEP_MAX (autostep): cubre las contrahuellas medidas (0,26 y 0,175 m); la pasarela (1,05) no', () => {
    expect(STEP_MAX).toBeGreaterThanOrEqual(0.26)
    expect(0.175).toBeLessThanOrEqual(STEP_MAX)
    expect(1.05).toBeGreaterThan(STEP_MAX)
  })
})

describe('atLimit (aviso del vallado, QA D-11)', () => {
  const B = { minX: -45, maxX: 33.5, minZ: -30.5, maxZ: 30.5 }
  it('cerca de cualquier lado sí, adentro no', () => {
    expect(atLimit([33.1, 0, 0], 0.4, B)).toBe(true)
    expect(atLimit([0, 0, -30.2], 0.4, B)).toBe(true)
    expect(atLimit([-44.7, 0, 5], 0.4, B)).toBe(true)
    expect(atLimit([32.9, 0, 0], 0.4, B)).toBe(false)
    expect(atLimit([0, 0, 0], 0.4, B)).toBe(false)
  })
})

import { ACCEL, approachVelocity } from '../../src/game/player/movement'
describe('approachVelocity', () => {
  it('no llega al objetivo en un paso: acelera de a ACCEL*dt', () => {
    const r = approachVelocity({ vx: 0, vz: 0 }, { vx: 0, vz: -4.5 }, 1 / 60, true)
    expect(Math.hypot(r.vx, r.vz)).toBeCloseTo(ACCEL.ground / 60)
  })
  it('llega y no se pasa del objetivo', () => {
    expect(approachVelocity({ vx: 4.4, vz: 0 }, { vx: 4.5, vz: 0 }, 1 / 60, true)).toEqual({ vx: 4.5, vz: 0 })
  })
  it('en el aire cambia más lento que en el suelo', () => {
    const g = approachVelocity({ vx: 0, vz: 0 }, { vx: 4.5, vz: 0 }, 1 / 60, true).vx
    const a = approachVelocity({ vx: 0, vz: 0 }, { vx: 4.5, vz: 0 }, 1 / 60, false).vx
    expect(a).toBeLessThan(g)
  })
  it('frena hasta 0 sin pasarse', () => {
    let v = { vx: 4.5, vz: 0 }
    for (let i = 0; i < 30; i++) v = approachVelocity(v, { vx: 0, vz: 0 }, 1 / 60, true)
    expect(v).toEqual({ vx: 0, vz: 0 })
  })
})
