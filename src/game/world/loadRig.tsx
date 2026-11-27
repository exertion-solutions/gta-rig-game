import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { DRACO_PATH, rigUrl } from './assetUrl'
import { RIG_PARTS } from './frame'
import { mergeByMaterial } from './mergeByMaterial'
import { stripLines } from './stripLines'

// Decoders Draco locales (public/decoders/draco), sin CDN. Meshopt lo agrega drei por defecto.

RIG_PARTS.forEach((p) => useGLTF.preload(rigUrl(p.glb), DRACO_PATH))

// Proyectan sombra solo las piezas grandes (≈ 230 k triángulos): con todas, el pase de sombras duplicaba los ≈ 690 k del
// equipo y el cuadro pasaba de 1 M (docs/perf.md). El resto (acumulador, llave, manifold, bomba, BOP…) solo la recibe.
const SHADOW_CASTERS = new Set(['sk575_mastil.glb', 'sk575_carrier.glb', 'sk575_piletas.glb', 'sk575_piso.glb', 'sk575_planchada.glb'])

function Part({ glb }: { glb: string }) {
  const { scene } = useGLTF(rigUrl(glb), DRACO_PATH)
  const { clone, merged } = useMemo(() => {
    const c = scene.clone(true)
    stripLines(c)
    const merged = mergeByMaterial(c) // piezas estáticas: un draw call por material (el acumulador traía 63 nodos), docs/perf.md
    const cast = SHADOW_CASTERS.has(glb)
    c.traverse((o) => {
      o.castShadow = cast
      o.receiveShadow = true
    })
    return { clone: c, merged }
  }, [scene, glb])
  useEffect(() => () => merged.forEach((g) => g.dispose()), [merged])
  return <primitive object={clone} name={glb.replace(/\.glb$/, '')} /> // nombre = id de la pieza (lo usan los tests)
}

export function RigScene() {
  return (
    <group>
      {RIG_PARTS.map((p) => (
        <Part key={p.id} glb={p.glb} />
      ))}
    </group>
  )
}
