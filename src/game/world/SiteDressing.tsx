import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { TRUCK_SPAWN, TRUCK_SPAWN_HEADING } from '../player/store'
import { useGroundMaterial } from './GroundMaterial'
import { LOCACION_BOUNDS as B } from './frame'

// Escenario ilustrativo añadido por el juego, no as-built (docs/scenario-additions.md A5–A8): cartel genérico, suelo exterior y marcas de uso del suelo (manchas, huellas cortas, charcos). Todo con
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

function Sign() {
  const tex = useMemo(signTexture, [])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <group position={[-33, 0, B.minZ + INSET + 0.04]} name="escenario_cartel">
      <mesh position={[0, 1.45, 0]}>
        <planeGeometry args={[3.2, 0.8]} />
        <meshStandardMaterial map={tex} roughness={0.6} metalness={0.1} />
      </mesh>
      {/* sin alambrado donde colgarlo: va sobre dos postes */}
      {[-1.4, 1.4].map((x) => (
        <mesh key={x} position={[x, 0.925, -0.04]}>
          <boxGeometry args={[0.06, 1.85, 0.06]} />
          <meshStandardMaterial color="#3a3f45" roughness={0.6} metalness={0.5} />
        </mesh>
      ))}
    </group>
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
      <Sign />
      <GroundMarks />
    </>
  )
}
