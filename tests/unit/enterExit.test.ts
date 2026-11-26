// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { canEnter, exitSpot, toggleMode } from '../../src/game/vehicle/enterExit'
import { teleportTo, usePlayerStore } from '../../src/game/player/store'
import type { Vec3 } from '../../src/game/player/movement'

const reset = (player: Vec3, truck: Vec3) =>
  usePlayerStore.setState({ mode: 'foot', position: player, teleportSeq: 0, truck: { position: truck, heading: 0 } })

describe('canEnter', () => {
  it('es true dentro del radio y false fuera', () => {
    expect(canEnter([0, 0, 0], [2, 0, 0])).toBe(true)
    expect(canEnter([0, 0, 0], [2.6, 0, 0])).toBe(false)
    expect(canEnter([0, 0, 0], [3, 0, 0], 3.5)).toBe(true) // radio configurable
  })
})

describe('exitSpot', () => {
  it('queda al costado izquierdo del conductor, a la altura del suelo', () => {
    // heading -90deg mira a +X; la izquierda es -Z
    const p = exitSpot([10, 0, 0], -Math.PI / 2)!
    expect(p[0]).toBeCloseTo(10, 6)
    expect(p[2]).toBeLessThan(-1.5)
    expect(p[1]).toBe(0)
  })
  it('usa otro costado si el primero está ocupado y null si todos lo están', () => {
    const left = exitSpot([0, 0, 0], 0)!
    const alt = exitSpot([0, 0, 0], 0, (p) => Math.hypot(p[0] - left[0], p[2] - left[2]) > 0.1)!
    expect(alt).not.toEqual(left)
    expect(exitSpot([0, 0, 0], 0, () => false)).toBeNull()
  })
})

describe('toggleMode (tecla E)', () => {
  beforeEach(() => reset([0, 0, 0], [1.5, 0, 0]))

  it('alterna foot -> truck -> foot', () => {
    expect(toggleMode()).toBe(true)
    expect(usePlayerStore.getState().mode).toBe('truck')
    expect(usePlayerStore.getState().position).toEqual([1.5, 0, 0]) // el jugador queda en la camioneta
    expect(toggleMode()).toBe(true)
    const s = usePlayerStore.getState()
    expect(s.mode).toBe('foot')
    expect(canEnter(s.position, s.truck.position, 0.5)).toBe(false) // bajó a un costado, no encima
    expect(canEnter(s.position, s.truck.position)).toBe(true)
  })

  it('no hace nada si la camioneta está lejos', () => {
    reset([0, 0, 0], [20, 0, 0])
    expect(toggleMode()).toBe(false)
    expect(usePlayerStore.getState().mode).toBe('foot')
  })

  it('no baja si no hay lugar libre', () => {
    toggleMode()
    expect(toggleMode(() => false)).toBe(false)
    expect(usePlayerStore.getState().mode).toBe('truck')
  })
})

describe('teleportTo', () => {
  it('cambia la posición e incrementa teleportSeq (la cámara reinicia su pivote)', () => {
    reset([0, 0, 0], [9, 0, 9])
    teleportTo([5, 0, 5])
    const s = usePlayerStore.getState()
    expect(s.position).toEqual([5, 0, 5])
    expect(s.teleportSeq).toBe(1)
  })
})
