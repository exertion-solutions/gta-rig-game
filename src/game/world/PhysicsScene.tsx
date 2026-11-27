// Todo lo que usa Rapier (≈2 MB de WASM en base64) en un chunk aparte: App lo carga con lazy() y la escena pinta antes.
import { useEffect } from 'react'
import { FollowCamera } from '../camera/CameraRig'
import { Player } from '../player/Player'
import { Truck } from '../vehicle/Truck'
import { Ground, PhysicsWorld, RigColliders, WalkableColliders } from './Ground'

export default function PhysicsScene({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady])
  return (
    <PhysicsWorld>
      <Ground />
      <RigColliders />
      <WalkableColliders />
      <Player />
      <Truck />
      <FollowCamera />
    </PhysicsWorld>
  )
}
