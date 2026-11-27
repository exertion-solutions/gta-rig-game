import { describe, expect, it } from 'vitest'
import { INTERACT_REACH, nearestInteractable, nextValveState } from '../../src/game/world/interactables'
import type { Interactable } from '../../src/game/world/walkable'

const v = (id: string, x: number, y = 1, z = 0): Interactable => ({ id, kind: 'valve', partId: 'p', position: [x, y, z], label: id, sourceId: 'glb:x' })

describe('nearestInteractable', () => {
  it('alcance de juego 1,5 m', () => expect(INTERACT_REACH).toBe(1.5))
  it('devuelve la más cercana dentro del alcance', () => {
    expect(nearestInteractable([0, 1, 0], [v('a', 1.2), v('b', 0.6), v('c', -1)])?.id).toBe('b')
  })
  it('null fuera de alcance', () => expect(nearestInteractable([0, 1, 0], [v('a', 1.6), v('b', -3)])).toBeNull())
  it('no elige la que queda tapada detrás de otra más cercana (alineadas)', () => {
    expect(nearestInteractable([0, 1, 0], [v('atras', 1.4), v('adelante', 0.7)])?.id).toBe('adelante')
  })
  it('respeta un alcance distinto', () => expect(nearestInteractable([0, 1, 0], [v('a', 1.2)], 1)).toBeNull())
  it('mide en 3D (una válvula arriba de la cabeza no está al alcance)', () =>
    expect(nearestInteractable([0, 1, 0], [v('a', 0.2, 3)])).toBeNull())
})

describe('nextValveState: alterna; sin registro previo la primera operación registra abierta (convención de juego)', () => {
  it('sin estado -> open', () => expect(nextValveState(undefined)).toBe('open'))
  it('open -> closed -> open', () => {
    expect(nextValveState('open')).toBe('closed')
    expect(nextValveState('closed')).toBe('open')
  })
})
