import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { usePlayerStore } from '../player/store'
import { assetUrl } from './assetUrl'
import { ROAD_HALF, ROUTE_END_S, nearest, noise, paved, pointAt, roadY, terrainY } from './route'

// Terreno de la ruta: mismo campo de alturas (route.terrainY) para lo que se ve y lo que se pisa, generado por tramos
// alrededor del jugador y de la camioneta. Nunca se arma el mundo entero (20 km): solo lo cercano.
export const CELL = 8 // m entre vértices
export const PHYS = 96 // lado de un tramo de colisión (12 celdas)
const VIEW = 192 // lado de un tramo dibujado (24 celdas)
const VIEW_R = 2 // 5 × 5 tramos dibujados: ±480 m (la niebla cierra a 420 m)
const PER_FRAME = 2 // tramos dibujados que se arman por cuadro (sin tirones)

/** Alturas de un tramo de colisión, en el orden que espera Rapier (por columnas: x afuera, z adentro). */
export function physHeights(cx: number, cz: number) {
  const n = PHYS / CELL + 1
  const h = new Float32Array(n * n)
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) h[j * n + i] = terrainY(cx * PHYS + j * CELL, cz * PHYS + i * CELL)
  return h
}

/** Tramos (cx, cz) de lado `size` en un cuadrado de radio `r` alrededor de cada foco, sin repetir. */
export function chunksAround(foci: readonly (readonly number[])[], size: number, r: number) {
  const out = new Map<string, [number, number]>()
  for (const f of foci) {
    const cx = Math.floor(f[0] / size)
    const cz = Math.floor(f[2] / size)
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) out.set(`${cx + a},${cz + b}`, [cx + a, cz + b])
  }
  return out
}

// Tintes sobre las texturas (Poly Haven, CC0; NOTICE.md): la estepa casi neutra, verde en las chacras, gris en la ciudad;
// la roca alterna dos tonos por estrato.
const TAN = [1, 0.96, 0.88]
const GREEN = [0.72, 0.9, 0.62]
const TOWN = [0.82, 0.82, 0.82]
const ROCK = [[1, 0.95, 0.9], [0.86, 0.8, 0.76]]
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t)

/** Geometría de un tramo dibujado. Las normales salen de la misma grilla (con un borde extra): sin costuras de luz. */
/** `step`: separación entre vértices (CELL cerca; el doble en los tramos lejanos). */
export function chunkGeometry(cx: number, cz: number, step: number = CELL) {
  const n = VIEW / step + 1
  const pad = n + 2
  const h = new Float32Array(pad * pad)
  for (let j = 0; j < pad; j++) for (let i = 0; i < pad; i++) h[j * pad + i] = terrainY(cx * VIEW + (j - 1) * step, cz * VIEW + (i - 1) * step)
  const at = (j: number, i: number) => h[(j + 1) * pad + i + 1]
  const pos = new Float32Array(n * n * 3)
  const nor = new Float32Array(n * n * 3)
  const col = new Float32Array(n * n * 3)
  const uv = new Float32Array(n * n * 2)
  const rock = new Float32Array(n * n)
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const k = j * n + i
      const x = cx * VIEW + j * step
      const z = cz * VIEW + i * step
      const y = at(j, i)
      pos.set([x, y, z], k * 3)
      const nx = at(j - 1, i) - at(j + 1, i)
      const nz = at(j, i - 1) - at(j, i + 1)
      const l = Math.hypot(nx, 2 * step, nz)
      nor.set([nx / l, (2 * step) / l, nz / l], k * 3)
      uv.set([x / 5, z / 5], k * 2)
      // color: roca en estratos donde hay pendiente; verde en las chacras; gris en la ciudad; estepa en el resto
      const s = nearest(x, z).s
      let c = s < 3100 ? TOWN : mix(TAN, GREEN, Math.max(0, 1 - Math.abs(s - 4350) / 1250) * 0.8)
      const steep = Math.min(1, Math.max(0, (0.95 - (2 * step) / l) / 0.17))
      if (steep > 0) c = mix(c, ROCK[Math.abs(Math.floor(y / 5.5)) % 2], steep)
      rock[k] = steep // en pendiente se ve la textura de barda (ver el material)
      const m = 1 + 0.07 * noise(x / 23, z / 23)
      col.set([c[0] * m, c[1] * m, c[2] * m], k * 3)
    }
  const idx = new Uint16Array((n - 1) * (n - 1) * 6)
  let q = 0
  for (let j = 0; j < n - 1; j++)
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i
      idx.set([a, a + 1, a + n, a + 1, a + n + 1, a + n], q)
      q += 6
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setAttribute('aRock', new THREE.BufferAttribute(rock, 1))
  g.setIndex(new THREE.BufferAttribute(idx, 1))
  return g
}

// Calzada: cintas sobre el eje, ±700 m alrededor del jugador. Asfalto con línea central en la base y la ciudad; ripio después.
const ROAD_SPAN = 700
const ROAD_STEP = 5
function ribbon(s0: number, half: number, lift: number, on: (s: number) => boolean, dash = 0) {
  const a = Math.max(0, s0 - ROAD_SPAN)
  const b = Math.min(ROUTE_END_S, s0 + ROAD_SPAN)
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  let prev = -1
  for (let s = a; s <= b; s += ROAD_STEP) {
    if (!on(s) || (dash && Math.floor(s / dash) % 2 !== 0)) {
      prev = -1
      continue
    }
    const p = pointAt(s)
    const y = roadY(s) + lift
    const k = pos.length / 3
    pos.push(p.x + p.tz * half, y, p.z - p.tx * half, p.x - p.tz * half, y, p.z + p.tx * half)
    uv.push(0, s / 4.5, 2, s / 4.5) // la textura entra dos veces a lo ancho
    if (prev >= 0) idx.push(prev, prev + 1, k, prev + 1, k + 1, k) // cara hacia arriba
    prev = k
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

const tiled = (t: THREE.Texture) => {
  const c = t.clone()
  c.wrapS = c.wrapT = THREE.RepeatWrapping
  c.colorSpace = THREE.SRGBColorSpace
  c.anisotropy = 8
  c.needsUpdate = true
  return c
}
// Texturas de Poly Haven (CC0), 1k: ver NOTICE.md.
const TEX = ['estepa', 'barda', 'ripio', 'asfalto'].map((n) => assetUrl(`textures/ruta_${n}.webp`))
const flat = { roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }

export function Terrain() {
  const [estepa, barda, ripio, asfalto] = useTexture(TEX)
  const mats = useMemo(() => {
    const rock = tiled(barda)
    // suelo: estepa, y textura de barda donde hay pendiente (atributo aRock de cada vértice)
    const ground = new THREE.MeshStandardMaterial({ map: tiled(estepa), vertexColors: true, roughness: 1, metalness: 0 })
    ground.onBeforeCompile = (sh) => {
      sh.uniforms.mapRock = { value: rock }
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aRock;\nvarying float vRock;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRock = aRock;')
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D mapRock;\nvarying float vRock;')
        .replace('#include <map_fragment>', 'diffuseColor *= mix(texture2D(map, vMapUv), texture2D(mapRock, vMapUv * 0.3), vRock);')
    }
    return {
      rock,
      ground,
      gravel: new THREE.MeshStandardMaterial({ map: tiled(ripio), ...flat }),
      asphalt: new THREE.MeshStandardMaterial({ map: tiled(asfalto), color: '#7f858f', ...flat }), // la textura tira a pardo: se enfría
      line: new THREE.MeshStandardMaterial({ color: '#d9b833', ...flat, polygonOffsetFactor: -4 }),
    }
  }, [estepa, barda, ripio, asfalto])
  const group = useRef<THREE.Group>(null)
  const roads = useRef<(THREE.Mesh | null)[]>([])
  const chunks = useRef(new Map<string, { mesh: THREE.Mesh; step: number }>())
  const roadAt = useRef(-1e9)

  useEffect(() => {
    const live = chunks.current
    return () => {
      live.forEach((c) => c.mesh.geometry.dispose())
      live.clear()
      mats.rock.dispose()
      for (const m of [mats.ground, mats.gravel, mats.asphalt, mats.line]) {
        m.map?.dispose()
        m.dispose()
      }
    }
  }, [mats])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const p = usePlayerStore.getState().position
    const fx = Math.floor(p[0] / VIEW)
    const fz = Math.floor(p[2] / VIEW)
    const want = chunksAround([p], VIEW, VIEW_R)
    for (const [k, c] of chunks.current)
      if (!want.has(k)) {
        g.remove(c.mesh)
        c.mesh.geometry.dispose()
        chunks.current.delete(k)
      }
    // los 3 × 3 tramos cercanos con vértices cada CELL; el anillo de afuera, cada 2·CELL (la niebla ya lo tapa a medias)
    const stepOf = ([cx, cz]: [number, number]) => (Math.max(Math.abs(cx - fx), Math.abs(cz - fz)) >= 2 ? CELL * 2 : CELL)
    const todo = [...want].filter(([k, c]) => chunks.current.get(k)?.step !== stepOf(c)).sort((a, b) => dist(a[1], p) - dist(b[1], p))
    for (const [k, c] of todo.slice(0, PER_FRAME)) {
      const old = chunks.current.get(k)
      if (old) {
        g.remove(old.mesh)
        old.mesh.geometry.dispose()
      }
      const mesh = new THREE.Mesh(chunkGeometry(c[0], c[1], stepOf(c)), mats.ground)
      mesh.receiveShadow = true
      mesh.name = `terreno_${k}`
      g.add(mesh)
      chunks.current.set(k, { mesh, step: stepOf(c) })
    }
    const s = nearest(p[0], p[2]).s
    if (Math.abs(s - roadAt.current) > 150 && roads.current.length === 3 && roads.current.every(Boolean)) {
      const geos = [ribbon(s, ROAD_HALF, 0.09, (v) => !paved(v)), ribbon(s, ROAD_HALF, 0.09, paved), ribbon(s, 0.09, 0.11, paved, 10)]
      roads.current.forEach((m, i) => {
        m!.geometry.dispose()
        m!.geometry = geos[i]
      })
      roadAt.current = s
    }
  })

  return (
    <>
      <group ref={group} name="terreno" />
      {[mats.gravel, mats.asphalt, mats.line].map((m, i) => (
        <mesh key={i} ref={(o) => void (roads.current[i] = o)} material={m} receiveShadow name={`calzada_${i}`} frustumCulled={false} />
      ))}
    </>
  )
}
const dist = (c: [number, number], p: readonly number[]) => Math.hypot((c[0] + 0.5) * VIEW - p[0], (c[1] + 0.5) * VIEW - p[2])
