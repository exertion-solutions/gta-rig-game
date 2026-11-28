import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RIG_NAME } from '../data/evidence'
import { usePlayerStore } from '../player/store'
import { LIGHTS_S, ROAD_HALF, inLocacion, nearest, roadY } from './route'
import { ANIMALS, ANIMAL_SIZE, BUILDINGS, OBSTACLES, PLANTS, VEHICLES, animalAt, beside, lightPost, lightState, routeClock, vehicleAt, type Plant } from './routeWorld'

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

// Ventanas: una grilla oscura sobre el color de cada edificio (textura generada, sin assets).
function windowsTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = '#fff'
  g.fillRect(0, 0, 64, 64)
  g.fillStyle = '#39424c'
  for (let y = 8; y < 60; y += 16) for (let x = 6; x < 60; x += 14) g.fillRect(x, y, 8, 9)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function Buildings() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const tex = useMemo(windowsTexture, [])
  const geo = useMemo(() => box(1, 1, 1, 0, 0.5, 0), [])
  useLayoutEffect(() => {
    const m = ref.current!
    BUILDINGS.forEach((b, i) => {
      put(m, i, b.x, b.y - 0.3, b.z, b.yaw, b.d, b.h + 0.3, b.w) // eje Z local a lo largo del camino
      m.setColorAt(i, color.set(b.color))
    })
    m.instanceMatrix.needsUpdate = true
    m.instanceColor!.needsUpdate = true
  }, [])
  useEffect(() => () => (tex.dispose(), geo.dispose()), [tex, geo])
  return (
    <instancedMesh ref={ref} args={[geo, undefined, BUILDINGS.length]} name="ruta_edificios" frustumCulled={false} receiveShadow>
      <meshStandardMaterial map={tex} roughness={0.9} />
    </instancedMesh>
  )
}

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

// Tránsito: carrocería (color por instancia) y partes oscuras (ruedas y vidrios), para autos y para camiones.
function vehicleGeometry(truck: boolean) {
  // caja unitaria: ancho X, alto Y, largo Z; el frente mira a −Z (como la camioneta)
  const body = truck
    ? [box(0.92, 0.5, 0.2, 0, 0.42, -0.4), box(1, 0.68, 0.72, 0, 0.6, 0.12)] // cabina y caja de carga
    : [box(1, 0.36, 1, 0, 0.36, 0), box(0.86, 0.3, 0.5, 0, 0.72, 0.04)] // carrocería y habitáculo
  const dark = [
    ...[-0.36, 0.34].flatMap((z) => [-0.46, 0.46].map((x) => box(0.14, 0.2, truck ? 0.1 : 0.18, x, 0.1, z))), // ruedas
    truck ? box(0.84, 0.14, 0.02, 0, 0.56, -0.505) : box(0.8, 0.2, 0.52, 0, 0.74, 0.04), // parabrisas / vidrios
  ]
  return [mergeGeometries(body)!, mergeGeometries(dark)!] as const
}
function Traffic() {
  const kinds = useMemo(() => (['auto', 'camion'] as const).map((k) => ({ list: VEHICLES.filter((v) => v.kind === k), geo: vehicleGeometry(k === 'camion') })), [])
  const body = useRef<(THREE.InstancedMesh | null)[]>([])
  const dark = useRef<(THREE.InstancedMesh | null)[]>([])
  useLayoutEffect(() => {
    kinds.forEach((k, j) => {
      k.list.forEach((v, i) => body.current[j]!.setColorAt(i, color.set(v.color)))
      body.current[j]!.instanceColor!.needsUpdate = true
    })
  }, [kinds])
  useFrame(() => {
    kinds.forEach((k, j) => {
      k.list.forEach((v, i) => {
        const p = vehicleAt(v, routeClock.t)
        for (const m of [body.current[j]!, dark.current[j]!]) put(m, i, p.x, p.y + 0.02, p.z, p.yaw, v.wid, v.hgt, v.len)
      })
      body.current[j]!.instanceMatrix.needsUpdate = true
      dark.current[j]!.instanceMatrix.needsUpdate = true
    })
  })
  return (
    <group name="ruta_transito">
      {kinds.map((k, j) => (
        <group key={j}>
          <instancedMesh ref={(m) => void (body.current[j] = m)} args={[k.geo[0], undefined, k.list.length]} frustumCulled={false} castShadow>
            <meshStandardMaterial roughness={0.5} metalness={0.3} />
          </instancedMesh>
          <instancedMesh ref={(m) => void (dark.current[j] = m)} args={[k.geo[1], undefined, k.list.length]} frustumCulled={false}>
            <meshStandardMaterial color="#15171a" roughness={0.6} />
          </instancedMesh>
        </group>
      ))}
    </group>
  )
}

// Animales: un cuadrúpedo de cajas (cuerpo, cuello, cabeza, patas), escalado y teñido por especie.
const FUR = { guanaco: '#b8854f', oveja: '#e8e3d8', caballo: '#5c3f2c' } as const
function Animals() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(
    () =>
      mergeGeometries([
        box(1, 0.36, 0.62, 0, 0.62, 0), // cuerpo (largo en Z, frente a −Z)
        box(0.5, 0.42, 0.14, 0, 0.86, -0.3), // cuello
        box(0.56, 0.16, 0.2, 0, 1.0, -0.4), // cabeza
        ...[-0.24, 0.24].flatMap((z) => [-0.3, 0.3].map((x) => box(0.22, 0.46, 0.08, x, 0.23, z))), // patas
      ])!,
    [],
  )
  useLayoutEffect(() => {
    ANIMALS.forEach((a, i) => ref.current!.setColorAt(i, color.set(FUR[a.kind])))
    ref.current!.instanceColor!.needsUpdate = true
  }, [])
  useFrame(() => {
    ANIMALS.forEach((a, i) => {
      const p = animalAt(a, routeClock.t)
      const [w, h, l] = ANIMAL_SIZE[a.kind]
      put(ref.current!, i, p.x, p.y, p.z, p.yaw, w * a.scale, h * a.scale, l * a.scale)
    })
    ref.current!.instanceMatrix.needsUpdate = true
  })
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <instancedMesh ref={ref} args={[geo, undefined, ANIMALS.length]} name="ruta_animales" frustumCulled={false} castShadow>
      <meshStandardMaterial roughness={1} />
    </instancedMesh>
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
      <Buildings />
      <Lights />
      <Plants />
      <Obstacles />
      <Traffic />
      <Animals />
      <BaseSign />
    </group>
  )
}
