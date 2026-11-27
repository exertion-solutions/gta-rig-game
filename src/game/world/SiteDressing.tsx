import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { TRUCK_SPAWN, TRUCK_SPAWN_HEADING } from '../player/store'
import { FENCE as F } from './propsLayout'
import { useGroundMaterial } from './GroundMaterial'
import { LOCACION_BOUNDS as B } from './frame'

// Escenario ilustrativo añadido por el juego, no as-built (docs/scenario-additions.md A5–A8): vallado perimetral
// visible, cartel genérico, suelo exterior y marcas de uso del suelo (manchas, huellas cortas, charcos). Todo con
// texturas generadas en código (sin assets de terceros). Nada de esto marca zonas de exclusión ni áreas seguras.
const mx = (B.minX + B.maxX) / 2
const INSET = 0.06 // el vallado queda apenas adentro del borde (donde están los colliders invisibles)

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// ruido de valor determinista (semilla fija: mismas marcas en cada carga)
const rnd = (() => {
  let s = 12345
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
})()
const blobTexture = () =>
  canvasTexture(
    128,
    128,
    (g) => {
      const img = g.createImageData(128, 128)
      const k = Array.from({ length: 6 }, () => rnd() * 6.28)
      for (let y = 0; y < 128; y++)
        for (let x = 0; x < 128; x++) {
          const dx = (x - 63.5) / 64
          const dy = (y - 63.5) / 64
          const a = Math.atan2(dy, dx)
          const edge = 0.62 + 0.14 * Math.sin(3 * a + k[0]) + 0.1 * Math.sin(5 * a + k[1]) + 0.06 * Math.sin(9 * a + k[2])
          const v = THREE.MathUtils.smoothstep(edge - Math.hypot(dx, dy), 0, 0.3)
          const i = (y * 128 + x) * 4
          img.data.set([255, 255, 255, Math.round(v * 255)], i)
        }
      g.putImageData(img, 0, 0)
    },
    false,
  )

const tracksTexture = () =>
  canvasTexture(
    64,
    256,
    (g) => {
      const img = g.createImageData(64, 256)
      for (let y = 0; y < 256; y++)
        for (let x = 0; x < 64; x++) {
          const lane = x < 32 ? 16 : 48
          const d = Math.abs(x - lane)
          const tread = (y + d * 1.6) % 14 < 8 ? 1 : 0.35 // dibujo de la banda
          const fade = Math.min(1, y / 40, (255 - y) / 40) // se desvanece en las puntas
          const v = d < 8 ? tread * fade * (0.75 + 0.25 * rnd()) : 0
          img.data.set([255, 255, 255, Math.round(v * 255)], (y * 64 + x) * 4)
        }
      g.putImageData(img, 0, 0)
    },
    false,
  )

const signTexture = () =>
  canvasTexture(1024, 256, (g) => {
    g.fillStyle = '#1f3b5c'
    g.fillRect(0, 0, 1024, 256)
    g.strokeStyle = '#e8eef5'
    g.lineWidth = 8
    g.strokeRect(12, 12, 1000, 232)
    g.fillStyle = '#e8eef5'
    g.textAlign = 'center'
    g.font = 'bold 84px sans-serif'
    g.fillText('ESCENARIO ILUSTRATIVO', 512, 118)
    g.font = '52px sans-serif'
    g.fillText('referencia digital · no as-built', 512, 196)
  })

function Fence() {
  const { panels, posts, rails, mats } = useMemo(() => {
    const x0 = B.minX + INSET
    const x1 = B.maxX - INSET
    const z0 = B.minZ + INSET
    const z1 = B.maxZ - INSET
    const link = canvasTexture(128, 128, (g) => {
      g.strokeStyle = '#d7dadd'
      g.lineWidth = 5
      g.beginPath()
      for (let o = -128; o <= 128; o += 64) {
        g.moveTo(o, 0)
        g.lineTo(o + 128, 128)
        g.moveTo(o + 128, 0)
        g.lineTo(o, 128)
      }
      g.stroke()
    })
    link.wrapS = link.wrapT = THREE.RepeatWrapping
    // 4 lados en una sola malla: UV = metros / 0,45 m de malla
    const side = (len: number, ax: number, az: number, ry: number) => {
      const g = new THREE.PlaneGeometry(len, F.height - 0.1)
      const uv = g.attributes.uv
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * len) / 0.45, (uv.getY(i) * (F.height - 0.1)) / 0.45)
      return g.rotateY(ry).translate(ax, (F.height - 0.1) / 2 + 0.08, az)
    }
    const panels = mergeGeometries([
      side(x1 - x0, (x0 + x1) / 2, z0, 0),
      side(x1 - x0, (x0 + x1) / 2, z1, Math.PI),
      side(z1 - z0, x0, 0, Math.PI / 2),
      side(z1 - z0, x1, 0, -Math.PI / 2),
    ])
    const pts: [number, number][] = []
    const run = (ax: number, az: number, bx: number, bz: number) => {
      const n = Math.ceil(Math.hypot(bx - ax, bz - az) / F.postEvery)
      for (let i = 0; i < n; i++) pts.push([ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n])
    }
    run(x0, z0, x1, z0)
    run(x1, z0, x1, z1)
    run(x1, z1, x0, z1)
    run(x0, z1, x0, z0)
    const posts = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.045, 0.05, F.height + 0.15, 8),
      new THREE.MeshStandardMaterial({
        color: '#8b9096',
        metalness: 0.85,
        roughness: 0.5,
      }),
      pts.length,
    )
    pts.forEach(([x, z], i) => posts.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, (F.height + 0.15) / 2, z)))
    // travesaño superior de cada lado (caja unitaria escalada)
    const railMat = posts.material as THREE.Material
    const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.05, 0.05), railMat, 4)
    const rail = (i: number, len: number, x: number, z: number, ry: number) =>
      rails.setMatrixAt(
        i,
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, F.height + 0.06, z),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry),
          new THREE.Vector3(len, 1, 1),
        ),
      )
    rail(0, x1 - x0, (x0 + x1) / 2, z0, 0)
    rail(1, x1 - x0, (x0 + x1) / 2, z1, 0)
    rail(2, z1 - z0, x0, 0, Math.PI / 2)
    rail(3, z1 - z0, x1, 0, Math.PI / 2)
    const mats = [
      new THREE.MeshStandardMaterial({
        map: link,
        alphaTest: 0.4,
        side: THREE.DoubleSide,
        metalness: 0.7,
        roughness: 0.5,
        color: '#b9bec4',
      }),
    ]
    return { panels, posts, rails, mats }
  }, [])
  useEffect(
    () => () => {
      panels.dispose()
      posts.geometry.dispose()
      posts.dispose()
      rails.geometry.dispose()
      rails.dispose()
      ;(posts.material as THREE.Material).dispose()
      mats[0].map?.dispose()
      mats[0].dispose()
    },
    [panels, posts, rails, mats],
  )
  return (
    <group name="escenario_vallado">
      <mesh geometry={panels} material={mats[0]} />
      <primitive object={posts} />
      <primitive object={rails} />
    </group>
  )
}

function Sign() {
  const tex = useMemo(signTexture, [])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <mesh position={[-33, 1.45, B.minZ + INSET + 0.04]} name="escenario_cartel">
      <planeGeometry args={[3.2, 0.8]} />
      <meshStandardMaterial map={tex} roughness={0.6} metalness={0.1} />
    </mesh>
  )
}

// Suelo exterior (más allá del vallado): mismo material, sin colisión; la niebla lo funde con el horizonte.
function OuterGround() {
  const SIZE = 1400
  const mat = useGroundMaterial(SIZE, SIZE, '#cfc7b8')
  return (
    <mesh rotation-x={-Math.PI / 2} position={[mx, -0.04, 0]} material={mat} name="suelo_exterior">
      <planeGeometry args={[SIZE, SIZE]} />
    </mesh>
  )
}

type Mark = { x: number; z: number; w: number; h: number; rot: number }
function marks(list: Mark[], y: number, geo: THREE.BufferGeometry, mat: THREE.Material) {
  const m = new THREE.InstancedMesh(geo, mat, list.length)
  list.forEach((s, i) =>
    m.setMatrixAt(
      i,
      new THREE.Matrix4().compose(
        new THREE.Vector3(s.x, y, s.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, s.rot, 'YXZ')),
        new THREE.Vector3(s.w, s.h, 1),
      ),
    ),
  )
  m.renderOrder = 1
  return m
}

// Manchas de aceite, huellas de neumático (cortas, detrás de la camioneta al llegar) y charcos: ESTIMADOS, ilustrativos.
const STAINS: Mark[] = [
  { x: -34, z: 19, w: 2.2, h: 1.7, rot: 0.5 },
  { x: 22, z: 17, w: 1.6, h: 1.4, rot: 2.1 },
  { x: -9, z: 26, w: 2.6, h: 1.9, rot: 1.2 },
  { x: 29.5, z: -17, w: 1.9, h: 1.5, rot: 3.6 },
]
const PUDDLES: Mark[] = [
  { x: -38, z: 10, w: 2.6, h: 1.8, rot: 0.3 },
  { x: 27.5, z: -22, w: 3.2, h: 2.2, rot: 1.9 },
]
// huellas: dos bandas de 6 m, a ±0,95 m del eje de la camioneta, hacia atrás desde donde nace
const back = [Math.sin(TRUCK_SPAWN_HEADING), Math.cos(TRUCK_SPAWN_HEADING)] // opuesto al avance (-sen, -cos)
const side = [Math.cos(TRUCK_SPAWN_HEADING), -Math.sin(TRUCK_SPAWN_HEADING)]
const TRACKS: Mark[] = [-1, 1].map((k) => ({
  x: TRUCK_SPAWN[0] + back[0] * 4.2 + side[0] * 0.95 * k,
  z: TRUCK_SPAWN[2] + back[1] * 4.2 + side[1] * 0.95 * k,
  w: 0.5,
  h: 6,
  rot: TRUCK_SPAWN_HEADING,
}))

function GroundMarks() {
  const { stains, puddles, tracks, disposables } = useMemo(() => {
    const blob = blobTexture()
    const tr = tracksTexture()
    const plane = new THREE.PlaneGeometry(1, 1)
    const stainMat = new THREE.MeshBasicMaterial({
      map: blob,
      color: '#14110d',
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    })
    const trackMat = new THREE.MeshBasicMaterial({
      map: tr,
      color: '#2a251d',
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    })
    const puddleMat = new THREE.MeshStandardMaterial({
      alphaMap: blob,
      color: '#15181d',
      roughness: 0.04,
      metalness: 0,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
    })
    return {
      stains: marks(STAINS, 0.012, plane, stainMat),
      puddles: marks(PUDDLES, 0.016, plane, puddleMat),
      tracks: marks(TRACKS, 0.014, plane, trackMat),
      disposables: [blob, tr, plane, stainMat, trackMat, puddleMat] as {
        dispose(): void
      }[],
    }
  }, [])
  useEffect(() => () => disposables.forEach((d) => d.dispose()), [disposables])
  return (
    <group name="escenario_marcas">
      <primitive object={stains} />
      <primitive object={tracks} />
      <primitive object={puddles} />
    </group>
  )
}

export function SiteDressing() {
  return (
    <>
      <OuterGround />
      <Fence />
      <Sign />
      <GroundMarks />
    </>
  )
}
