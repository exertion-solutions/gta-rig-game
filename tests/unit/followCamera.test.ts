// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { clampPitch, computeCameraTarget, PITCH_MAX, PITCH_MIN, resolveCameraCollision, smoothStep } from '../../src/game/camera/followCamera'
import type { Vec3 } from '../../src/game/player/movement'

const close = (a: Vec3, b: Vec3, tol = 1e-6) => a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThan(tol))

describe('followCamera', () => {
  it('computeCameraTarget con yaw 0 queda detrás del objetivo a distance', () => {
    close(computeCameraTarget([1, 2, 3], 0, 0, 5), [1, 2, 8]) // yaw 0 mira a -Z => detrás es +Z
    close(computeCameraTarget([0, 0, 0], Math.PI / 2, 0, 4), [4, 0, 0]) // yaw 90° mira a -X => detrás es +X
  })

  it('computeCameraTarget con pitch sube la cámara y conserva la distancia', () => {
    const p = computeCameraTarget([0, 1, 0], 0.7, 0.5, 6)
    expect(p[1]).toBeGreaterThan(1)
    expect(Math.hypot(p[0], p[1] - 1, p[2])).toBeCloseTo(6, 6)
  })

  it('resolveCameraCollision acerca la cámara al punto de choque menos margin', () => {
    const r = resolveCameraCollision([0, 0, 0], [0, 0, 10], () => 4, 0.3)
    close(r, [0, 0, 3.7])
  })

  it('resolveCameraCollision pasa origen y dirección unitaria a hit', () => {
    let seen: [Vec3, Vec3] | null = null
    resolveCameraCollision([1, 1, 1], [1, 1, 11], (o, d) => ((seen = [o, d]), null), 0.3)
    expect(seen).toEqual([[1, 1, 1], [0, 0, 1]])
  })

  it('resolveCameraCollision sin choque devuelve desired', () => {
    expect(resolveCameraCollision([0, 0, 0], [0, 0, 10], () => null, 0.3)).toEqual([0, 0, 10])
    expect(resolveCameraCollision([0, 0, 0], [0, 0, 10], () => 25, 0.3)).toEqual([0, 0, 10]) // choque más allá de desired
  })

  it('resolveCameraCollision nunca pasa del origen (choque pegado)', () => {
    close(resolveCameraCollision([0, 0, 0], [0, 0, 10], () => 0.1, 0.3), [0, 0, 0])
  })

  it('clampPitch limita el pitch al rango permitido', () => {
    expect(clampPitch(99)).toBe(PITCH_MAX)
    expect(clampPitch(-99)).toBe(PITCH_MIN)
    expect(clampPitch(0.2)).toBe(0.2)
  })

  it('smoothStep es independiente de los fps: mismo tiempo simulado => mismo punto', () => {
    const run = (fps: number, seconds: number) => {
      let p: Vec3 = [0, 0, 0]
      for (let i = 0; i < fps * seconds; i++) p = smoothStep(p, [10, 5, -3], 8, 1 / fps)
      return p
    }
    const ref = run(60, 0.5)
    for (const fps of [30, 120, 144, 240]) close(run(fps, 0.5), ref, 1e-6)
    expect(ref[0]).toBeGreaterThan(0)
    expect(ref[0]).toBeLessThan(10) // sigue en camino, no llegó
    close(run(60, 3), [10, 5, -3], 1e-3) // converge
  })
})
