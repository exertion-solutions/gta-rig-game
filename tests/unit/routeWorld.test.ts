// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { LIGHTS_S, ROAD_HALF, inLocacion, nearest, zoneAt } from '../../src/game/world/route'
import { ANIMALS, BUILDINGS, KIT, LIGHT_CYCLE, OBSTACLES, PLANTS, VEHICLES, animalAt, lightPost, lightState, vehicleAt } from '../../src/game/world/routeWorld'

describe('lo que puebla la ruta', () => {
  it('ningún edificio pisa la calzada ni las bocacalles', () => {
    expect(BUILDINGS.length).toBeGreaterThan(80)
    for (const b of BUILDINGS) expect(KIT[b.model!], `modelo ${b.model}`).toBeDefined() // todos salen del kit
    expect(new Set(BUILDINGS.map((b) => b.model)).size).toBeGreaterThan(30)
    for (const b of BUILDINGS) {
      const n = nearest(b.x, b.z)
      expect(n.d - b.d / 2, `edificio en s ${n.s.toFixed(0)}`).toBeGreaterThan(ROAD_HALF + 2)
    }
  })
  it('semáforos: ciclo verde, amarillo, rojo; desfasados; poste fuera de la calzada', () => {
    const seq = Array.from({ length: 24 }, (_, t) => lightState(0, t))
    expect(seq.filter((s) => s === 'green')).toHaveLength(LIGHT_CYCLE.green)
    expect(seq.filter((s) => s === 'yellow')).toHaveLength(LIGHT_CYCLE.yellow)
    expect(seq.filter((s) => s === 'red')).toHaveLength(LIGHT_CYCLE.red)
    expect(lightState(0, 24)).toBe(lightState(0, 0))
    expect(LIGHTS_S.map((_, i) => lightState(i, 0)).join()).not.toBe('green,green,green')
    LIGHTS_S.forEach((_, i) => expect(nearest(lightPost(i).x, lightPost(i).z).d).toBeGreaterThan(ROAD_HALF))
  })
  it('árboles: álamos en las chacras y arbustos en la estepa, todos fuera de la calzada', () => {
    expect(PLANTS.filter((p) => p.kind === 'alamo' && zoneAt(p.s) === 'chacras').length).toBeGreaterThan(200)
    expect(PLANTS.filter((p) => p.kind === 'arbusto').length).toBeGreaterThan(800)
    for (const p of PLANTS) expect(nearest(p.x, p.z).d).toBeGreaterThan(ROAD_HALF + 1)
  })
  it('obstáculos: rocas en bardas y sierra, obra en la ciudad, guardaganados; siempre queda paso', () => {
    const kinds = new Set(OBSTACLES.map((o) => o.kind))
    expect([...kinds].sort()).toEqual(['cono', 'guardaganado', 'roca', 'valla'])
    for (const o of OBSTACLES.filter((x) => x.kind === 'roca')) {
      expect(['bardas', 'sierra']).toContain(zoneAt(o.s))
      const n = nearest(o.x, o.z)
      expect(ROAD_HALF * 2 - (o.r * 2), 'queda más de un carril libre').toBeGreaterThan(4)
      expect(n.d).toBeLessThan(ROAD_HALF)
    }
  })
  it('tránsito: cada vehículo va por su mano (derecha), en los dos sentidos, y nunca entra a la locación', () => {
    expect(VEHICLES.some((v) => v.kind === 'camion')).toBe(true)
    expect(VEHICLES.some((v) => v.model === 'cisterna')).toBe(true)
    for (const v of VEHICLES) expect(v.len / v.scale, v.model).toBeLessThan(3.5) // la caja de colisión no excede al modelo
    expect(VEHICLES.some((v) => v.dir === 1) && VEHICLES.some((v) => v.dir === -1)).toBe(true)
    for (const v of VEHICLES)
      for (const t of [0, 77, 500, 2345]) {
        const p = vehicleAt(v, t)
        const n = nearest(p.x, p.z)
        expect(n.d).toBeCloseTo(2.25, 1)
        expect(n.side).toBe(v.dir) // mismo sentido que el jugador: a la derecha del eje; de frente: a la izquierda
        expect(inLocacion(p.x, p.z, 300)).toBe(false)
      }
  })
  it('animales: tropillas de guanacos, ovejas y caballos; los que cruzan pasan por la calzada y vuelven', () => {
    expect(new Set(ANIMALS.map((a) => a.kind)).size).toBe(3)
    const crosser = ANIMALS.find((a) => a.cross)!
    const ds = Array.from({ length: 120 }, (_, t) => animalAt(crosser, t).side)
    expect(Math.min(...ds)).toBeLessThan(-ROAD_HALF)
    expect(Math.max(...ds)).toBeGreaterThan(ROAD_HALF)
    const still = ANIMALS.find((a) => !a.cross)!
    expect(animalAt(still, 0).x).toBe(animalAt(still, 50).x)
  })
})
