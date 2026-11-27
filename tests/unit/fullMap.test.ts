// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { getSectors } from '../../src/game/data/sectors'
import { LOCACION_BOUNDS } from '../../src/game/world/frame'
import { escapeAction } from '../../src/ui/hudStore'
import { mapPoint, mappableSectors } from '../../src/ui/fullMapProjection'

const closed = { panelOpen: false, pauseOpen: false, mapOpen: false, fichaOpen: false }

describe('mapPoint', () => {
  const b = { minX: -10, maxX: 30, minZ: -20, maxZ: 20 }
  it('esquinas y centro', () => {
    expect(mapPoint([-10, 0, -20], b)).toEqual({ x: 0, y: 0 })
    expect(mapPoint([30, 0, 20], b)).toEqual({ x: 1, y: 1 })
    expect(mapPoint([10, 5, 0], b)).toEqual({ x: 0.5, y: 0.5 })
  })
  it('un punto fuera del cuadro se acota al borde', () => {
    expect(mapPoint([99, 0, -99], b)).toEqual({ x: 1, y: 0 })
  })
})

describe('mappableSectors', () => {
  it('descarta los sectores sin posición documentada', () => {
    const all = getSectors()
    const m = mappableSectors(all)
    expect(m.every((s) => s.position !== null)).toBe(true)
    expect(m.length).toBe(all.filter((s) => s.position).length)
  })
  it('todo sector dibujado cae dentro de la locación', () => {
    for (const s of mappableSectors(getSectors())) {
      const p = mapPoint(s.position, LOCACION_BOUNDS)
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(1)
    }
  })
})

describe('escapeAction', () => {
  it('sin nada abierto abre la pausa; con la pausa abierta la cierra', () => {
    expect(escapeAction(closed)).toBe('open-pause')
    expect(escapeAction({ ...closed, pauseOpen: true })).toBe('close-pause')
  })
  it('cierra primero lo más interno: pausa, mapa, misiones, ficha', () => {
    expect(escapeAction({ ...closed, mapOpen: true })).toBe('close-map')
    expect(escapeAction({ ...closed, panelOpen: true })).toBe('close-panel')
    expect(escapeAction({ ...closed, fichaOpen: true })).toBe('close-ficha')
    expect(escapeAction({ panelOpen: true, pauseOpen: true, mapOpen: true, fichaOpen: true })).toBe('close-pause')
  })
})
