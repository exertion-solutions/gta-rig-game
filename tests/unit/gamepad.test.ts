// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { mapGamepad, padEdges } from '../../src/game/input/gamepad'

const btn = (...on: number[]) => Array.from({ length: 16 }, (_, i) => ({ pressed: on.includes(i) }))
const pad = (axes: number[], buttons = btn()) => ({ axes, buttons })

describe('mapGamepad', () => {
  it('reposo: todo en cero y sin botones', () => {
    expect(mapGamepad(pad([0, 0, 0, 0]))).toEqual({ move: { x: 0, z: 0 }, look: { x: 0, y: 0 }, run: false, jump: false, interact: false })
  })
  it('la zona muerta (0,15 por defecto) anula el ruido del stick', () => {
    const r = mapGamepad(pad([0.1, -0.14, 0.12, 0.1]))
    expect(r.move).toEqual({ x: 0, z: 0 })
    expect(r.look).toEqual({ x: 0, y: 0 })
  })
  it('stick izquierdo mueve: adelante (eje y negativo) es z positivo', () => {
    const r = mapGamepad(pad([1, -1, 0, 0]))
    expect(r.move.x).toBeCloseTo(1)
    expect(r.move.z).toBeCloseTo(1)
  })
  it('sin salto brusco en el borde de la zona muerta (reescalado)', () => {
    expect(Math.abs(mapGamepad(pad([0.16, 0, 0, 0])).move.x)).toBeLessThan(0.05)
  })
  it('stick derecho mira', () => {
    const r = mapGamepad(pad([0, 0, -1, 1]))
    expect(r.look.x).toBeCloseTo(-1)
    expect(r.look.y).toBeCloseTo(1)
  })
  it('la zona muerta es parametrizable', () => {
    expect(mapGamepad(pad([0.3, 0, 0, 0]), 0.5).move.x).toBe(0)
  })
  it('botones: gatillo derecho corre, A salta, X interactúa', () => {
    expect(mapGamepad(pad([0, 0, 0, 0], btn(7))).run).toBe(true)
    expect(mapGamepad(pad([0, 0, 0, 0], btn(0))).jump).toBe(true)
    expect(mapGamepad(pad([0, 0, 0, 0], btn(2))).interact).toBe(true)
  })
  it('tolera un mando con menos ejes y botones', () => {
    expect(() => mapGamepad({ axes: [], buttons: [] })).not.toThrow()
    expect(mapGamepad({ axes: [], buttons: [] }).jump).toBe(false)
  })
})

describe('padEdges (flancos del mando)', () => {
  const raw = (jump: boolean, interact = false) => mapGamepad(pad([0, 0, 0, 0], btn(...(jump ? [0] : []), ...(interact ? [2] : []))))
  it('dispara solo al pasar de suelto a apretado; sostenido no repite', () => {
    expect(padEdges({ jump: false, interact: false }, raw(true, true))).toEqual({ jump: true, interact: true })
    expect(padEdges({ jump: true, interact: true }, raw(true, true))).toEqual({ jump: false, interact: false })
  })
  it('sin mando: sin flancos', () => expect(padEdges({ jump: false, interact: false }, null)).toEqual({ jump: false, interact: false }))
  it('A sostenida con un menú abierto: si prev sigue el mando crudo, al cerrar no es pulsación nueva', () => {
    const prev = { jump: raw(true).jump, interact: false } // paso con menú: se registra el crudo aunque no se dispare
    expect(padEdges(prev, raw(true)).jump).toBe(false)
  })
})
