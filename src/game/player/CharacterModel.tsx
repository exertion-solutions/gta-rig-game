import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { exposeGame } from '../dev'
import { assetUrl, DRACO_PATH } from '../world/assetUrl'
import { nextLandUntil, pickClip, type Clip } from './characterAnim'
import { CLIMB_KEYS, JUMP_KEYS, LAND_KEYS, poseClip } from './poseClips'
import { playerAction, playerSpeed } from './telemetry'
import { usePlayerStore } from './store'

// Trabajador Microsoft Rocketbox (MIT), ver NOTICE.md y scripts/build-character.py. Meshopt: decoder que agrega drei.
const URL = assetUrl('models/character/worker.glb')
useGLTF.preload(URL, DRACO_PATH)

const FADE = 0.2 // s de crossfade entre clips
const JUMP_FADE = 0.08 // entrada al salto y al aterrizaje: corta, para que se vea el agachado
const SPEED_K = 10 // 1/s, suavizado de la rapidez (transiciones sin parpadeo de clip)
// velocidad (m/s) a la que cada clip pisa sin patinar: avance original del clip Rocketbox / su duración
const NATURAL_SPEED: Partial<Record<Clip, number>> = { walk: 1.01, run: 2.88 }
const FACING = Math.PI // el modelo mira a +Z; yaw 0 mira a -Z
// 'jump' y 'climb' se generan en código (poseClips.ts); 'operate' es un clip Rocketbox (m_work_mid).

// Visual del jugador: hijo del RigidBody, con los pies en y=0 del jugador (offset `footY` = base de la cápsula).
export function CharacterModel({ footY }: { footY: number }) {
  const { scene, animations } = useGLTF(URL, DRACO_PATH)
  const root = useRef<THREE.Group>(null)
  const clips = useMemo(() => {
    const idle = animations.find((c) => c.name === 'idle')
    if (!idle) return animations
    return [...animations, poseClip('jump', scene, idle, JUMP_KEYS), poseClip('land', scene, idle, LAND_KEYS), poseClip('climb', scene, idle, CLIMB_KEYS)]
  }, [animations, scene])
  const { actions } = useAnimations(clips, root)
  const visible = usePlayerStore((s) => s.mode === 'foot')
  const clip = useRef<Clip | null>(null)
  const speed = useRef(0)
  const air = useRef({ was: false, landUntil: 0 })

  useEffect(() => {
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true
    })
  }, [scene])

  useEffect(() => {
    // clip que más pesa en el mezclador (prueba que el salto usa su propio clip y no otro prestado)
    const playingClip = () => {
      let best: THREE.AnimationAction | null = null
      for (const a of Object.values(actions)) if (a?.isRunning() && (!best || a.getEffectiveWeight() > best.getEffectiveWeight())) best = a
      return best?.getClip().name ?? null
    }
    exposeGame({ currentClip: () => clip.current, playingClip })
  }, [actions])

  useFrame((_, delta) => {
    const { yaw, mode } = usePlayerStore.getState()
    speed.current += (playerSpeed.current - speed.current) * (1 - Math.exp(-SPEED_K * Math.min(delta, 0.1)))
    if (root.current) root.current.rotation.y = yaw + FACING

    const now = performance.now()
    air.current.landUntil = nextLandUntil(air.current.was, playerAction.airborne, now, air.current.landUntil)
    air.current.was = playerAction.airborne
    const act = {
      climbing: playerAction.climbing,
      airborne: playerAction.airborne,
      landing: now < air.current.landUntil,
      operating: now < playerAction.operatingUntil,
    }
    const next = pickClip(speed.current, mode, act)
    const a = actions[next]
    if (!a) return
    // !isScheduled: drei detiene las acciones al re-montar (StrictMode/Suspense) y el clip quedaría congelado en T-pose
    // (no isRunning: con timeScale 0, el trepar detenido, daría false y reiniciaría el clip en cada frame)
    if (next !== clip.current || !a.isScheduled()) {
      const prev = clip.current && clip.current !== next && actions[clip.current]
      const once = next === 'jump' || next === 'land'
      const fade = once ? JUMP_FADE : FADE
      if (once) {
        a.setLoop(THREE.LoopOnce, 1)
        a.clampWhenFinished = true // salto: queda en pose de caída si el vuelo dura más; aterrizaje: termina casi en idle
      }
      a.reset().fadeIn(fade).play()
      if (prev) prev.fadeOut(fade)
      clip.current = next
    }
    const natural = NATURAL_SPEED[next] // trepar: climbDir, bajando el ciclo va al revés
    a.timeScale =
      next === 'climb' ? playerAction.climbDir : natural ? THREE.MathUtils.clamp(speed.current / natural, 0.6, 1.8) : 1
  })

  return (
    <group ref={root} name="worker" position={[0, -footY, 0]} visible={visible}>
      <primitive object={scene} />
    </group>
  )
}
