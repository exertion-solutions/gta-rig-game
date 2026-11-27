import { describe, expect, it } from 'vitest'
import { INTERACTABLES, TRAVERSAL } from '../../src/game/world/walkable'
import { standSpots } from '../reach'

// QA D-07: bomba, acumulador y manifold ahora tienen cajas medidas; ninguna debe tapar el alcance de una válvula.
describe('alcance de las 18 válvulas con las cajas de colisión nuevas', () => {
  it('hay 18 válvulas (12 del manifold, 6 del acumulador)', () => expect(INTERACTABLES).toHaveLength(18))
  for (const v of INTERACTABLES)
    it(`${v.id}: hay un lugar de pie libre desde donde E la opera a ella`, () => expect(standSpots(v).length).toBeGreaterThan(0))
  it('los equipos que se atravesaban ahora tienen caja', () => {
    const ids = TRAVERSAL.solids.map((s) => s.id)
    for (const id of ['bomba_cuerpo', 'acumulador_equipo0', 'manifold_patin', 'manifold_volante_M7']) expect(ids).toContain(id)
    expect(TRAVERSAL.replaces).toEqual(expect.arrayContaining(['sk575_bomba', 'sk575_acumulador', 'sk575_manifold']))
  })
})
