import { describe, expect, it } from 'vitest'
import { LAND_MS, nextLandUntil, pickClip } from '../../src/game/player/characterAnim'
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
  it("aterrizando => land; en el aire gana 'jump'", () => {
    expect(pickClip(0, 'foot', { landing: true })).toBe('land')
    expect(pickClip(0, 'foot', { airborne: true, landing: true })).toBe('jump')
  })
  it('vuelo largo (2 s): jump todo el vuelo, land solo al tocar el suelo y por LAND_MS', () => {
    let was = false
    let until = 0
    const clipAt = (now: number, airborne: boolean) => {
      until = nextLandUntil(was, airborne, now, until)
      was = airborne
      return pickClip(0, 'foot', { airborne, landing: now < until })
    }
    for (let t = 0; t < 2000; t += 16) expect(clipAt(t, true)).toBe('jump')
    expect(clipAt(2000, false)).toBe('land')
    expect(clipAt(2000 + LAND_MS - 1, false)).toBe('land')
    expect(clipAt(2000 + LAND_MS, false)).toBe('idle')
  })
})
