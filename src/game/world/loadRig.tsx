import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import { RIG_PARTS } from './frame'
import { stripLines } from './stripLines'

// Decoders Draco locales (public/decoders/draco), sin CDN. Meshopt lo agrega drei por defecto.
const DRACO_PATH = `${import.meta.env.BASE_URL}decoders/draco/`
const url = (glb: string) => `${import.meta.env.BASE_URL}models/rig10/${glb}`

RIG_PARTS.forEach((p) => useGLTF.preload(url(p.glb), DRACO_PATH))

function Part({ glb }: { glb: string }) {
  const { scene } = useGLTF(url(glb), DRACO_PATH)
  const clone = useMemo(() => {
    const c = scene.clone(true)
    stripLines(c)
    return c
  }, [scene])
  return <primitive object={clone} />
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
