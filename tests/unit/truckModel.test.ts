// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type * as THREE from 'three'
import { approach, buildTruckModel, driveCommand, headlightsOn, inclinationDeg, leanTarget, steerLimit, tiltTimer, TRUCK } from '../../src/game/vehicle/truckModel'

function countTriangles(root: THREE.Object3D) {
  let n = 0
  root.traverse((o) => {
    const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined
    if (g) n += (g.index ? g.index.count : g.attributes.position.count) / 3
  })
  return n
}

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
  it('steerLimit: giro máximo parado y mucho menor a velocidad (anti-vuelco)', () => {
    expect(steerLimit(0)).toBeCloseTo(TRUCK.maxSteer, 6)
    expect(steerLimit(12)).toBeLessThan(steerLimit(0) / 2)
    expect(steerLimit(-12)).toBeCloseTo(steerLimit(12), 6)
  })
  it('driveCommand: la fuerza del motor decae al acercarse al tope pero no se anula antes', () => {
    const low = driveCommand({ throttle: 1, steer: 0, brake: false }, 1).engine
    const high = driveCommand({ throttle: 1, steer: 0, brake: false }, 11).engine
    expect(high).toBeGreaterThan(0)
    expect(high).toBeLessThan(low)
  })
  it('leanTarget: frenar baja la trompa, acelerar la sube; en curva a la izquierda se inclina hacia la derecha', () => {
    expect(leanTarget(-6, 0).pitch).toBeLessThan(0)
    expect(leanTarget(4, 0).pitch).toBeGreaterThan(0)
    expect(leanTarget(0, 5).roll).toBeLessThan(0)
    expect(leanTarget(0, -5).roll).toBeGreaterThan(0)
    const big = leanTarget(-1000, 1000)
    expect(Math.abs(big.pitch)).toBeLessThanOrEqual(TRUCK.maxPitch)
    expect(Math.abs(big.roll)).toBeLessThanOrEqual(TRUCK.maxRoll)
  })
  it('approach: avanza hacia el objetivo sin pasarse', () => {
    expect(approach(0, 1, 0.1)).toBeCloseTo(0.1, 6)
    expect(approach(0.95, 1, 0.1)).toBe(1)
    expect(approach(0, -1, 0.3)).toBeCloseTo(-0.3, 6)
  })
  it('headlightsOn: encendidas de noche y al anochecer, apagadas de día', () => {
    expect(headlightsOn(12)).toBe(false)
    expect(headlightsOn(20)).toBe(true)
    expect(headlightsOn(2)).toBe(true)
    expect(headlightsOn(6.2)).toBe(true)
    expect(headlightsOn(8)).toBe(false)
  })
  it('modelo: luces, carrocería y ruedas con llanta expuestos; sin texto ni logos', () => {
    const m = buildTruckModel()
    expect(m.body.children.length).toBeGreaterThan(5)
    expect(m.headlights.length).toBe(2)
    expect(m.taillights.length).toBe(2)
    m.group.traverse((o) => expect((o as any).isSprite).toBeFalsy())
  })
})
