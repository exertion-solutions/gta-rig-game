import { describe, expect, it } from 'vitest'
import { pickClip } from '../../src/game/player/characterAnim'
import { RUN_SPEED, WALK_SPEED } from '../../src/game/player/movement'

describe('pickClip', () => {
  it('quieto => idle', () => expect(pickClip(0, 'foot')).toBe('idle'))
  it('casi quieto (ruido del controlador) => idle', () => expect(pickClip(0.1, 'foot')).toBe('idle'))
  it('WALK_SPEED => walk', () => expect(pickClip(WALK_SPEED, 'foot')).toBe('walk'))
  it('RUN_SPEED => run', () => expect(pickClip(RUN_SPEED, 'foot')).toBe('run'))
  it('umbral walk/run entre WALK_SPEED y RUN_SPEED', () => {
    const mid = (WALK_SPEED + RUN_SPEED) / 2
    expect(pickClip(mid - 0.01, 'foot')).toBe('walk')
    expect(pickClip(mid + 0.01, 'foot')).toBe('run')
  })
  // Sin clip sentado: en la camioneta el personaje se oculta y queda en idle.
  it("modo 'truck' => idle (no hay clip 'seated')", () => expect(pickClip(RUN_SPEED, 'truck')).toBe('idle'))
  it('trepando => climb (gana a todo a pie)', () => expect(pickClip(0, 'foot', { climbing: true, airborne: true })).toBe('climb'))
  it('operando una valvula => operate', () => expect(pickClip(WALK_SPEED, 'foot', { operating: true })).toBe('operate'))
  it('en el aire tras saltar => jump', () => expect(pickClip(RUN_SPEED, 'foot', { airborne: true })).toBe('jump'))
  it('en la camioneta sigue idle aunque haya accion', () => expect(pickClip(0, 'truck', { climbing: true })).toBe('idle'))
})
