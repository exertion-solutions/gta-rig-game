// @vitest-environment node
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { RIG_PARTS } from '../../src/game/world/frame'
import { buildColliders, type LoadedPart } from '../../src/game/world/colliders'
import {
  INTERACTABLES,
  LADDERS,
  MAX_MEASURED_SLOPE_DEG,
  REPLACED_PARTS,
  TRAVERSAL,
  inclineCollider,
  railCollider,
  slopeDeg,
  walkableColliders,
  type BoxCollider,
} from '../../src/game/world/walkable'
import { PLAYER_GROUPS, STAIR_GROUPS, TRUCK_BLOCK_GROUPS, TRUCK_GROUPS } from '../../src/game/world/groups'

// Punto local (en unidades de semieje) -> mundo, con la rotación del collider.
function toWorld(c: BoxCollider, local: number[]) {
  const v = new THREE.Vector3(local[0] * c.half[0], local[1] * c.half[1], local[2] * c.half[2])
  if (c.rot) v.applyEuler(new THREE.Euler(...c.rot, 'XYZ'))
  return v.add(new THREE.Vector3(...c.center)).toArray()
}
const close = (a: number[], b: number[], eps = 1e-6) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], -Math.log10(eps)))

describe('slopeDeg', () => {
  it('deriva la pendiente de contrahuella y huella', () => {
    expect(slopeDeg(1, 1)).toBeCloseTo(45)
    expect(slopeDeg(0.175, 0.25)).toBeCloseTo(34.99, 1)
    expect(slopeDeg(0, 1)).toBe(0)
  })
})

describe('inclineCollider', () => {
  it('la cara superior pasa exactamente por bottom y top (rampa hacia +X)', () => {
    const c = inclineCollider('r', [0, 0, 0], [3, 3, 0], 1, 0.1)
    close(toWorld(c, [-1, 1, 0]), [0, 0, 0])
    close(toWorld(c, [1, 1, 0]), [3, 3, 0])
    expect(c.half[2]).toBe(0.5)
  })
  it('funciona en cualquier rumbo (rampa que sube hacia -X y otra hacia -Z)', () => {
    const a = inclineCollider('a', [6.97, 1.09, 0], [1.47, 3.62, 0], 1.2)
    close(toWorld(a, [-1, 1, 0]), [6.97, 1.09, 0])
    close(toWorld(a, [1, 1, 0]), [1.47, 3.62, 0])
    const b = inclineCollider('b', [2, 0, 5], [2, 1, 3], 0.8)
    close(toWorld(b, [1, 1, 0]), [2, 1, 3])
    close(toWorld(b, [0, 1, 1]).map((v, i) => (i === 0 ? v : 0)), [2.4, 0, 0]) // el ancho queda en X
  })
  it('una rampa horizontal es una caja sin inclinación bajo la línea', () => {
    const c = inclineCollider('h', [0, 1, 0], [4, 1, 0], 2, 0.2)
    close(c.center, [2, 0.9, 0])
    close(c.half, [2, 0.1, 1])
  })
})

describe('railCollider', () => {
  it('va del piso a la altura del pasamanos, a lo largo del tramo', () => {
    const c = railCollider('b', [0, 2, -1], [0, 2, 3], 1)
    close(toWorld(c, [0, -1, 0]), [0, 2, 1])
    close(toWorld(c, [0, 1, 0]), [0, 3, 1])
    expect(c.half[0]).toBeCloseTo(2)
  })
})

describe('traversal.json', () => {
  it('registra el sha256 de cada GLB de origen y coincide con los archivos', () => {
    const files = Object.keys((TRAVERSAL as unknown as { sources: Record<string, string> }).sources)
    expect(files).toContain('public/models/scenario/additions.glb')
    expect(files).toContain('public/models/rig10/sk575_piso.glb')
    for (const [f, h] of Object.entries((TRAVERSAL as unknown as { sources: Record<string, string> }).sources))
      expect(createHash('sha256').update(readFileSync(f)).digest('hex'), f).toBe(h)
  })
  // En proceso (antes subproceso: con la máquina cargada una vez no llegó a los 60 s). Lee y decodifica 6 GLB (~6 s en
  // frío); el margen de 120 s es solo para cargas altas, la comparación es exacta.
  it('es reproducible: el extractor regenera exactamente el JSON del repo', async () => {
    const { generate } = await import('../../scripts/extract-traversal.mjs')
    expect(await generate()).toBe(readFileSync('src/game/world/traversal.json', 'utf8').replace(/\r\n/g, '\n'))
  }, 120_000)
  it('forma: LadderVolume, Interactable y anclajes con evidencia', () => {
    for (const l of LADDERS) {
      expect(l.top[1]).toBeGreaterThan(l.bottom[1])
      expect(typeof l.facing).toBe('number')
    }
    expect(INTERACTABLES.length).toBeGreaterThan(0)
    for (const v of TRAVERSAL.interactables) {
      expect(v.kind).toBe('valve')
      expect(v.state).toBeUndefined() // sin fuente: no hay estado hasta que el jugador opera (registro propio)
      expect(v.position).toHaveLength(3)
      expect(['documentado', 'ilustrativo']).toContain(v.evidence.status)
      expect(v.sourceId).toMatch(/^glb:sk575_/)
    }
    expect(new Set(TRAVERSAL.interactables.map((v) => v.id)).size).toBe(TRAVERSAL.interactables.length)
    for (const s of [...TRAVERSAL.stairs, ...TRAVERSAL.ramps]) expect(s.top[1]).toBeGreaterThan(s.bottom[1])
  })
  it('escaleras y rampas medidas quedan bajo la pendiente máxima del controlador (50°)', () => {
    expect(MAX_MEASURED_SLOPE_DEG).toBeLessThan(50)
    for (const s of TRAVERSAL.stairs) expect(s.slopeDeg).toBeCloseTo(slopeDeg(s.top[1] - s.bottom[1], Math.hypot(s.top[0] - s.bottom[0], s.top[2] - s.bottom[2])), 1)
  })
  it('cada collider es finito y no es trimesh', () => {
    const cs = walkableColliders()
    expect(cs.length).toBeGreaterThan(20)
    for (const c of cs) [...c.center, ...c.half].forEach((v) => expect(Number.isFinite(v)).toBe(true))
  })
})

describe('buildColliders con piezas reemplazadas', () => {
  it('no genera la caja completa de mástil, BOP ni piletas (las cubren las cajas medidas)', () => {
    const parts: LoadedPart[] = RIG_PARTS.map((p) => ({ id: p.id, role: p.role, bounds: new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1)) }))
    expect(buildColliders(parts, REPLACED_PARTS).map((c) => c.id)).toEqual(['sk575_carrier'])
  })
})

// QA D-09: la camioneta trepaba la rampa de colisión de una escalera y quedaba encaramada. La rampa es solo del jugador;
// la camioneta choca contra el volumen bajo de la escalera, dentro de su huella.
describe('escaleras: rampa para el jugador, volumen bajo para la camioneta', () => {
  const cs = walkableColliders()
  for (const s of TRAVERSAL.stairs)
    it(`${s.id}`, () => {
      expect(cs.find((c) => c.id === s.id)?.only).toBe('stair')
      const b = cs.find((c) => c.id === `${s.id}_camioneta`)!
      expect(b.only).toBe('truckBlock')
      expect(b.center[0] - b.half[0]).toBeCloseTo(Math.min(s.bottom[0], s.top[0]), 3)
      expect(b.center[0] + b.half[0]).toBeCloseTo(Math.max(s.bottom[0], s.top[0]), 3)
      expect(b.half[2]).toBeCloseTo(s.width / 2, 3)
      expect(b.center[1] + b.half[1]).toBeLessThanOrEqual(0.9 + 1e-9)
      expect(b.center[1] - b.half[1]).toBeCloseTo(0, 6)
    })
  it('grupos: la rampa no filtra a la camioneta, el volumen solo filtra a la camioneta', () => {
    const test = (a: number, b: number) => ((a >>> 16) & b & 0xffff) !== 0 && ((b >>> 16) & a & 0xffff) !== 0
    expect(test(STAIR_GROUPS, PLAYER_GROUPS)).toBe(true)
    expect(test(STAIR_GROUPS, TRUCK_GROUPS)).toBe(false)
    expect(test(TRUCK_BLOCK_GROUPS, TRUCK_GROUPS)).toBe(true)
    expect(test(TRUCK_BLOCK_GROUPS, PLAYER_GROUPS)).toBe(false)
    expect(test(PLAYER_GROUPS, TRUCK_GROUPS)).toBe(true)
  })
})
