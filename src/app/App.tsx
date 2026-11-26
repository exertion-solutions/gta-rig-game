import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { Ground, PhysicsWorld, RigColliders } from '../game/world/Ground'
import { RigScene } from '../game/world/loadRig'

// OrbitControls provisional: se reemplaza por la cámara de seguimiento.
export function App() {
  return (
    <Canvas camera={{ position: [-40, 30, 50], fov: 50, far: 500 }} style={{ height: '100vh' }}>
      <color attach="background" args={['#9fc3e8']} />
      <Suspense fallback={null}>
        <PhysicsWorld>
          <Ground />
          <RigColliders />
        </PhysicsWorld>
        <RigScene />
      </Suspense>
      <OrbitControls target={[-5, 8, 0]} />
    </Canvas>
  )
}
