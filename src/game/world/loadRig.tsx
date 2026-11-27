import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import { DRACO_PATH, rigUrl } from './assetUrl'
import { RIG_PARTS } from './frame'
import { stripLines } from './stripLines'

// Decoders Draco locales (public/decoders/draco), sin CDN. Meshopt lo agrega drei por defecto.

RIG_PARTS.forEach((p) => useGLTF.preload(rigUrl(p.glb), DRACO_PATH))

function Part({ glb }: { glb: string }) {
  const { scene } = useGLTF(rigUrl(glb), DRACO_PATH)
  const clone = useMemo(() => {
    const c = scene.clone(true)
    stripLines(c)
    return c
  }, [scene])
  return <primitive object={clone} name={glb.replace(/\.glb$/, '')} /> // nombre = id de la pieza (lo usan los tests)
}

export function RigScene() {
  return (
    <group>
      <hemisphereLight args={['#ffffff', '#6b5b3a', 1.2]} />
      {RIG_PARTS.map((p) => (
        <Part key={p.id} glb={p.glb} />
      ))}
    </group>
  )
}
