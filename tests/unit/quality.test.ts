import { describe, expect, it } from 'vitest'
import { LOCACION_BOUNDS as B } from '../../src/game/world/frame'
import { RESPAWN } from '../../src/game/player/movement'
import { TRUCK_SPAWN } from '../../src/game/player/store'
import { QUALITY_PROFILE, createGovernor, parseQualityParam, pickQuality, type Quality } from '../../src/game/quality'
import { patchGroundShader } from '../../src/game/world/GroundMaterial'
import { CONES, BARRELS, FENCE } from '../../src/game/world/propsLayout'

describe('pickQuality', () => {
  it('es estable por debajo de 14 ms en cualquier nivel', () => {
    for (const q of ['high', 'medium', 'low'] as Quality[]) expect(pickQuality(13.9, q)).toBe(q)
  })
  it('baja un nivel si el promedio supera 20 ms; en low no baja más', () => {
    expect(pickQuality(20.1, 'high')).toBe('medium')
    expect(pickQuality(25, 'medium')).toBe('low')
    expect(pickQuality(80, 'low')).toBe('low')
  })
  it('no sube hasta 10 ms; con menos de 10 ms sube un nivel; en high no sube más', () => {
    expect(pickQuality(10, 'low')).toBe('low')
    expect(pickQuality(10.5, 'medium')).toBe('medium')
    expect(pickQuality(9.9, 'low')).toBe('medium')
    expect(pickQuality(9.9, 'medium')).toBe('high')
    expect(pickQuality(5, 'high')).toBe('high')
  })
  it('banda muerta 10..20 ms: no cambia en ninguna dirección', () => {
    for (let ms = 10; ms <= 20; ms += 0.5) for (const q of ['high', 'medium', 'low'] as Quality[]) expect(pickQuality(ms, q)).toBe(q)
  })
})

describe('createGovernor (ventana sostenida + sin oscilar)', () => {
  const feed = (g: ReturnType<typeof createGovernor>, ms: number, n: number) => {
    let last: Quality | null = null
    for (let i = 0; i < n; i++) last = g.push(ms) ?? last
    return last
  }
  it('un pico aislado no cambia el nivel; una ventana entera lenta sí', () => {
    const g = createGovernor('high', { window: 30, warmup: 0 })
    expect(feed(g, 10, 29)).toBeNull()
    expect(g.push(300)).toBeNull() // el pico (tope 250 ms) promedia 18 ms en 30 cuadros
    expect(feed(g, 25, 30)).toBe('medium')
    expect(g.quality).toBe('medium')
  })
  it('no oscila: si el costo depende del nivel (alta 24 ms, media 9 ms) baja una vez y se queda', () => {
    const g = createGovernor('high', { window: 20, warmup: 0 })
    const cost = (q: Quality) => (q === 'high' ? 24 : q === 'medium' ? 9 : 5)
    const changes: Quality[] = []
    for (let i = 0; i < 20 * 40; i++) {
      const n = g.push(cost(g.quality))
      if (n) changes.push(n)
    }
    expect(changes).toEqual(['medium'])
  })
  it('con valores pegados al umbral (19,8 / 20,2 alternados) no cambia ni baja de más', () => {
    const g = createGovernor('medium', { window: 10, warmup: 0 })
    const changes: Quality[] = []
    for (let i = 0; i < 400; i++) {
      const n = g.push(i % 2 ? 19.8 : 20.2)
      if (n) changes.push(n)
    }
    expect(changes).toEqual([]) // promedio 20,0: no supera 20
  })
  it('descarta el calentamiento (carga de shaders)', () => {
    const g = createGovernor('high', { window: 10, warmup: 20 })
    expect(feed(g, 500, 20)).toBeNull()
    expect(feed(g, 10, 10)).toBeNull()
  })
  it('set() fija el nivel a mano y deja de degradar solo', () => {
    const g = createGovernor('high', { window: 5, warmup: 0 })
    g.setAuto(false)
    expect(feed(g, 100, 50)).toBeNull()
  })
})

describe('parseQualityParam', () => {
  it('acepta high/medium/low (fijo) y auto; cualquier otra cosa = auto', () => {
    expect(parseQualityParam('?quality=low')).toEqual({ quality: 'low', auto: false })
    expect(parseQualityParam('?quality=high')).toEqual({ quality: 'high', auto: false })
    expect(parseQualityParam('?quality=auto')).toEqual({ quality: 'high', auto: true })
    expect(parseQualityParam('?quality=xx')).toEqual({ quality: 'high', auto: true })
    expect(parseQualityParam('')).toEqual({ quality: 'high', auto: true })
  })
})

describe('perfiles de calidad', () => {
  it('las posprocesos y la sombra grande solo en alta', () => {
    expect(QUALITY_PROFILE.high.post).toBe(true)
    expect(QUALITY_PROFILE.medium.post).toBe(false)
    expect(QUALITY_PROFILE.low.post).toBe(false)
    expect(QUALITY_PROFILE.high.shadowMap).toBe(2048)
    expect(QUALITY_PROFILE.medium.shadowMap).toBeLessThan(QUALITY_PROFILE.high.shadowMap)
    expect(QUALITY_PROFILE.low.shadows).toBe(false)
  })
})

describe('suelo PBR: parche del shader', () => {
  it('reemplaza los muestreos de color, normal y rugosidad y declara la variación', () => {
    const { fragment, count } = patchGroundShader(
      '#include <common>\n#include <map_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>',
    )
    expect(count).toBe(4) // color 1 + rugosidad 1 + normal 2 (con y sin tangentes) // si cambia three y no coinciden, falla acá y no en silencio
    expect(fragment).toContain('groundSample')
    expect(fragment).not.toMatch(/texture2D\(\s*(map|normalMap|roughnessMap)\s*,/)
  })
})

describe('disposición de props (solo zonas libres, sin figuras que sugieran zonas)', () => {
  const all = [...CONES, ...BARRELS]
  const inside = all.every((p) => p.x > B.minX + 1 && p.x < B.maxX - 1 && p.z > B.minZ + 1 && p.z < B.maxZ - 1)
  it('están dentro de la locación', () => expect(inside).toBe(true))
  it('lejos del equipo (x ∈ [-23, 17], z ∈ [-30, 8]), del Acceso y de la camioneta', () => {
    for (const p of all) {
      const rig = p.x > -23 && p.x < 17 && p.z > -30 && p.z < 8
      expect(rig, `${p.x},${p.z} cae en la huella del equipo`).toBe(false)
      expect(Math.hypot(p.x - RESPAWN[0], p.z - RESPAWN[2])).toBeGreaterThan(8)
      expect(Math.hypot(p.x - TRUCK_SPAWN[0], p.z - TRUCK_SPAWN[2])).toBeGreaterThan(8)
    }
  })
  it('conos sueltos: ninguna fila ni círculo (no hay 3 conos a menos de 3 m entre sí)', () => {
    for (const c of CONES) {
      const near = CONES.filter((o) => o !== c && Math.hypot(o.x - c.x, o.z - c.z) < 3)
      expect(near.length, `cono ${c.x},${c.z}`).toBeLessThan(2)
    }
  })
  it('el vallado recorre el borde de la locación', () => {
    expect(FENCE.minX).toBeCloseTo(B.minX, 5)
    expect(FENCE.maxZ).toBeCloseTo(B.maxZ, 5)
  })
})
