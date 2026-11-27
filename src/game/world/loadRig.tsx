import { useGLTF } from '@react-three/drei'
import { Suspense, useEffect, useMemo } from 'react'
import { useLoadStore } from '../../app/loadStore'
import { DRACO_PATH, rigUrl } from './assetUrl'
import { RIG_PARTS } from './frame'
import { mergeByMaterial } from './mergeByMaterial'
import { relabel } from './relabel'
import { stripLines } from './stripLines'

// Decoders Draco locales (public/decoders/draco), sin CDN. Meshopt lo agrega drei por defecto.

// Las piezas 'scenery' (solo visuales, sin colisión) no bloquean el "Jugar": se montan y cargan tras la primera carga.
RIG_PARTS.filter((p) => p.role !== 'scenery').forEach((p) => useGLTF.preload(rigUrl(p.glb), DRACO_PATH))

// Proyectan sombra solo las piezas grandes (≈ 230 k triángulos): con todas, el pase de sombras duplicaba los ≈ 690 k del
// equipo y el cuadro pasaba de 1 M (docs/perf.md). El resto (acumulador, llave, manifold, bomba, BOP…) solo la recibe.
const SHADOW_CASTERS = new Set(['sk575_mastil.glb', 'sk575_carrier.glb', 'sk575_piletas.glb', 'sk575_piso.glb', 'sk575_planchada.glb'])

function Part({ glb }: { glb: string }) {
  const { scene } = useGLTF(rigUrl(glb), DRACO_PATH)
  const { clone, merged, labels } = useMemo(() => {
    const c = scene.clone(true)
    stripLines(c)
    const labels = relabel(c) // rótulo con el nombre del equipo (antes de unir: el plano nuevo no se une con nada)
    const merged = mergeByMaterial(c) // piezas estáticas: un draw call por material (el acumulador traía 63 nodos), docs/perf.md
    const cast = SHADOW_CASTERS.has(glb)
    c.traverse((o) => {
      o.castShadow = cast
      o.receiveShadow = true
    })
    return { clone: c, merged, labels }
  }, [scene, glb])
  useEffect(() => () => [...merged, ...labels].forEach((g) => g.dispose()), [merged, labels])
  return <primitive object={clone} name={glb.replace(/\.glb$/, '')} /> // nombre = id de la pieza (lo usan los tests)
}

export function RigScene() {
  const settled = useLoadStore((s) => s.settled)
  return (
    <group>
      {RIG_PARTS.filter((p) => settled || p.role !== 'scenery').map((p) => (
        // Suspense propio: al cargar una pieza tardía no se oculta el resto de la escena.
        <Suspense key={p.id} fallback={null}>
          <Part glb={p.glb} />
        </Suspense>
      ))}
    </group>
  )
}
