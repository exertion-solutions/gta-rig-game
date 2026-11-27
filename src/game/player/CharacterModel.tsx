import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { exposeGame } from '../dev'
import { assetUrl, DRACO_PATH } from '../world/assetUrl'
import { pickClip, type Clip } from './characterAnim'
import { playerAction, playerSpeed } from './Player'
import { usePlayerStore } from './store'

// Trabajador Microsoft Rocketbox (MIT), ver NOTICE.md y scripts/build-character.py. Meshopt: decoder que agrega drei.
const URL = assetUrl('models/character/worker.glb')
useGLTF.preload(URL, DRACO_PATH)

const FADE = 0.2 // s de crossfade entre clips
const SPEED_K = 10 // 1/s, suavizado de la rapidez (transiciones sin parpadeo de clip)
// velocidad (m/s) a la que cada clip pisa sin patinar: avance original del clip Rocketbox / su duración
const NATURAL_SPEED: Partial<Record<Clip, number>> = { walk: 1.01, run: 2.88 }
const FACING = Math.PI // el modelo mira a +Z; yaw 0 mira a -Z
// Sin clip de salto ni de trepar con licencia verificable para este esqueleto (NOTICE.md): 'jump' usa la pose de
// 'idle' y 'climb' la de 'walk' (detenida si no se mueve). 'operate' es un clip propio (Rocketbox m_work_mid).
const SOURCE: Partial<Record<Clip, Clip>> = { jump: 'idle', climb: 'walk' }

// Visual del jugador: hijo del RigidBody, con los pies en y=0 del jugador (offset `footY` = base de la cápsula).
export function CharacterModel({ footY }: { footY: number }) {
  const { scene, animations } = useGLTF(URL, DRACO_PATH)
  const root = useRef<THREE.Group>(null)
  const { actions } = useAnimations(animations, root)
  const visible = usePlayerStore((s) => s.mode === 'foot')
  const clip = useRef<Clip | null>(null)
  const speed = useRef(0)

  useEffect(() => {
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true
    })
  }, [scene])

  useEffect(() => exposeGame({ currentClip: () => clip.current }), [])

  useFrame((_, delta) => {
    const { yaw, mode } = usePlayerStore.getState()
    speed.current += (playerSpeed.current - speed.current) * (1 - Math.exp(-SPEED_K * Math.min(delta, 0.1)))
    if (root.current) root.current.rotation.y = yaw + FACING

    const act = { climbing: playerAction.climbing, airborne: playerAction.airborne, operating: performance.now() < playerAction.operatingUntil }
    const next = pickClip(speed.current, mode, act)
    const a = actions[SOURCE[next] ?? next]
    if (!a) return
    // !isScheduled: drei detiene las acciones al re-montar (StrictMode/Suspense) y el clip quedaría congelado en T-pose
    // (no isRunning: con timeScale 0, el trepar detenido, daría false y reiniciaría el clip en cada frame)
    if (next !== clip.current || !a.isScheduled()) {
      const pc = clip.current && (SOURCE[clip.current] ?? clip.current)
      const prev = pc && pc !== (SOURCE[next] ?? next) && actions[pc]
      a.reset().fadeIn(FADE).play()
      if (prev) prev.fadeOut(FADE)
      clip.current = next
    }
    const natural = NATURAL_SPEED[next]
    a.timeScale =
      next === 'climb' ? (playerAction.climbMoving ? 1 : 0) : natural ? THREE.MathUtils.clamp(speed.current / natural, 0.6, 1.8) : 1
  })

  return (
    <group ref={root} name="worker" position={[0, -footY, 0]} visible={visible}>
      <primitive object={scene} />
    </group>
  )
}
