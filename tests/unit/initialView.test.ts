import { describe, expect, it } from 'vitest'
import { getSectors } from '../../src/game/data/sectors'
import { RESPAWN } from '../../src/game/player/movement'
import { INITIAL_PITCH, INITIAL_YAW, TRUCK_SPAWN, TRUCK_SPAWN_HEADING, usePlayerStore } from '../../src/game/player/store'

// QA B P0-2: el primer cuadro miraba hacia el borde del mundo (yaw 0 = -Z) con el equipo a la espalda.
const forward = (yaw: number) => [-Math.sin(yaw), -Math.cos(yaw)]
describe('encuadre inicial desde el Acceso', () => {
  const rig = getSectors().filter((s) => s.position && s.objectIds.length)
  const c = [rig.reduce((a, s) => a + s.position![0], 0) / rig.length, rig.reduce((a, s) => a + s.position![2], 0) / rig.length]
  it('el jugador arranca mirando al centro de los sectores con equipo', () => {
    const [fx, fz] = forward(usePlayerStore.getState().yaw)
    const d = [c[0] - RESPAWN[0], c[1] - RESPAWN[2]]
    const L = Math.hypot(d[0], d[1])
    expect((fx * d[0] + fz * d[1]) / L).toBeGreaterThan(0.999)
    expect(usePlayerStore.getState().yaw).toBe(INITIAL_YAW)
    expect(usePlayerStore.getState().pitch).toBe(INITIAL_PITCH)
  })
  it('la camioneta no tapa el equipo: queda al costado, mirando también al equipo', () => {
    const [fx, fz] = forward(INITIAL_YAW)
    const t = [TRUCK_SPAWN[0] - RESPAWN[0], TRUCK_SPAWN[2] - RESPAWN[2]]
    expect(Math.abs(fx * t[0] + fz * t[1])).toBeLessThan(0.01) // ni delante ni detrás: al costado
    expect(TRUCK_SPAWN_HEADING).toBe(INITIAL_YAW)
  })
})
