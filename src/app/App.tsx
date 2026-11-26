import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect } from 'react'
import { FollowCamera } from '../game/camera/CameraRig'
import { getSectors } from '../game/data/sectors'
import { exposeGame } from '../game/dev'
import { loadMissionDefs } from '../game/missions'
import { ObjectiveMarker, SectorReporter } from '../game/missions/MissionRuntime'
import { useMissionStore } from '../game/missions/store'
import { Player } from '../game/player/Player'
import { Truck } from '../game/vehicle/Truck'
import { Ground, PhysicsWorld, RigColliders } from '../game/world/Ground'
import { RigScene } from '../game/world/loadRig'
import { Hud } from '../ui/Hud'
import { useHudStore } from '../ui/hudStore'

// Cámara de seguimiento en tercera persona (FollowCamera); sigue al jugador, y a la camioneta cuando se conduce.
export function App() {
  useEffect(() => {
    let live = true
    void loadMissionDefs().then((defs) => {
      if (!live) return
      useMissionStore.getState().init(defs, { sectors: getSectors() })
    })
    exposeGame({
      startMission: (id: string) => useMissionStore.getState().start(id),
      getMission: () => useMissionStore.getState().mission,
      getAtSector: () => useHudStore.getState().atSector,
    })
    return () => {
      live = false
    }
  }, [])
  return (
    <>
      <Canvas camera={{ position: [-40, 30, 50], fov: 50, far: 500 }} style={{ height: '100vh' }}>
        <color attach="background" args={['#9fc3e8']} />
        <Suspense fallback={null}>
          <PhysicsWorld>
            <Ground />
            <RigColliders />
            <Player />
            <Truck />
            <FollowCamera />
          </PhysicsWorld>
          <RigScene />
          <SectorReporter />
          <ObjectiveMarker />
        </Suspense>
      </Canvas>
      <Hud />
    </>
  )
}
