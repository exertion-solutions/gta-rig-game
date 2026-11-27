import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { create } from 'zustand'
import { exposeGame } from '../dev'
import { QUALITY_PROFILE, useQualityStore } from '../quality'
import { LOCACION_BOUNDS as B } from './frame'

// Ciclo día/noche: sol direccional con sombra y luz hemisférica; el cielo, la niebla y los reflejos están en
// Environment.tsx (usan lightingAt). De noche se encienden (emissive) las luminarias de la torre (sk575_mastil_luz).
// De noche el sol queda bajo (elevación 0,15) y tenue: hace de luna y sigue proyectando sombra.
const START_HOUR = 10 // media mañana
const HOURS_PER_SECOND = 1 / 180 // 1 hora de juego cada 3 minutos reales: un día dura 72 min (de las 10 al atardecer, 24 min)
const LAMP_MATERIAL = 'sk575_mastil_luz'
const CENTER = new THREE.Vector3((B.minX + B.maxX) / 2, 0, 0)
const SUN_DISTANCE = 80

/** Sombra del sol (requisito de la tarea; e2e la lee del renderer). Canvas: shadows="percentage" = PCFShadowMap. */
export const SHADOW = { mapSize: 2048, half: 40, type: THREE.PCFShadowMap } // ±40 m cubre la locación (78,5 × 61 m)

const wrap = (h: number) => ((h % 24) + 24) % 24
const minuteOf = (h: number) => Math.floor(h * 60) / 60

// Hora exacta por cuadro fuera de React; el store solo guarda el minuto de juego (≈ 1 cambio por segundo real), así
// quien use useTimeOfDay no se re-renderiza a 60 Hz.
// Cada sesión arranca a media mañana. Antes la hora se guardaba y se retomaba: quien había dejado el juego al
// atardecer volvía a entrar y se le hacía de noche a los pocos segundos.
let exact = START_HOUR
type TimeState = { hour: number; setHour(h: number): void }
export const useTime = create<TimeState>((set) => ({
  hour: minuteOf(exact),
  setHour: (h) => {
    exact = wrap(h)
    set({ hour: minuteOf(exact) })
  },
}))

/** Hora exacta (sin cuantizar). */
export const exactHour = () => exact

/** Avanza el reloj `dt` segundos reales. Solo toca el store cuando cambia el minuto de juego. */
export function advanceClock(dt: number) {
  exact = wrap(exact + Math.min(dt, 0.1) * HOURS_PER_SECOND)
  const m = minuteOf(exact)
  if (m !== useTime.getState().hour) useTime.setState({ hour: m })
}

/** Hora del día (0–24, al minuto de juego) y cómo fijarla. No se guarda entre sesiones. */
export function useTimeOfDay(): TimeState {
  const hour = useTime((s) => s.hour)
  const setHour = useTime((s) => s.setHour)
  return { hour, setHour }
}

export type Lighting = {
  sunDir: [number, number, number] // hacia el sol (unitario)
  sun: number
  hemi: number
  lamps: number // emissiveIntensity de las luminarias
  skyTop: THREE.Color
  skyBottom: THREE.Color
}

const C = {
  topNight: new THREE.Color('#0b1426'),
  topDay: new THREE.Color('#5f9ad6'),
  botNight: new THREE.Color('#1c2333'),
  botDay: new THREE.Color('#cfe1f2'),
}
export const newLighting = (): Lighting => ({
  sunDir: [0, 1, 0],
  sun: 0,
  hemi: 0,
  lamps: 0,
  skyTop: new THREE.Color(),
  skyBottom: new THREE.Color(),
})

/** Luz para una hora: el sol sale a las 6 y se pone a las 18; de noche queda luz ambiente para ver el equipo.
 *  Escribe en `out` (sin asignar memoria por cuadro). */
export function lightingAt(hour: number, out: Lighting = newLighting()): Lighting {
  const a = ((hour - 6) / 12) * Math.PI // 0 al amanecer, π al atardecer
  const elev = Math.sin(a) // > 0 de día
  const day = THREE.MathUtils.smoothstep(elev, -0.1, 0.25) // 0 noche … 1 día, con crepúsculo
  const x = Math.cos(a)
  const y = Math.max(elev, 0.15) // de noche, "luna" baja
  const len = Math.hypot(x, y, 0.35)
  out.sunDir[0] = x / len
  out.sunDir[1] = y / len
  out.sunDir[2] = 0.35 / len
  out.sun = 0.15 + 2.6 * day
  out.hemi = 0.35 + 0.85 * day
  out.lamps = 3 * (1 - day)
  out.skyTop.lerpColors(C.topNight, C.topDay, day)
  out.skyBottom.lerpColors(C.botNight, C.botDay, day)
  return out
}

export function DayNight() {
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const sun = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const lamps = useRef<THREE.MeshStandardMaterial[]>([])
  const light = useMemo(newLighting, [])
  const quality = useQualityStore((s) => s.quality)

  // calidad: sombra del sol (tamaño del mapa o apagada). Alta = SHADOW.mapSize (el e2e la lee del renderer).
  useEffect(() => {
    const s = sun.current
    if (!s) return
    const p = QUALITY_PROFILE[quality]
    s.castShadow = p.shadows
    if (s.shadow.mapSize.x !== p.shadowMap) {
      s.shadow.mapSize.set(p.shadowMap, p.shadowMap)
      s.shadow.map?.dispose()
      s.shadow.map = null // se vuelve a crear con el tamaño nuevo en el próximo cuadro
    }
  }, [quality])

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
      getHour: exactHour,
      setHour: (h: number) => useTime.getState().setHour(h),
      lights: () => {
        const s = sun.current
        return {
          sun: s?.intensity ?? 0,
          hemi: hemi.current?.intensity ?? 0,
          lamps: lamps.current[0]?.emissiveIntensity ?? 0,
          shadow: s && {
            enabled: gl.shadowMap.enabled,
            pcf: gl.shadowMap.type === THREE.PCFShadowMap,
            castShadow: s.castShadow,
            mapSize: s.shadow.mapSize.toArray(),
            frustum: [s.shadow.camera.left, s.shadow.camera.right, s.shadow.camera.bottom, s.shadow.camera.top],
          },
        }
      },
    })
  }, [scene, gl])

  useFrame((_, delta) => {
    advanceClock(delta)
    lightingAt(exact, light)
    if (sun.current) {
      sun.current.intensity = light.sun
      sun.current.position
        .set(...light.sunDir)
        .multiplyScalar(SUN_DISTANCE)
        .add(CENTER)
    }
    if (hemi.current) hemi.current.intensity = light.hemi
    for (const m of lamps.current) m.emissiveIntensity = light.lamps
  })

  return (
    <>
      <hemisphereLight ref={hemi} args={['#ffffff', '#6b5b3a', 1.2]} />
      <directionalLight
        ref={sun}
        castShadow
        shadow-mapSize={[SHADOW.mapSize, SHADOW.mapSize]}
        shadow-camera-left={-SHADOW.half}
        shadow-camera-right={SHADOW.half}
        shadow-camera-top={SHADOW.half}
        shadow-camera-bottom={-SHADOW.half}
        shadow-camera-near={1}
        shadow-camera-far={200}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
      />
    </>
  )
}
