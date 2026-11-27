import { Canvas } from '@react-three/fiber'
import { lazy, Suspense, useEffect, useState } from 'react'
import { startAudio } from '../audio'
import { holdRadio, useRadioStore } from '../audio/radioPlayer'
import { useAudioStore } from '../audio/mix'
import { getSectors } from '../game/data/sectors'
import { exposeGame } from '../game/dev'
import { loadMissionDefs } from '../game/missions'
import { ObjectiveMarker, SectorReporter } from '../game/missions/MissionRuntime'
import { useMissionStore } from '../game/missions/store'
import { ContactShadows } from '../game/world/ContactShadows'
import { DayNight } from '../game/world/DayNight'
import { Environment } from '../game/world/Environment'
import { Post } from '../game/world/Post'
import { Props } from '../game/world/Props'
import { SiteDressing } from '../game/world/SiteDressing'
import { RigScene } from '../game/world/loadRig'
import { ValveHighlight, Valves } from '../game/world/Valve'
import { INTERACTABLES } from '../game/world/walkable'
import { InteractPrompt } from '../ui/InteractPrompt'
import { SceneProbes, ScenarioAdditions } from '../game/world/scenario/Additions'
import { Hud } from '../ui/Hud'
import { useHudStore } from '../ui/hudStore'
import { Loading } from '../ui/Loading'
import { parseMissionParam, resolveMissionId } from '../ui/share'

// Rapier (física) en un chunk aparte: el primer frame no espera a descargar y compilar su WASM.
const PhysicsScene = lazy(() => import('../game/world/PhysicsScene'))

// Cámara de seguimiento en tercera persona (FollowCamera); sigue al jugador, y a la camioneta cuando se conduce.
export function App() {
  const [physicsReady, setPhysicsReady] = useState(false)
  useEffect(() => {
    let live = true
    let stopLink: (() => void) | undefined
    startAudio()
    void loadMissionDefs().then((defs) => {
      if (!live) return
      useMissionStore.getState().init(defs, { sectors: getSectors(), interactables: INTERACTABLES })
      // Enlace ?mision=m3: la misión queda en curso en cuanto se cierra la pantalla de título (o ya, si no hay).
      const q = parseMissionParam(window.location.search)
      const id = q && resolveMissionId(useMissionStore.getState().available.map((d) => d.id), q)
      if (!id) return
      const go = () => useMissionStore.getState().start(id)
      if (!useHudStore.getState().titleOpen) return go()
      const off = useHudStore.subscribe((s) => {
        if (s.titleOpen) return
        off()
        go()
      })
      stopLink = off
    })
    exposeGame({
      startMission: (id: string) => useMissionStore.getState().start(id),
      getMission: () => useMissionStore.getState().mission,
      getAtSector: () => useHudStore.getState().atSector,
      getSubtitle: () => useRadioStore.getState().subtitle,
      holdRadio,
      showSubtitle: (subtitle: string) => useRadioStore.setState({ subtitle }), // con holdRadio(true): fija un texto
      getMix: () => useAudioStore.getState().mix,
    })
    return () => {
      live = false
      stopLink?.()
    }
  }, [])
  return (
    <>
      <Canvas shadows="percentage" camera={{ position: [-40, 30, 50], fov: 50, far: 500 }} style={{ height: '100vh' }}>
        <color attach="background" args={['#9fc3e8']} />
        <Suspense fallback={null}>
          <Suspense fallback={null}>
            <PhysicsScene onReady={() => setPhysicsReady(true)} />
          </Suspense>
          <DayNight />
          <Environment />
          <RigScene />
          <ScenarioAdditions />
          <SiteDressing />
          <Props />
          <ContactShadows />
          <Valves />
          <ValveHighlight />
          <SceneProbes />
          <SectorReporter />
          <ObjectiveMarker />
        </Suspense>
        <Post />
      </Canvas>
      <Hud />
      <InteractPrompt />
      <Loading physicsReady={physicsReady} />
    </>
  )
}
