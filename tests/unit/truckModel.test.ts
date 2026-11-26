// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildTruckModel, countTriangles, driveCommand, inclinationDeg, tiltTimer, TRUCK } from '../../src/game/vehicle/truckModel'

const qx = (a: number) => ({ x: Math.sin(a / 2), y: 0, z: 0, w: Math.cos(a / 2) })

describe('truckModel', () => {
  it('modelo procedural low-poly: <8k triángulos y 4 ruedas', () => {
    const m = buildTruckModel()
    expect(countTriangles(m.group)).toBeLessThan(8000)
    expect(m.wheels).toHaveLength(4)
  })
  it('inclinationDeg: 0 en el plano, 90 de costado, 180 volcada', () => {
    expect(inclinationDeg({ x: 0, y: 0, z: 0, w: 1 })).toBeCloseTo(0, 6)
    expect(inclinationDeg(qx(Math.PI / 2))).toBeCloseTo(90, 4)
    expect(inclinationDeg(qx(Math.PI))).toBeCloseTo(180, 4)
  })
  it('tiltTimer cuenta solo con >60° y se reinicia al enderezarse', () => {
    let t = 0
    for (let i = 0; i < 100; i++) t = tiltTimer(t, 70, 1 / 60)
    expect(t).toBeCloseTo(100 / 60, 6)
    expect(tiltTimer(t, 59, 1 / 60)).toBe(0)
    expect(TRUCK.tiltLimitDeg).toBe(60)
    expect(TRUCK.tiltSeconds).toBe(3)
  })
  it('driveCommand: acelera hasta maxSpeed (12 m/s) y ahí corta la fuerza', () => {
    expect(TRUCK.maxSpeed).toBe(12)
    expect(driveCommand({ throttle: 1, steer: 0, brake: false }, 5).engine).toBeGreaterThan(0)
    expect(driveCommand({ throttle: 1, steer: 0, brake: false }, 12).engine).toBe(0)
    expect(driveCommand({ throttle: -1, steer: 0, brake: false }, -TRUCK.maxReverse).engine).toBe(0)
  })
  it('driveCommand: sin acelerar frena; el giro se reduce con la velocidad', () => {
    expect(driveCommand({ throttle: 0, steer: 0, brake: false }, 3).brake).toBeGreaterThan(0)
    const slow = Math.abs(driveCommand({ throttle: 1, steer: 1, brake: false }, 1).steer)
    const fast = Math.abs(driveCommand({ throttle: 1, steer: 1, brake: false }, 12).steer)
    expect(fast).toBeLessThan(slow)
  })
})
