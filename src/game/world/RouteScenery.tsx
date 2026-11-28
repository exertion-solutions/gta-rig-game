import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RIG_NAME } from '../data/evidence'
import { exposeGame } from '../dev'
import { usePlayerStore } from '../player/store'
import { assetUrl, DRACO_PATH } from './assetUrl'
import { LIGHTS_S, ROAD_HALF, inLocacion, nearest, pointAt, roadY, terrainY } from './route'
import { ANIMALS, ANIMAL_SIZE, BUILDINGS, CITY, CROSS_HALF, OBSTACLES, PLANTS, SIDEWALK, VEHICLES, animalAt, beside, lightPost, lightState, routeClock, vehicleAt, type Plant } from './routeWorld'

// Dibujo de lo que puebla la ruta (routeWorld.ts). Casi todo va en mallas instanciadas: un draw call por tipo.
const Y = new THREE.Vector3(0, 1, 0)
const m4 = new THREE.Matrix4()
const q = new THREE.Quaternion()
const v3 = new THREE.Vector3()
const sc = new THREE.Vector3()
const color = new THREE.Color()
const put = (mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, yaw: number, sx: number, sy: number, sz: number) =>
  mesh.setMatrixAt(i, m4.compose(v3.set(x, y, z), q.setFromAxisAngle(Y, yaw), sc.set(sx, sy, sz)))
const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z)

// Semáforos y bocacalles. La luz encendida es emisiva; las otras dos quedan apagadas.
const LAMP = { red: '#ff2a1f', yellow: '#ffc21a', green: '#22e06a' } as const
const ORDER = ['red', 'yellow', 'green'] as const
function Lights() {
  const lamps = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  useFrame(() => {
    LIGHTS_S.forEach((_, i) => {
      const on = lightState(i, routeClock.t)
      ORDER.forEach((c, k) => {
        const m = lamps.current[i * 3 + k]
        if (m) m.emissiveIntensity = c === on ? 3 : 0.04
      })
    })
  })
  return (
    <group name="ruta_semaforos">
      {LIGHTS_S.map((s, i) => {
        const p = lightPost(i)
        const c = beside(s, 0, true)
        return (
          <group key={s}>
            {/* bocacalle */}
            <mesh position={[c.x, c.y + 0.07, c.z]} rotation={[0, c.yaw + Math.PI / 2, 0]}>
              <boxGeometry args={[12, 0.02, 150]} />
              <meshStandardMaterial color="#2c2c2e" roughness={0.95} />
            </mesh>
            {/* senda peatonal antes de la bocacalle */}
            {[-3, -1.5, 0, 1.5, 3].map((k) => {
              const z = beside(s - 8.5, k, true)
              return (
                <mesh key={k} position={[z.x, z.y + 0.12, z.z]} rotation={[0, z.yaw, 0]}>
                  <boxGeometry args={[0.7, 0.01, 2.4]} />
                  <meshStandardMaterial color="#e6e6e0" roughness={0.9} />
                </mesh>
              )
            })}
            <group position={[p.x, p.y, p.z]} rotation={[0, p.yaw, 0]}>
              <mesh position={[0, 2.6, 0]}>
                <cylinderGeometry args={[0.07, 0.09, 5.2, 8]} />
                <meshStandardMaterial color="#3a3f45" roughness={0.6} metalness={0.5} />
              </mesh>
              {/* brazo sobre el carril y cabezal mirando a quien llega (hacia +Z local) */}
              <mesh position={[-1.7, 5.1, 0]}>
                <boxGeometry args={[3.4, 0.09, 0.09]} />
                <meshStandardMaterial color="#3a3f45" roughness={0.6} metalness={0.5} />
              </mesh>
              <mesh position={[-3.2, 4.55, 0]}>
                <boxGeometry args={[0.36, 1.05, 0.26]} />
                <meshStandardMaterial color="#17191c" roughness={0.7} />
              </mesh>
              {ORDER.map((c, k) => (
                <mesh key={c} position={[-3.2, 4.87 - k * 0.32, 0.14]}>
                  <sphereGeometry args={[0.12, 12, 8]} />
                  <meshStandardMaterial ref={(m) => void (lamps.current[i * 3 + k] = m)} color="#101010" emissive={LAMP[c]} emissiveIntensity={0.04} />
                </mesh>
              ))}
            </group>
          </group>
        )
      })}
    </group>
  )
}

// Árboles y arbustos: solo los cercanos al jugador (por distancia a lo largo de la ruta); el resto no se dibuja.
const NEAR = 650
function Plants() {
  const alamos = useRef<THREE.InstancedMesh>(null)
  const shrubs = useRef<THREE.InstancedMesh>(null)
  const at = useRef(-1e9)
  const [gAlamo, gShrub, lists] = useMemo(() => {
    const trunk = new THREE.CylinderGeometry(0.035, 0.05, 0.3, 5).translate(0, 0.15, 0)
    const crown = new THREE.ConeGeometry(0.13, 0.8, 7).translate(0, 0.62, 0)
    const paint = (g: THREE.BufferGeometry, c: string) => {
      const col = new THREE.Color(c)
      g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: g.attributes.position.count }, () => col.toArray()).flat(), 3))
      return g
    }
    const alamo = mergeGeometries([paint(trunk, '#6b5a45'), paint(crown, '#5f8a3a')])!
    const shrub = paint(new THREE.IcosahedronGeometry(0.5, 0).scale(1, 0.6, 1).translate(0, 0.25, 0), '#7f8552')
    return [alamo, shrub, { alamo: PLANTS.filter((p) => p.kind === 'alamo'), arbusto: PLANTS.filter((p) => p.kind === 'arbusto') }] as const
  }, [])
  const fill = (mesh: THREE.InstancedMesh, list: Plant[], s: number, wide: number) => {
    let n = 0
    for (const p of list) {
      if (Math.abs(p.s - s) > NEAR) continue
      if (n >= mesh.instanceMatrix.count) break
      put(mesh, n++, p.x, p.y - 0.1, p.z, p.s, p.h * wide, p.h, p.h * wide)
    }
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
  }
  useFrame(() => {
    const p = usePlayerStore.getState().position
    const s = nearest(p[0], p[2]).s
    if (Math.abs(s - at.current) < 120 || !alamos.current || !shrubs.current) return
    at.current = s
    fill(alamos.current, lists.alamo, s, 0.55) // álamo: copa angosta y alta
    fill(shrubs.current, lists.arbusto, s, 1.6)
  })
  useEffect(() => () => (gAlamo.dispose(), gShrub.dispose()), [gAlamo, gShrub])
  return (
    <>
      <instancedMesh ref={alamos} args={[gAlamo, undefined, 260]} name="ruta_alamos" frustumCulled={false} castShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </instancedMesh>
      <instancedMesh ref={shrubs} args={[gShrub, undefined, 330]} name="ruta_arbustos" frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={1} flatShading />
      </instancedMesh>
    </>
  )
}

function Obstacles() {
  const rocks = OBSTACLES.filter((o) => o.kind === 'roca')
  const cones = OBSTACLES.filter((o) => o.kind === 'cono')
  const fences = OBSTACLES.filter((o) => o.kind === 'valla')
  const grids = OBSTACLES.filter((o) => o.kind === 'guardaganado')
  const rk = useRef<THREE.InstancedMesh>(null)
  const cn = useRef<THREE.InstancedMesh>(null)
  const fn = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    rocks.forEach((o, i) => put(rk.current!, i, o.x, o.y + o.r * 0.55, o.z, o.s, o.r * 1.2, o.r, o.r))
    cones.forEach((o, i) => put(cn.current!, i, o.x, o.y + 0.08, o.z, 0, 1, 1, 1))
    fences.forEach((o, i) => put(fn.current!, i, o.x, o.y + 0.6, o.z, o.yaw, 1, 1, 1))
    for (const m of [rk, cn, fn]) m.current!.instanceMatrix.needsUpdate = true
  })
  return (
    <group name="ruta_obstaculos">
      <instancedMesh ref={rk} args={[undefined, undefined, rocks.length]} frustumCulled={false} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#8a6a52" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={cn} args={[undefined, undefined, cones.length]} frustumCulled={false}>
        <coneGeometry args={[0.22, 0.7, 10]} />
        <meshStandardMaterial color="#f26a1b" roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={fn} args={[undefined, undefined, fences.length]} frustumCulled={false}>
        <boxGeometry args={[1.8, 1.0, 0.12]} />
        <meshStandardMaterial color="#f2b01b" roughness={0.7} />
      </instancedMesh>
      {grids.map((o) => (
        <mesh key={o.s} position={[o.x, o.y + 0.12, o.z]} rotation={[0, o.yaw, 0]}>
          <boxGeometry args={[ROAD_HALF * 2, 0.03, 2.2]} />
          <meshStandardMaterial color="#4a4d52" roughness={0.6} metalness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

// Modelos de Kenney (CC0, NOTICE.md): un GLB con un `scene` por modelo (scripts/build-kenney.py). De cada uno sale una sola
// geometría (carrocería y ruedas juntas, con sus transformaciones aplicadas) para dibujarla instanciada.
const KIT_URL = assetUrl('models/ruta/kenney.glb')
type KitPart = { geo: THREE.BufferGeometry; mat: THREE.Material }
// Modelos generados con 3D AI Studio (NOTICE.md), reducidos a ~5.800 triángulos: van normalizados (apoyados en y = 0,
// centrados, de frente a +Z; la cisterna con 1 m de largo y el guanaco con 1 m de alto).
const EXTRA = [
  { name: 'cisterna', url: assetUrl('models/ruta/cisterna.glb'), turn: 0, unit: 'z' },
  { name: 'guanaco', url: assetUrl('models/ruta/guanaco.glb'), turn: -Math.PI / 2, unit: 'y' },
] as const
const KIT_URLS = [KIT_URL, ...EXTRA.map((e) => e.url)]
function bake(root: THREE.Object3D): KitPart | undefined {
  root.updateMatrixWorld(true)
  const geos: THREE.BufferGeometry[] = []
  let mat: THREE.Material | undefined
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    geos.push(m.geometry.clone().applyMatrix4(m.matrixWorld))
    mat = m.material as THREE.Material
  })
  return geos.length && mat ? { geo: geos.length > 1 ? mergeGeometries(geos)! : geos[0], mat } : undefined
}
function useKit() {
  const all = useGLTF(KIT_URLS, DRACO_PATH)
  const kit = useMemo(() => {
    const [gltf, ...extra] = all
    const out = new Map<string, KitPart>()
    for (const sc of gltf.scenes) {
      const part = bake(sc)
      if (part) out.set(sc.name, part)
    }
    EXTRA.forEach((e, i) => {
      const part = bake(extra[i].scene)
      if (!part) return
      part.geo.rotateY(e.turn).computeBoundingBox()
      const bb = part.geo.boundingBox!
      const k = 1 / (bb.max[e.unit] - bb.min[e.unit])
      part.geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2).scale(k, k, k)
      out.set(e.name, part)
    })
    return out
  }, [all])
  useEffect(() => () => kit.forEach((p) => p.geo.dispose()), [kit])
  return kit
}
const byModel = <T extends { model?: string }>(list: T[]) => [...new Set(list.map((b) => b.model!))].map((model) => ({ model, list: list.filter((b) => b.model === model) }))

// Ciudad: solo se dibujan los edificios cercanos (por distancia a lo largo de la ruta); la niebla tapa el resto.
const CITY_NEAR = 440
function City() {
  const kit = useKit()
  const groups = useMemo(() => byModel(BUILDINGS.filter((b) => b.model)), [])
  const refs = useRef<(THREE.InstancedMesh | null)[]>([])
  const at = useRef(-1e9)
  useFrame(() => {
    const p = usePlayerStore.getState().position
    const s = nearest(p[0], p[2]).s
    if (Math.abs(s - at.current) < 80 || groups.some((_, j) => !refs.current[j])) return
    at.current = s
    groups.forEach((g, j) => {
      const mesh = refs.current[j]!
      let n = 0
      for (const b of g.list) if (Math.abs(b.s! - s) < CITY_NEAR) put(mesh, n++, b.x, b.y - 0.12, b.z, b.face!, b.scale!, b.scale!, b.scale!)
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
    })
  })
  return (
    <group name="ruta_ciudad">
      {groups.map((g, j) => {
        const part = kit.get(g.model)
        return part && <instancedMesh key={g.model} ref={(m) => void (refs.current[j] = m)} args={[part.geo, part.mat, g.list.length]} count={0} frustumCulled={false} receiveShadow />
      })}
    </group>
  )
}

// Tránsito: autos, camionetas y camiones del kit; el frente del modelo mira a +Z (el del juego, a −Z).
function Traffic() {
  const kit = useKit()
  // para las pruebas: dónde va a estar cada vehículo y cada guanaco
  useEffect(() => exposeGame({ routeTraffic: (dt = 0) => VEHICLES.map((v) => ({ model: v.model, dir: v.dir, ...vehicleAt(v, routeClock.t + dt) })), routeGuanacos: () => GUANACOS.map((a) => animalAt(a, routeClock.t)) }), [])
  const groups = useMemo(() => byModel(VEHICLES), [])
  const refs = useRef<(THREE.InstancedMesh | null)[]>([])
  useFrame(() => {
    groups.forEach((g, j) => {
      const mesh = refs.current[j]
      if (!mesh) return
      g.list.forEach((v, i) => {
        const p = vehicleAt(v, routeClock.t)
        put(mesh, i, p.x, p.y + 0.02, p.z, p.yaw + Math.PI, v.scale, v.scale, v.scale)
      })
      mesh.instanceMatrix.needsUpdate = true
    })
  })
  return (
    <group name="ruta_transito">
      {groups.map((g, j) => {
        const part = kit.get(g.model)
        return part && <instancedMesh key={g.model} ref={(m) => void (refs.current[j] = m)} args={[part.geo, part.mat, g.list.length]} frustumCulled={false} castShadow />
      })}
    </group>
  )
}

// Veredas con cordón en la ciudad, líneas blancas de borde en todo el asfalto y playón de hormigón en la base.
// Todo sigue al terreno (terrainY): cintas fijas, armadas una vez.
function strip(from: number, to: number, a: number, b: number, lift: number, skip?: (s: number) => boolean, liftB = lift) {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  let prev = -1
  for (let s = from; s <= to; s += 5) {
    if (skip?.(s)) {
      prev = -1
      continue
    }
    const p = pointAt(s)
    const k = pos.length / 3
    for (const o of [a, b]) {
      const x = p.x - p.tz * o
      const z = p.z + p.tx * o
      pos.push(x, terrainY(x, z) + (o === a ? lift : liftB), z)
      uv.push(o / 1.5, s / 1.5)
    }
    if (prev >= 0) idx.push(prev, prev + 1, k, prev + 1, k + 1, k)
    prev = k
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}
function slabTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = '#c4c1b8'
  g.fillRect(0, 0, 64, 64)
  g.strokeStyle = '#8f8c84'
  g.lineWidth = 2
  g.strokeRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}
const PAVED_TO = 3100
function Streets() {
  const [tex, walk, lines, yard] = useMemo(() => {
    const atCross = (s: number) => LIGHTS_S.some((l) => Math.abs(s - l) < CROSS_HALF + 2.5)
    const R = ROAD_HALF
    const walk = mergeGeometries(
      [-1, 1].flatMap((k) => [
        strip(CITY.from - 60, CITY.to + 30, k * R, k * (R + SIDEWALK), 0.15, atCross),
        strip(CITY.from - 60, CITY.to + 30, k * (R - 0.001), k * R, 0.02, atCross, 0.15), // canto del cordón
      ]),
    )!
    const lines = mergeGeometries([-1, 1].map((k) => strip(0, PAVED_TO, k * (R - 0.4), k * (R - 0.25), 0.115)))!
    // playón: una grilla a la derecha del arranque, entre la calzada y los galpones
    const yard = mergeGeometries(Array.from({ length: 14 }, (_, i) => strip(0, 110, R + i * 5, R + i * 5 + 5, 0.07)))!
    return [slabTexture(), walk, lines, yard] as const
  }, [])
  useEffect(() => () => (tex.dispose(), walk.dispose(), lines.dispose(), yard.dispose()), [tex, walk, lines, yard])
  const off = { polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }
  return (
    <group name="ruta_calles">
      <mesh geometry={walk} receiveShadow>
        <meshStandardMaterial map={tex} roughness={0.95} side={THREE.DoubleSide} {...off} />
      </mesh>
      <mesh geometry={lines}>
        <meshStandardMaterial color="#e8e8e2" roughness={0.9} side={THREE.DoubleSide} {...off} polygonOffsetFactor={-4} />
      </mesh>
      <mesh geometry={yard} receiveShadow>
        <meshStandardMaterial map={tex} color="#a9a9a6" roughness={0.95} side={THREE.DoubleSide} {...off} />
      </mesh>
    </group>
  )
}

// Ovejas y caballos: figuras low-poly propias, en una caja unitaria (ancho X, alto Y, largo Z; frente a −Z) que se
// escala a la medida de la especie. Colores por vértice y caras planas, como el guanaco.
const tint = (g: THREE.BufferGeometry, c: string) => {
  const n = g.index ? g.toNonIndexed() : g
  const col = new THREE.Color(c)
  n.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n.attributes.position.count }, () => col.toArray()).flat(), 3))
  return n
}
const blob = (sx: number, sy: number, sz: number, x: number, y: number, z: number, c: string) => tint(new THREE.IcosahedronGeometry(0.5, 1).scale(sx, sy, sz).translate(x, y, z), c)
const part = (w: number, h: number, d: number, x: number, y: number, z: number, c: string, tilt = 0) => tint(new THREE.BoxGeometry(w, h, d).rotateX(tilt).translate(x, y, z), c)
const legs = (w: number, h: number, d: number, dx: number, dz: number, c: string) => [-dz, dz].flatMap((z) => [-dx, dx].map((x) => part(w, h, d, x, h / 2, z, c)))
const SHAPES = {
  oveja: () => [
    blob(1, 0.62, 0.8, 0, 0.62, 0.04, '#ece8dc'), // vellón
    part(0.44, 0.24, 0.2, 0, 0.72, -0.4, '#3a332d'), // cabeza
    part(0.7, 0.07, 0.05, 0, 0.8, -0.34, '#3a332d'), // orejas
    ...legs(0.16, 0.42, 0.07, 0.26, 0.24, '#3a332d'),
  ],
  caballo: () => [
    blob(0.92, 0.42, 0.62, 0, 0.66, 0.04, '#6b4a33'), // tronco
    part(0.42, 0.4, 0.15, 0, 0.86, -0.3, '#6b4a33', -0.6), // cuello
    part(0.36, 0.14, 0.26, 0, 0.98, -0.44, '#6b4a33', 0.35), // cabeza
    part(0.12, 0.34, 0.05, 0, 0.92, -0.24, '#2a1d14', -0.6), // crin
    part(0.2, 0.36, 0.05, 0, 0.56, 0.36, '#2a1d14', 0.25), // cola
    ...legs(0.2, 0.5, 0.07, 0.28, 0.24, '#5a3d2a'),
  ],
} as const
const HERD_KINDS = ['oveja', 'caballo'] as const
const GUANACOS = ANIMALS.filter((a) => a.kind === 'guanaco')
function Guanacos() {
  const part = useKit().get('guanaco')
  const ref = useRef<THREE.InstancedMesh>(null)
  useFrame(() => {
    if (!ref.current) return
    GUANACOS.forEach((a, i) => {
      const p = animalAt(a, routeClock.t)
      const h = ANIMAL_SIZE.guanaco[1] * a.scale
      put(ref.current!, i, p.x, p.y, p.z, p.yaw + Math.PI, h, h, h)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })
  return part ? <instancedMesh ref={ref} args={[part.geo, part.mat, GUANACOS.length]} name="ruta_guanacos" frustumCulled={false} castShadow /> : null
}
function Animals() {
  const herds = useMemo(() => HERD_KINDS.map((kind) => ({ kind, list: ANIMALS.filter((a) => a.kind === kind), geo: mergeGeometries(SHAPES[kind]())! })), [])
  const refs = useRef<(THREE.InstancedMesh | null)[]>([])
  useFrame(() => {
    herds.forEach((h, j) => {
      const mesh = refs.current[j]
      if (!mesh) return
      const [w, ht, l] = ANIMAL_SIZE[h.kind]
      h.list.forEach((a, i) => {
        const p = animalAt(a, routeClock.t)
        put(mesh, i, p.x, p.y, p.z, p.yaw, w * a.scale, ht * a.scale, l * a.scale)
      })
      mesh.instanceMatrix.needsUpdate = true
    })
  })
  useEffect(() => () => herds.forEach((h) => h.geo.dispose()), [herds])
  return (
    <group name="ruta_animales">
      {herds.map((h, j) => (
        <instancedMesh key={h.kind} ref={(m) => void (refs.current[j] = m)} args={[h.geo, undefined, h.list.length]} frustumCulled={false} castShadow>
          <meshStandardMaterial vertexColors roughness={1} flatShading />
        </instancedMesh>
      ))}
    </group>
  )
}

// Cartel de la base: mismo recurso que el rótulo del equipo (texto dibujado en un canvas).
function BaseSign() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 256
    const g = c.getContext('2d')!
    g.fillStyle = '#12315c'
    g.fillRect(0, 0, 1024, 256)
    g.fillStyle = '#fff'
    g.textAlign = 'center'
    g.font = 'bold 92px Arial, Helvetica, sans-serif'
    g.fillText('BASE OPERATIVA', 512, 108)
    g.font = '56px Arial, Helvetica, sans-serif'
    g.fillText(`${RIG_NAME} · equipo a 20 km`, 512, 196)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  useEffect(() => () => tex.dispose(), [tex])
  const p = beside(70, ROAD_HALF + 4)
  return (
    <group position={[p.x, roadY(70), p.z]} rotation={[0, p.yaw + Math.PI, 0]} name="ruta_cartel_base">
      {/* dos caras: con una sola de doble faz, desde el playón se leía espejado */}
      {[0, Math.PI].map((r) => (
        <mesh key={r} position={[0, 3.2, r ? -0.11 : 0.01]} rotation={[0, r, 0]}>
          <planeGeometry args={[6, 1.5]} />
          <meshStandardMaterial map={tex} roughness={0.6} />
        </mesh>
      ))}
      {[-2.6, 2.6].map((x) => (
        <mesh key={x} position={[x, 1.6, -0.05]}>
          <boxGeometry args={[0.1, 3.2, 0.1]} />
          <meshStandardMaterial color="#3a3f45" roughness={0.6} metalness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

export function RouteWorld() {
  // En la locación no se ve nada de esto (lo más cercano queda a más de 1 km): no se dibuja, para no gastar el
  // presupuesto de triángulos del equipo (docs/perf.md).
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    const p = usePlayerStore.getState().position
    if (group.current) group.current.visible = !inLocacion(p[0], p[2], 200)
  })
  return (
    <group ref={group} name="ruta">
      <Streets />
      <Lights />
      <Plants />
      <Obstacles />
      <Suspense fallback={null}>
        <City />
        <Traffic />
        <Guanacos />
      </Suspense>
      <Animals />
      <BaseSign />
    </group>
  )
}
