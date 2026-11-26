import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { FollowCamera } from '../game/camera/CameraRig'
import { Player } from '../game/player/Player'
import { Ground, PhysicsWorld, RigColliders } from '../game/world/Ground'
import { RigScene } from '../game/world/loadRig'

// Cámara de seguimiento en tercera persona (FollowCamera); sigue al jugador, y al camión cuando exista.
export function App() {
  return (
    <Canvas camera={{ position: [-40, 30, 50], fov: 50, far: 500 }} style={{ height: '100vh' }}>
      <color attach="background" args={['#9fc3e8']} />
      <Suspense fallback={null}>
        <PhysicsWorld>
          <Ground />
          <RigColliders />
          <Player />
          <FollowCamera />
        </PhysicsWorld>
        <RigScene />
      </Suspense>
    </Canvas>
  )
}
