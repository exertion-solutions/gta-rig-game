// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { LOCACION_BOUNDS as B } from '../../src/game/world/frame'
import { BASE, LIGHTS_S, ROAD_HALF, ROUTE_END_S, ROUTE_LENGTH, WORLD_BOUNDS, inLocacion, nearest, paved, pointAt, roadSpawn, roadY, terrainY, zoneAt } from '../../src/game/world/route'

describe('ruta base → equipo', () => {
  it('mide 20 km y llega al Acceso de la locación entrando hacia +Z', () => {
    expect(ROUTE_END_S).toBeGreaterThan(ROUTE_LENGTH * 0.995)
    expect(ROUTE_END_S).toBeLessThanOrEqual(ROUTE_LENGTH)
    const e = pointAt(ROUTE_END_S)
    expect(e.x).toBeCloseTo(-26, 0)
    expect(e.z).toBeLessThan(B.minZ)
    expect(e.z).toBeGreaterThan(B.minZ - 12)
    expect(e.tz).toBeGreaterThan(0.99)
    expect(roadY(ROUTE_END_S)).toBeCloseTo(0, 6)
  })
  it('la base queda a más de 10 km en línea recta y bien abajo de la meseta', () => {
    expect(Math.hypot(BASE.truck[0], BASE.truck[2])).toBeGreaterThan(10000)
    expect(BASE.y).toBeLessThan(-100)
    expect(inLocacion(BASE.player[0], BASE.player[2])).toBe(false)
  })
  it('pendiente máxima manejable (< 11 %) y sin escalones en el perfil', () => {
    let max = 0
    for (let s = 0; s < ROUTE_END_S; s += 5) max = Math.max(max, Math.abs(roadY(s + 5) - roadY(s)) / 5)
    expect(max).toBeLessThan(0.11)
    expect(max).toBeGreaterThan(0.04) // hay pendientes de verdad
  })
  it('curvas con radio manejable (> 50 m)', () => {
    let minR = Infinity
    for (let s = 60; s < ROUTE_END_S - 60; s += 10) {
      const a = pointAt(s - 30)
      const b = pointAt(s + 30)
      const turn = Math.acos(Math.min(1, a.tx * b.tx + a.tz * b.tz))
      if (turn > 1e-4) minR = Math.min(minR, 60 / turn)
    }
    expect(minR).toBeGreaterThan(50)
    expect(minR).toBeLessThan(400) // y hay curvas cerradas
  })
  it('nearest devuelve el s del eje y el lado', () => {
    for (const s of [100, 2000, 7777, 12345, 16000, 19500]) {
      const p = pointAt(s)
      const n = nearest(p.x - p.tz * 3, p.z + p.tx * 3) // 3 m a la derecha
      expect(n.s).toBeCloseTo(s, 0)
      expect(n.d).toBeCloseTo(3, 1)
      expect(n.side).toBe(1)
      expect(nearest(p.x + p.tz * 3, p.z - p.tx * 3).side).toBe(-1)
    }
  })
  it('tramos y superficie: asfalto en la base y la ciudad, ripio después; semáforos dentro de la ciudad', () => {
    expect(zoneAt(0)).toBe('base')
    expect(zoneAt(12000)).toBe('bardas')
    expect(zoneAt(19900)).toBe('llegada')
    expect(paved(2000)).toBe(true)
    expect(paved(8000)).toBe(false)
    for (const s of LIGHTS_S) expect(zoneAt(s)).toBe('ciudad')
  })
})

describe('terreno', () => {
  it('sobre la calzada coincide con el perfil del camino', () => {
    for (let s = 300; s < 18500; s += 137) {
      const p = pointAt(s)
      for (const k of [-ROAD_HALF + 0.3, 0, ROAD_HALF - 0.3]) expect(terrainY(p.x - p.tz * k, p.z + p.tx * k)).toBeCloseTo(roadY(s), 1)
    }
  })
  it('la locación es plana y el terreno queda apenas por debajo de su piso', () => {
    for (const [x, z] of [[0, 0], [B.minX, B.minZ], [B.maxX, B.maxZ], [-26, -24]]) expect(terrainY(x, z)).toBeCloseTo(-0.05, 6)
  })
  it('es continuo: sin saltos entre puntos vecinos, tampoco entre ramas de la sierra', () => {
    let worst = 0
    for (let s = 0; s < ROUTE_END_S; s += 97) {
      const p = pointAt(s)
      for (let k = -600; k <= 600; k += 13) {
        const [x, z] = [p.x - p.tz * k, p.z + p.tx * k]
        worst = Math.max(worst, Math.abs(terrainY(x + 1, z) - terrainY(x, z)), Math.abs(terrainY(x, z + 1) - terrainY(x, z)))
      }
    }
    expect(worst).toBeLessThan(15) // paredones de barda sí (un estrato sube 11 m en pocos metros); un salto entre ramas daría 30 m o más
  })
  it('hay bardas y cerros: a los costados del camino el terreno sube', () => {
    const rise = (s: number, k: number) => {
      const p = pointAt(s)
      return Math.max(terrainY(p.x - p.tz * k, p.z + p.tx * k), terrainY(p.x + p.tz * k, p.z - p.tx * k)) - roadY(s)
    }
    expect(rise(12000, 90)).toBeGreaterThan(15) // bardas
    expect(rise(16500, 400)).toBeGreaterThan(40) // sierra
    expect(Math.abs(rise(2000, 60))).toBeLessThan(6) // ciudad llana
  })
})

describe('límites y reubicación', () => {
  it('el mundo contiene la ruta entera y la locación', () => {
    for (let s = 0; s <= ROUTE_END_S; s += 50) {
      const p = pointAt(s)
      expect(p.x > WORLD_BOUNDS.minX + 500 && p.x < WORLD_BOUNDS.maxX - 500 && p.z > WORLD_BOUNDS.minZ + 500 && p.z < WORLD_BOUNDS.maxZ - 500).toBe(true)
    }
    expect(WORLD_BOUNDS.minX).toBeLessThan(B.minX)
    expect(WORLD_BOUNDS.maxZ).toBeGreaterThan(B.maxZ)
  })
  it('roadSpawn deja la camioneta sobre la calzada, en su carril y mirando hacia el equipo', () => {
    const p = pointAt(9000)
    const r = roadSpawn(p.x + 80, p.z - 40)
    const n = nearest(r.position[0], r.position[2])
    expect(n.d).toBeLessThan(ROAD_HALF)
    expect(n.side).toBe(1)
    expect(r.position[1]).toBeCloseTo(roadY(n.s), 1)
  })
})
