import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { create } from 'zustand'
import { exposeGame } from '../dev'
import { LOCACION_BOUNDS as B } from './frame'

// Ciclo día/noche: sol direccional con sombra, cielo de gradiente por shader y luz hemisférica. Sin SSAO ni bloom:
// de noche solo se encienden (emissive) las luminarias de la torre (material sk575_mastil_luz del GLB).
const START_HOUR = 10 // media mañana
const HOURS_PER_SECOND = 1 / 60 // 1 hora de juego por minuto real: un día dura 24 min
const LAMP_MATERIAL = 'sk575_mastil_luz'
const SHADOW_HALF = 40 // frustum de la sombra ±40 m: cubre la locación (78,5 × 61 m)
const CENTER = new THREE.Vector3((B.minX + B.maxX) / 2, 0, 0)
const SUN_DISTANCE = 80

type TimeState = { hour: number; setHour(h: number): void }
const useTime = create<TimeState>((set) => ({ hour: START_HOUR, setHour: (h) => set({ hour: ((h % 24) + 24) % 24 }) }))

/** Hora del día (0–24) y cómo fijarla. No se persiste: cada carga arranca a media mañana. */
export const useTimeOfDay = (): TimeState => useTime()

export type Lighting = {
  sunDir: [number, number, number] // hacia el sol (unitario)
  sun: number
  hemi: number
  lamps: number // emissiveIntensity de las luminarias
  skyTop: string
  skyBottom: string
}

const mix = (a: string, b: string, t: number) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()

/** Luz para una hora: el sol sale a las 6 y se pone a las 18; de noche queda luz ambiente para ver el equipo. */
export function lightingAt(hour: number): Lighting {
  const a = ((hour - 6) / 12) * Math.PI // 0 al amanecer, π al atardecer
  const elev = Math.sin(a) // > 0 de día
  const day = THREE.MathUtils.smoothstep(elev, -0.1, 0.25) // 0 noche … 1 día, con crepúsculo
  const sunDir = new THREE.Vector3(Math.cos(a), Math.max(elev, 0.15), 0.35).normalize() // de noche, "luna" baja
  return {
    sunDir: sunDir.toArray() as [number, number, number],
    sun: 0.15 + 2.6 * day,
    hemi: 0.35 + 0.85 * day,
    lamps: 3 * (1 - day),
    skyTop: mix('#0b1426', '#5f9ad6', day),
    skyBottom: mix('#1c2333', '#cfe1f2', day),
  }
}

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const SKY_FRAG = /* glsl */ `
uniform vec3 top;
uniform vec3 bottom;
varying vec3 vDir;
void main() {
  gl_FragColor = vec4(mix(bottom, top, smoothstep(-0.05, 0.5, vDir.y)), 1.0);
  #include <colorspace_fragment>
}`

export function DayNight() {
  const scene = useThree((s) => s.scene)
  const sun = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const lamps = useRef<THREE.MeshStandardMaterial[]>([])
  const sky = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [],
  )

  useEffect(() => {
    // el blanco no cuelga de la escena: su matriz se fija una vez
    sun.current?.target.position.copy(CENTER)
    sun.current?.target.updateMatrixWorld()
    // las piezas cargan en el mismo Suspense: al montar ya están en la escena
    const found = new Set<THREE.MeshStandardMaterial>()
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
      if (m?.name === LAMP_MATERIAL && 'emissive' in m) found.add(m)
    })
    lamps.current = [...found]
    lamps.current.forEach((m) => m.emissive.set('#ffe7b0'))
    exposeGame({
      getHour: () => useTime.getState().hour,
      setHour: (h: number) => useTime.getState().setHour(h),
      lights: () => ({ sun: sun.current?.intensity ?? 0, hemi: hemi.current?.intensity ?? 0, lamps: lamps.current[0]?.emissiveIntensity ?? 0 }),
    })
  }, [scene])

  useFrame((_, delta) => {
    const t = useTime.getState()
    t.setHour(t.hour + Math.min(delta, 0.1) * HOURS_PER_SECOND)
    const l = lightingAt(useTime.getState().hour)
    if (sun.current) {
      sun.current.intensity = l.sun
      sun.current.position.set(...l.sunDir).multiplyScalar(SUN_DISTANCE).add(CENTER)
    }
    if (hemi.current) hemi.current.intensity = l.hemi
    sky.uniforms.top.value.set(l.skyTop)
    sky.uniforms.bottom.value.set(l.skyBottom)
    for (const m of lamps.current) m.emissiveIntensity = l.lamps
  })

  return (
    <>
      <hemisphereLight ref={hemi} args={['#ffffff', '#6b5b3a', 1.2]} />
      <directionalLight
        ref={sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-SHADOW_HALF}
        shadow-camera-right={SHADOW_HALF}
        shadow-camera-top={SHADOW_HALF}
        shadow-camera-bottom={-SHADOW_HALF}
        shadow-camera-near={1}
        shadow-camera-far={200}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
      />
      <mesh material={sky} frustumCulled={false} renderOrder={-1} name="cielo">
        <sphereGeometry args={[400, 32, 16]} />
      </mesh>
    </>
  )
}
